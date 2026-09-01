#!/usr/bin/env node
/**
 * One-off trailer footage recorder — clip mode.
 *
 * Records a SEPARATE short clip per point of interest (each M1 landmark,
 * each M2-M5 boss, the RL node purchase, Relaying, Training) instead of one
 * continuous walking tour. Earlier versions tried to walk/teleport between
 * every stop in one take, but the leg between destinations was consistently
 * where things stalled (wall clips, drift, and — the one that never got
 * fixed — pointer lock never coming back after a page.reload() in this
 * headed-Xvfb-without-a-window-manager setup). Clips sidestep all of that:
 * each one starts from a fresh navigation with the wallet's position
 * pre-seeded right at the target, so there's no walking and no dependency
 * on a lock surviving minutes of runtime. Stitch the clips together
 * yourself in an editor.
 *
 * Playwright's own recordVideo captures frames only — no audio track, ever
 * — so real game audio (SFX, boss voice lines) needs a different capture
 * path entirely. On WSLg, Chromium renders through Mesa D3D12 on the NVIDIA
 * GPU and ffmpeg captures its X11 window directly; `--software` retains the
 * old Xvfb + SwiftShader fallback. Audio is routed to a virtual PulseAudio
 * sink and captured alongside the window. In-game
 * background music is switched off (it's meant to be added separately in
 * editing) but sound effects and boss voice lines stay on and get captured
 * live. The software fallback needs these installed on the host (not npm
 * packages — Playwright doesn't ship them):
 *   sudo apt-get install -y xvfb pulseaudio pulseaudio-utils
 *
 * This is NOT a QA script and is not wired into CI. Run on demand:
 *   node scripts/trailer/record-trailer.mjs [--quick] [--base https://mathsmine3.xyz] [--software]
 *
 * --quick   only the M1 clips (fast iteration)
 * --base    portal base URL (default https://mathsmine3.xyz)
 * --software force Xvfb + SwiftShader instead of WSLg GPU capture
 * --interactive keep the WSLg browser focusable/clickable for debugging
 *
 * Output: scripts/trailer/out/<timestamp>/<NN-name>.mp4, one file per clip
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { randomInt } from 'node:crypto'
import {
  loadEnvLocal,
  createSessionToken,
  sbClient,
  ensureProgress,
  ensureLeaderboard,
  ensureHealth,
} from '../qa/lib.mjs'
import { MINING_CHAIN_NODE_POSITION, NODE_DICE_POSITION } from '../../lib/mining-world-layout.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const QUICK = args.includes('--quick')
const baseFlagIdx = args.indexOf('--base')
const BASE_URL = (baseFlagIdx !== -1 ? args[baseFlagIdx + 1] : 'https://mathsmine3.xyz').replace(/\/$/, '')
const onlyFlagIdx = args.indexOf('--only')
const ONLY = onlyFlagIdx !== -1 ? args[onlyFlagIdx + 1] : null
const SOFTWARE_CAPTURE = args.includes('--software')
const GPU_CAPTURE = !SOFTWARE_CAPTURE && existsSync('/dev/dxg') && Boolean(process.env.DISPLAY)
const PROTECT_GPU_WINDOW = GPU_CAPTURE && !args.includes('--interactive')

// Never resolve recorder tools through the caller's PATH. Besides satisfying
// Sonar's command-hijacking rule, fixed system paths ensure a local executable
// with a familiar name cannot be injected into this privileged capture flow.
const BIN = Object.freeze({
  ffmpeg: '/usr/bin/ffmpeg',
  ffprobe: '/usr/bin/ffprobe',
  Xvfb: '/usr/bin/Xvfb',
  pulseaudio: '/usr/bin/pulseaudio',
  pactl: '/usr/bin/pactl',
  xwininfo: '/usr/bin/xwininfo',
  powershell: '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
})

// Throwaway wallet — never a real user, never a live bot wallet.
const TRAILER_WALLET = `0x${'deadbeef'.repeat(5)}`
const BOT_WALLETS = Object.freeze({
  m2: '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  m3: '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202',
  m4: '0xd6c6c15060b27406d956c7e99e520cc810b44233',
  m5: '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab',
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const DISPLAY_NUM = GPU_CAPTURE ? process.env.DISPLAY : ':97'
const PULSE_SINK_NAME = 'mm3trailer'
const CAPTURE_SIZE = { width: 1280, height: 720 }
// Bare Xvfb has no window manager, so Chromium keeps a 70px top frame even
// in kiosk/app mode. Give the display that extra strip and grab below it.
const CHROMIUM_FRAME_TOP = 88
const DISPLAY_SIZE = { width: CAPTURE_SIZE.width, height: CAPTURE_SIZE.height + CHROMIUM_FRAME_TOP }

// Movement constants copied from components/MiningChain3DFPV.jsx (MOVE_SPD,
// TURN_SPD, CELL_SIZE) — only used for a short, straight approach walk (a
// few cells, always spawned a bit back from the target so the clip shows
// it from a distance first), never a long cross-map trek. That distinction
// matters: it's exactly the long, drift-prone walks between destinations
// that stalled every earlier version of this script; a handful of cells in
// open ground next to a landmark already known to be clear is a different,
// much safer thing.
const CELL_SIZE = 40
// The renderer caps simulation delta while Chromium is software-rendering in
// Xvfb (often 1-3 FPS), so wall-clock movement is much slower than MOVE_SPD.
// Calibrated from diagonal statue footage as well as straight approaches:
// the effective rate is ~0.24 cells/sec at the 1-3 FPS seen in Xvfb.
const MOVE_SPD_CELLS_S = 0.24
// Like movement, keyboard turning advances on capped simulation ticks in
// software-rendered Xvfb. This is its measured wall-clock rate.
const SOFTWARE_TURN_SPD = 0.42 // rad/sec
const GPU_TURN_SPD = 1.35 // MiningChain3DFPV TURN_SPD at real-time frame rates
// The game accepts Enter/attack interactions only at <= 1.4 cells
// (MiningChain3DFPV INTERACT_DIST). Stop just inside that radius so the
// final action is real while retaining a little camera clearance.
const SUBJECT_STANDOFF_CELLS = 1.2
const cameraCursorY = new WeakMap()

function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

// Turns to face the target, then walks straight at it — this is also the
// "move the camera to show what matters" beat: turning brings the
// boss/statue into frame before the character (and camera) advances on it.
async function approachTarget(page, spawn, target, label) {
  const dRow = target.row - spawn.row
  const dCol = target.col - spawn.col
  const dist = Math.hypot(dRow, dCol)
  // The player always spawns facing angle 0 (playerRef init, no angle field
  // in the seeded position) — angle 0 is +col (cos(0)=1, sin(0)=0), same
  // convention moveChunk below uses to advance row/col. So the turn needed
  // is just the bearing to the target, no state to track across reloads.
  const bearing = normalizeAngle(Math.atan2(dRow, dCol))
  console.log(`  → approaching ${label} (${dist.toFixed(1)} cells)`)
  const faceBearingDirectly = () => page.evaluate((angle) => {
    return window.__MM3_TRAILER_FACE_BEARING__?.(angle) === true
  }, bearing).catch(() => false)
  const bearingSetDirectly = await faceBearingDirectly()
  let bearingSet = bearingSetDirectly
  if (!bearingSetDirectly && Math.abs(bearing) > 0.05) {
    // Production may not yet contain the trailer hook. A trusted CDP touch
    // drag reaches the game's existing touch-look handler without focus or
    // pointer lock and rotates from the known spawn yaw (0) to the exact
    // authored frontal bearing.
    const cdp = await page.context().newCDPSession(page).catch(() => null)
    if (cdp) {
      const start = { x: 700, y: 400 }
      const endX = Math.max(1, Math.min(CAPTURE_SIZE.width - 2, start.x + bearing / 0.0048))
      try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 91 }] })
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: endX, y: start.y, id: 91 }] })
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        bearingSet = true
      } catch {}
      await cdp.detach().catch(() => {})
    }
  }
  if (target.isBoss) {
    // Bosses are spawned at melee distance. Any cinematic walk here lets
    // their server attack timer drain HP before the first player swing.
    await sleep(550)
    await nudgeCameraUp(page, target.cameraUpPixels || 0)
    await sleep(300)
    return
  }
  await sleep(550)
  if (!bearingSet && Math.abs(bearing) > 0.05) {
    const turnKey = bearing > 0 ? 'e' : 'q'
    await page.keyboard.down(turnKey)
    await sleep((Math.abs(bearing) / (GPU_CAPTURE ? GPU_TURN_SPD : SOFTWARE_TURN_SPD)) * 1000)
    await page.keyboard.up(turnKey)
  }
  if (target.cameraUpPixels) await nudgeCameraUp(page, Math.round(target.cameraUpPixels * 0.45))
  // Establishing footage begins only after yaw and pitch are composed; this
  // keeps tall nodes and faces in frame from the first usable clip frame.
  await sleep(target.preApproachHoldMs || 1_500)
  await sleep(1_800) // hold with the target in frame before walking in
  // Keep a little clearance instead of walking into the subject itself.
  const travelDist = Math.max(0, dist - (target.standoffCells ?? SUBJECT_STANDOFF_CELLS))
  if (travelDist > 0.2) {
    const moveSpeedCellsS = GPU_CAPTURE ? 1.2925 : (target.moveSpeedCellsS || MOVE_SPD_CELLS_S)
    const durMs = (travelDist / moveSpeedCellsS) * 1000
    // Split the walk into beats so the framing rises from torso to head as
    // perspective makes the nearby subject taller in frame.
    for (let part = 0; part < 3; part += 1) {
      await page.keyboard.down('w')
      await sleep(durMs / 3)
      await page.keyboard.up('w')
      // Reassert the authored frontal bearing after every movement beat.
      // This prevents small collision/physics drift from walking a statue's
      // face toward the edge of the frame.
      if (bearingSetDirectly) await faceBearingDirectly()
      if (target.cameraUpPixels) await nudgeCameraUp(page, Math.round(target.cameraUpPixels * 0.18))
    }
  }
  await sleep(900) // let movement acceleration/inertia settle before interacting
}

async function nudgeCameraUp(page, pixels) {
  if (!pixels) return
  const locked = await page.evaluate(() => Boolean(document.pointerLockElement)).catch(() => false)
  if (!locked) return
  const x = Math.round(CAPTURE_SIZE.width / 2)
  const currentY = cameraCursorY.get(page) ?? Math.round(CAPTURE_SIZE.height / 2)
  // Pointer-lock mouse deltas are applied at full cadence on the GPU path;
  // the old SwiftShader calibration was measured at only 1-3 render ticks/s.
  const effectivePixels = GPU_CAPTURE ? Math.round(Math.abs(pixels) * 0.20) : Math.abs(pixels)
  const automated = await page.evaluate((amount) => {
    return window.__MM3_TRAILER_NUDGE_CAMERA_UP__?.(amount) === true
  }, effectivePixels).catch(() => false)
  if (automated) {
    await sleep(180)
    return
  }
  const nextY = currentY - effectivePixels
  await page.mouse.move(x, nextY, { steps: 2 }).catch(() => {})
  cameraCursorY.set(page, nextY)
  await sleep(180)
}

async function setCameraPitch(page, pitch) {
  return page.evaluate((value) => {
    return window.__MM3_TRAILER_SET_CAMERA_PITCH__?.(value) === true
  }, pitch).catch(() => false)
}

async function setCinematicCamera(page, pose) {
  const applied = await page.evaluate((nextPose) => {
    return window.__MM3_TRAILER_SET_CINEMATIC_CAMERA__?.(nextPose) === true
  }, pose).catch(() => false)
  if (!applied) console.warn('  ! cinematic camera hook unavailable; keeping gameplay camera')
  await sleep(250)
  return applied
}

async function clearCinematicCamera(page) {
  await page.evaluate(() => window.__MM3_TRAILER_CLEAR_CINEMATIC_CAMERA__?.()).catch(() => {})
  await sleep(250)
}

async function playMapEntryAudio(page, mapId) {
  if (String(mapId) === '1') return
  // Called only after FFmpeg is live, so the first sample of every map
  // stinger/voice line belongs to the clip instead of the warm-up period.
  const started = await page.evaluate(() => {
    const play = window.__MM3_TRAILER_PLAY_MAP_ENTRY_AUDIO__
    if (typeof play !== 'function') return false
    play()
    return true
  }).catch(() => false)
  if (!started) console.warn(`  ! map ${mapId} entry audio hook was not ready`)
  await sleep(300)
}

async function holdSubjectBeautyShot(page, target) {
  const shots = target.beautyShots || (target.beautyShot ? [target.beautyShot] : [])
  if (!shots.length) return
  console.log(`  🎥 ${shots.length} cinematic frames: ${target.label}`)
  for (let index = 0; index < shots.length; index += 1) {
    const { holdMs, ...pose } = shots[index]
    if (!await setCinematicCamera(page, pose)) break
    // Let the cut settle before starting a long, clean section editors can use.
    await sleep(650)
    await sleep(holdMs || target.beautyHoldMs || 5_500)
  }
  await clearCinematicCamera(page)
}

async function approachChainNode(page, spawn, target) {
  const bearing = normalizeAngle(Math.atan2(target.row - spawn.row, target.col - spawn.col))
  await page.evaluate((angle) => window.__MM3_TRAILER_FACE_BEARING__?.(angle), bearing).catch(() => {})
  console.log('  🎥 Chain Node: vertical sweep from base to blade tip')

  // Begin below the hilt, then travel slowly to the top while still five
  // cells away. This makes the sword readable at its full authored height.
  const exactPitch = await setCameraPitch(page, 0.35)
  if (!exactPitch) {
    // Production fallback: the existing upward nudge still produces a clear
    // sweep, although only deployments with the trailer hook get exact ends.
    await sleep(1_000)
  }
  await sleep(1_300)
  for (let step = 1; step <= 18; step += 1) {
    if (exactPitch) await setCameraPitch(page, 0.35 + (-0.87 * step / 18))
    else await nudgeCameraUp(page, 18)
    await sleep(145)
  }
  await sleep(1_500)

  // Bottom-to-top establishes it; sweep back top-to-bottom too so the full
  // node reads in both directions before closing in on it. Only possible
  // with the exact-pitch hook — __MM3_TRAILER_NUDGE_CAMERA_UP__ clamps its
  // input to >= 0 by design (MiningChain3DFPV.jsx), it cannot look back
  // down, so the fallback path just holds on the top instead of faking it.
  if (exactPitch) {
    for (let step = 1; step <= 18; step += 1) {
      await setCameraPitch(page, -0.52 + (0.87 * step / 18))
      await sleep(145)
    }
  } else {
    await sleep(18 * 145)
  }
  await sleep(1_500)

  // Return the reticle to the interaction plane before approaching; looking
  // at the blade tip while pressing Enter cannot select the node cell.
  if (exactPitch) await setCameraPitch(page, 0.04)
  const livePositionAvailable = await page.evaluate(() => Boolean(window.__MM3_TRAILER_PLAYER_STATE__)).catch(() => false)
  await page.keyboard.down('w')
  if (livePositionAvailable) {
    const deadline = Date.now() + 8_000
    while (Date.now() < deadline) {
      const state = await page.evaluate(() => window.__MM3_TRAILER_PLAYER_STATE__?.()).catch(() => null)
      if (state && Math.hypot(target.col + 0.5 - state.gx, target.row + 0.5 - state.gy) <= 1.18) break
      await sleep(80)
    }
  } else {
    const distance = Math.hypot(target.row - spawn.row, target.col - spawn.col)
    const travelDist = Math.max(0, distance - SUBJECT_STANDOFF_CELLS)
    await sleep(travelDist / (GPU_CAPTURE ? 2.3 : (target.moveSpeedCellsS || MOVE_SPD_CELLS_S)) * 1000)
  }
  await page.keyboard.up('w')
  await page.evaluate((angle) => window.__MM3_TRAILER_FACE_BEARING__?.(angle), bearing).catch(() => {})
  if (exactPitch) await setCameraPitch(page, 0.02)
  await sleep(900)
}

// Every interact panel (chain node, RL node, boss statue tip, NFTJI market)
// is a full-screen backdrop <div onClick={close}> around a card that stops
// propagation — see MiningChain3D.jsx (handleRlMountPanelOpen,
// closeBossStatueTip, setShowChainSolve, setNftjiPanel). None of them need
// Escape: clicking any point outside the card closes it, and Enter to open
// them works regardless of pointer-lock state (only mouse-driven actions —
// swinging, dragging the camera — need the lock).
async function waitForMiningInteractionPanel(page, testId) {
  await page.waitForFunction((id) => {
    if (document.querySelector(`[data-testid="${id}"]`)) return true
    return [...document.querySelectorAll('div')].some((element) => {
      const style = element.style
      return style.position === 'absolute'
        && style.inset === '0px'
        && Number(style.zIndex) >= 60
        && /rgba\(0,\s*0,\s*0,\s*0\.9\)/.test(style.background || '')
    })
  }, testId, { timeout: 5_000 })
}

async function interact(page, label, { close = false } = {}) {
  console.log(`  ⏎ interacting: ${label}`)
  await page.keyboard.down('Enter')
  await sleep(150)
  await page.keyboard.up('Enter')
  const panelSelector = /chain node/i.test(label)
    ? '[data-testid="mm3-chain-interaction-panel"]'
    : /statue/i.test(label)
      ? '[data-testid="mm3-statue-interaction-panel"]'
      : null
  if (panelSelector) {
    await waitForMiningInteractionPanel(page, panelSelector.match(/"([^"]+)"/)?.[1])
  }
  await sleep(2500) // hold the panel on screen for the footage
  if (close) {
    await page.mouse.click(60, CAPTURE_SIZE.height - 60).catch(() => {}) // backdrop corner, clear of HUD chips
    await sleep(400)
  }
}

async function solveChainWithTrailerAnswer(page) {
  await interact(page, LANDMARKS.m1ChainNode.label)
  const panel = page.locator('[data-testid="mm3-chain-interaction-panel"]')
  await panel.waitFor({ state: 'visible', timeout: 5_000 })
  const input = panel.locator('input[type="number"]')
  if (await input.isVisible().catch(() => false)) {
    await input.fill('1')
    await sleep(900)
    const submit = input.locator('xpath=following-sibling::button[1]')
    await submit.click({ timeout: 5_000 })
    console.log('  ✓ submitted trailer formula answer: 1')
    await sleep(2_500)
  } else {
    // An existing bot may already have consumed its daily/lifetime attempt.
    // The requested ending is still the visibly opened formula panel.
    console.warn('  ! formula attempt unavailable for this bot; ending on the open formula')
    await sleep(1_500)
  }
}

// Same panel-open as interact(), but for the RL node specifically: click
// "BUY CAR" / "COMPRAR COCHE" before closing so the purchase actually shows
// on screen (seedProgress's balance covers the price).
async function interactAndBuyRlCar(page, label) {
  console.log(`  ⏎ interacting: ${label}`)
  await page.keyboard.down('Enter')
  await sleep(150)
  await page.keyboard.up('Enter')
  await sleep(1200) // let the panel render
  await waitForMiningInteractionPanel(page, 'mm3-rl-interaction-panel')
  const buyButton = page.getByRole('button', { name: /BUY CAR|COMPRAR COCHE/i })
  const bought = await buyButton.click({ timeout: 5000 }).then(() => true).catch(() => false)
  if (!bought) throw new Error('RL node: BUY CAR could not be completed')
  await sleep(2_000) // finish on the purchased/updated panel
}

async function submitRelayingCommand(page, command) {
  const input = page.locator('form input[maxlength="280"]')
  const submit = page.locator('button.mm3-irc-submit')
  await input.waitFor({ state: 'visible', timeout: 12_000 })
  await input.fill(command)
  await sleep(700) // make the typed command readable in the clip
  const enabled = await submit.isEnabled().catch(() => false)
  if (!enabled) throw new Error(`Relaying SEND stayed disabled for ${command}`)
  await submit.click()
  await sleep(3_000) // hold the terminal response
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('*')) {
      if (element.scrollHeight > element.clientHeight + 8) element.scrollTop = element.scrollHeight
    }
  }).catch(() => {})
  await sleep(700)
}

async function buyNftjiThroughRelaying(page, target) {
  console.log(`  ◈ opening NFTJI purchase flow: ${target.label}`)
  await interact(page, target.label)

  const buyLink = page.locator('a').filter({ hasText: /^\/buy\s+#[0-9A-F]{3}$/i }).first()
  const linkVisible = await buyLink.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false)
  const buyCommand = linkVisible
    ? (await buyLink.textContent({ timeout: 1_000 }).catch(() => ''))?.trim()
    : `/buy ${target.blockHex}`

  const blockHex = buyCommand.match(/#[0-9A-F]{3}/i)?.[0]?.toUpperCase()
  const marketCommand = target.marketCommand || await page.evaluate(async ({ wallet, hex }) => {
    const response = await fetch(`/api/mining-snapshot?details=1&wallet=${encodeURIComponent(wallet)}`, { cache: 'no-store' })
    const data = await response.json()
    const index = Number.parseInt(String(hex).replace('#', ''), 16)
    const row = Math.floor(index / 28)
    const col = index % 28
    return data.blocks?.find((block) => Number(block.grid_row) === row && Number(block.grid_col) === col)?.market_command || null
  }, { wallet: TRAILER_WALLET, hex: blockHex })

  console.log(`  → navigating to Relaying with ${buyCommand}`)
  if (linkVisible) {
    await Promise.all([
      page.waitForURL(/\/relaying/, { timeout: 20_000 }),
      buyLink.click(),
    ])
  } else {
    // Some procedural maze configurations occlude the 3D interaction ray
    // even from an adjacent reserved cell. Continue the exact link flow the
    // panel would have opened, so the real Relaying purchase is still shown.
    console.warn('  ! NFTJI panel ray was occluded; continuing through its real Relaying command URL')
    await page.goto(`${BASE_URL}/relaying?command=${encodeURIComponent(buyCommand)}`, { waitUntil: 'domcontentloaded' })
  }
  await sleep(2_500)
  await submitRelayingCommand(page, buyCommand)

  if (marketCommand) {
    const executableCommand = marketCommand.split('=>')[0].trim()
    console.log(`  → executing NFTJI command: ${executableCommand}`)
    await submitRelayingCommand(page, executableCommand)
  } else {
    console.warn(`  ! ${blockHex} has no market_command; purchase completed without a follow-up command`)
  }
  await sleep(2_000) // end on the completed Relaying flow
}

// A plain mouse click while pointer-locked swings the USB-staff melee
// weapon (handlePointerDown, MiningChain3DFPV.jsx) — that's the whole
// attack input, no separate key. Standing in a boss's attack range and
// trading hits eventually gets the player killed by its own counter-attack
// (deadUntil/respawn system). This is the one clip that genuinely needs
// pointer lock (a click without it just re-requests the lock and swings
// nothing), which is why it goes first in the clip order — right after the
// one navigation (Home → Mining) that has reliably granted it every time.
async function fightBossToDeath(page, label, timeoutMs = 45_000) {
  console.log(`  ⚔ engaging ${label} in melee...`)
  const center = { x: CAPTURE_SIZE.width / 2, y: CAPTURE_SIZE.height / 2 }
  const canvas = page.locator('canvas.mm3-fpv-overlay-canvas')
  const locked = await page.evaluate(() => Boolean(document.pointerLockElement)).catch(() => false)
  if (!locked) {
    const box = await canvas.boundingBox().catch(() => null)
    await page.mouse.click(
      box ? box.x + box.width / 2 : center.x,
      box ? box.y + box.height / 2 : center.y,
    ).catch(() => {})
    await page.waitForFunction(() => Boolean(document.pointerLockElement), null, { timeout: 4_000 }).catch(() => {})
    await sleep(500) // the lock-acquiring click is not an attack
  }

  // Aim attacks at the torso/head, not the floor or pedestal. Trump is a
  // low crawler, so he needs less lift than the upright Putin/Kim rigs.
  await nudgeCameraUp(page, /Trump/i.test(label) ? 8 : 18)

  // The HUD rounds grid coordinates, while hit testing uses exact floats.
  // A nominal 2-cell spawn can therefore sit a few tenths outside melee
  // range even though the boss fills the crosshair. Close that last fraction
  // while the boss is still WAITING, then begin the attack loop.
  await page.keyboard.down('w')
  await sleep(GPU_CAPTURE ? 450 : 2_400)
  await page.keyboard.up('w')
  await sleep(250)

  const checkDied = () => page.evaluate(() => {
    try {
      const death = JSON.parse(localStorage.getItem('mm3_pvp_dead') || 'null')
      return Number(death?.until) > Date.now()
    } catch { return false }
  }).catch(() => false)

  const end = Date.now() + timeoutMs
  let died = false
  let swings = 0
  let targetedSwings = 0
  let firstTargetDeadline = Date.now() + 5_000
  // "Ends up dead" is the required outcome (retried by recordClipWithRetries
  // otherwise) — the RL car exception this always eventually resolves to
  // death within one story beat, unless the wallet is genuinely fast enough
  // to clear the boss's aggro range, which the overall 45s budget still
  // gives room for.
  const FLEE_AFTER_SWINGS = 5
  const FLEE_MS = 5_000
  const attackButton = page.getByRole('button', { name: /Attack or mine|Atacar o minar/i }).first()
  while (Date.now() < end) {
    // Dispatch through the game's explicit HIT control. Physical clicks under
    // pointer-lock work for Putin/Kim but Chromium/Xvfb occasionally drops
    // them for Trump's low sculpt; both paths call the same triggerAttack().
    const automationResult = await page.evaluate(() => window.__MM3_TRAILER_ATTACK__?.() || null).catch(() => null)
    if (automationResult?.target) targetedSwings += 1
    const buttonExists = await attackButton.count().catch(() => 0)
    if (!automationResult && buttonExists) {
      await attackButton.dispatchEvent('pointerdown', { pointerType: 'touch', button: 0 }).catch(() => {})
      await attackButton.dispatchEvent('pointerup', { pointerType: 'touch', button: 0 }).catch(() => {})
    } else if (!automationResult) {
      await page.mouse.click(center.x, center.y).catch(() => {})
    }
    swings += 1
    if (!targetedSwings && Date.now() >= firstTargetDeadline) {
      throw new Error(`${label}: crosshair never acquired the boss during the first 5s`)
    }
    died = await checkDied()
    if (died) break

    if (swings === FLEE_AFTER_SWINGS) {
      // Attacked enough to show a real exchange — now turn tail. The boss's
      // own attack timer keeps running regardless of what the player does,
      // so this doesn't pause the countdown to death, it just changes what
      // the camera shows while that countdown finishes.
      console.log(`  🏃 fleeing ${label}...`)
      await page.keyboard.down('s')
      const fleeEnd = Math.min(end, Date.now() + FLEE_MS)
      while (Date.now() < fleeEnd) {
        died = await checkDied()
        if (died) break
        await sleep(200)
      }
      await page.keyboard.up('s')
      if (died) break
      console.log(`  → still alive after fleeing ${label} — resuming the attack`)
    }
    await sleep(550) // ~one swing cycle (SWING_DUR is 480ms)
  }
  if (!died) throw new Error(`${label}: player did not die within ${timeoutMs / 1000}s`)
  if (!targetedSwings) throw new Error(`${label}: no confirmed melee hit was aimed at the boss`)
  if (swings < 2) throw new Error(`${label}: death happened before a visible attack exchange`)
  console.log(`  ☠ player killed by ${label} after ${swings} attacks`)
  await sleep(2_000) // finish on the death/respawn visual
}

// One-time session setup: cookies/wallet/session + music off. Position
// isn't set here — each clip seeds its own via gotoMiningAt.
async function initSession(page, wallet) {
  const token = createSessionToken(wallet)
  await page.goto(`${BASE_URL}/`, { waitUntil: 'commit', timeout: 45_000 })
  await page.evaluate(({ w, t }) => {
    localStorage.setItem('mm3_cookies_accepted', 'true')
    localStorage.setItem('mm3_cookies_accepted_at', new Date().toISOString())
    localStorage.setItem('mm3_gw', w)
    localStorage.setItem('mm3_session', JSON.stringify({ wallet: w, token: t }))
    // Music and SFX are independent switches (lib/sound-context.js). Music
    // stays off — added separately in editing; SFX stays on (its own
    // switch, untouched here) and gets captured live.
    localStorage.setItem('mm3-music-enabled', 'false')
  }, { w: wallet, t: token })
  await page.reload({ waitUntil: 'commit', timeout: 45_000 }).catch(() => {})
  await page.waitForSelector('[data-testid="mm3-auth-connected"]', { timeout: 15_000 }).catch(() => {
    console.warn('  ! connected chip not detected — continuing anyway')
  })
}

async function zoomBrowserOut(page, steps = 2) {
  if (!PROTECT_GPU_WINDOW) await page.bringToFront().catch(() => {})
  await page.keyboard.press('Control+0').catch(() => {})
  for (let step = 0; step < steps; step += 1) {
    await page.keyboard.press('Control+-').catch(() => {})
    await sleep(180)
  }
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })).catch(() => null)
  console.log(`Browser zoom: ${steps} steps out${viewport ? ` → ${viewport.width}×${viewport.height} CSS px` : ''}`)
}

async function switchSessionWallet(page, wallet) {
  const token = createSessionToken(wallet)
  await page.evaluate(({ w, t }) => {
    localStorage.setItem('mm3_gw', w)
    localStorage.setItem('mm3_session', JSON.stringify({ wallet: w, token: t }))
    localStorage.removeItem('mm3_pvp_dead')
  }, { w: wallet, t: token })
  console.log(`Using gameplay wallet ${wallet.slice(0, 8)}…${wallet.slice(-4)}`)
}

async function waitForHomeLoaded(page) {
  console.log('Home: waiting for the polygon and 3D showcase to finish loading...')
  // --app creates a Chromium surface of its own. Keep Playwright's Home page
  // above it before Xvfb/ffmpeg starts, otherwise DOM checks can observe Home
  // while the pixels being captured belong to a different browser window.
  if (!PROTECT_GPU_WINDOW) await page.bringToFront().catch(() => {})
  await page.waitForSelector('.mm3-nonagon-side', { timeout: 20_000 })
  await page.waitForSelector('canvas.mm3-home-arena-canvas', { timeout: 20_000 })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas.mm3-home-arena-canvas')
    const centerName = document.querySelector('[data-testid="mm3-portal-center-name"]')
    return canvas?.width > 0 && canvas?.height > 0 && centerName?.textContent?.trim()
  }, null, { timeout: 20_000 })
  // Trailer-lite GLBs are 60–75% smaller than the originals. Keep a short
  // warm-up outside FFmpeg so the first recorded frame is still complete.
  await sleep(6_000)
  if (!PROTECT_GPU_WINDOW) await page.bringToFront().catch(() => {})
}

async function progressivelyScrollPage(page) {
  let stableAtBottom = 0
  for (let step = 0; step < 240 && stableAtBottom < 3; step += 1) {
    const state = await page.evaluate(() => {
      const candidates = [document.scrollingElement, ...document.querySelectorAll('*')].filter(Boolean)
      const scrollables = candidates.filter((element) => {
        const style = getComputedStyle(element)
        return element.scrollHeight > element.clientHeight + 24
          && (element === document.scrollingElement || /(auto|scroll)/.test(style.overflowY))
      })
      let moved = false
      for (const element of scrollables) {
        const before = element.scrollTop
        const amount = Math.max(180, Math.round(element.clientHeight * 0.72))
        element.scrollTo({ top: Math.min(element.scrollHeight, before + amount), behavior: 'smooth' })
        if (element.scrollTop < element.scrollHeight - element.clientHeight - 4) moved = true
      }
      return { hasScrollable: scrollables.length > 0, moved }
    }).catch(() => ({ hasScrollable: false, moved: false }))
    if (!state.hasScrollable) return
    stableAtBottom = state.moved ? 0 : stableAtBottom + 1
    await sleep(260)
  }
  await sleep(900)
}

// One integrated pass instead of two disconnected ones (a silent sound-only
// hover sweep, then a fixed URL list unrelated to which side that was).
// This reads the actual polygon side order from data-portal-href (set by
// LandingHero.jsx on each .mm3-nonagon-side <g>) and, as each side comes up,
// really enters it the way a user would: hover first (fires playNavTick —
// lib/sound-context.js, "the nav tick only plays on manual hover", which is
// why the earlier auto-rotation phase stays silent on purpose), then a
// second click on the now-selected side navigates in (LandingHero's onClick:
// first click selects, second click on an already-selected side pushes the
// route). Mining is pulled out of its natural position and saved for last —
// it's not just another section, it's where the following clips pick up.
async function enterPolygonSidesInOrder(page) {
  const sideHrefs = await page.locator('.mm3-nonagon-side').evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute('data-portal-href')).filter(Boolean),
  ).catch(() => [])
  if (!sideHrefs.length) {
    console.warn('  ! no polygon sides found — falling back to a plain /mining navigation')
    await page.goto(`${BASE_URL}/mining`, { waitUntil: 'commit', timeout: 45_000 }).catch(() => {})
    await sleep(3_000)
    return
  }
  const orderedHrefs = [...sideHrefs.filter((href) => href !== '/mining'), '/mining']
  console.log(`Home: entering each side in order (${orderedHrefs.join(' → ')})...`)
  for (const href of orderedHrefs) {
    const side = page.locator(`.mm3-nonagon-side[data-portal-href="${href}"]`)
    const box = await side.boundingBox().catch(() => null)
    if (box) {
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      await page.mouse.move(point.x, point.y, { steps: 5 }).catch(() => {}) // selects the side + audible nav tick
      await sleep(900)
      await page.mouse.click(point.x, point.y).catch(() => {}) // already selected → navigates
    }
    const navigated = await page.waitForURL((url) => url.pathname === href, { timeout: 8_000 }).then(() => true).catch(() => false)
    if (!navigated) {
      console.warn(`  ! clicking the ${href} side did not navigate — going there directly`)
      await page.goto(`${BASE_URL}${href}`, { waitUntil: 'commit', timeout: 45_000 }).catch(() => {})
    }
    await sleep(3_000) // hold the section on screen
    await progressivelyScrollPage(page)
    if (href === '/mining') break // last one — stay here for the mining clips that follow
    await page.goto(`${BASE_URL}/`, { waitUntil: 'commit', timeout: 45_000 }).catch(() => {})
    await page.waitForSelector('.mm3-nonagon-side', { timeout: 20_000 }).catch(() => {})
    await sleep(1_500) // brief hold back on the polygon before the next side
  }
}

// Seeds the wallet's stored position at the clip's target and (re)loads
// /mining so it spawns right there — no walking needed between clips.
async function gotoMiningAt(page, supabase, wallet, mapId, row, col, { fastCombat = false } = {}) {
  // MiningChain3D restores localStorage immediately, then /api/pvp-death
  // restores the DB position a moment later. Seeding only localStorage made
  // every named shot snap back to the throwaway wallet's old M1 position,
  // which is why M2-M5 recordings all showed the same rocks. Keep both
  // sources in sync before navigation so the camera really starts here.
  await ensureHealth(supabase, wallet, 100, {
    last_pos_row: row,
    last_pos_col: col,
    last_pos_z: 0,
    last_pos_map_id: String(mapId),
    pvp_dead_until: null,
  })
  await page.evaluate(({ posKey, pos }) => {
    localStorage.removeItem('mm3_pvp_dead')
    localStorage.setItem(posKey, JSON.stringify(pos))
  }, { posKey: `mm3_mining_pos_${wallet}`, pos: { row, col, z: 0, mapId } })
  const onMining = /\/mining/.test(page.url())
  const nav = onMining
    ? page.reload({ waitUntil: 'commit', timeout: 45_000 })
    : page.goto(`${BASE_URL}/mining`, { waitUntil: 'commit', timeout: 45_000 })
  await nav.catch((err) => console.warn(`  ! navigation to mining failed (${err.message})`))
  await page.waitForSelector('[data-testid="mm3-auth-connected"]', { timeout: 15_000 }).catch(() => {})
  await page.evaluate(() => {
    window.__MM3_TRAILER_GATE_OBSERVER__?.disconnect?.()
    const hidePlayGate = () => {
      const explicit = document.querySelector('[data-testid="mm3-play-gate"]')
      if (explicit) explicit.style.setProperty('display', 'none', 'important')
      for (const element of document.querySelectorAll('.mm3-desktop-only')) {
        if (/CLICK TO PLAY|HAZ CLIC PARA JUGAR/i.test(element.textContent || '')) {
          element.style.setProperty('display', 'none', 'important')
          element.dataset.mm3TrailerGateHidden = 'true'
        }
      }
    }
    hidePlayGate()
    const observer = new MutationObserver(hidePlayGate)
    observer.observe(document.documentElement, { childList: true, subtree: true })
    window.__MM3_TRAILER_GATE_OBSERVER__ = observer
  }).catch(() => {})
  // Close-range boss spawns cannot sit idle here: the boss engage timer is
  // already running and would kill the player before FFmpeg starts. Regular
  // scenic clips retain the full asset warm-up.
  await sleep(fastCombat ? 700 : 6_000)
  if (!PROTECT_GPU_WINDOW) await page.bringToFront().catch(() => {})
  // locator.click() scrolls the canvas into view. Here that shifted the page
  // about 140px mid-shot: the header disappeared and a black band appeared
  // below. A physical click at the measured canvas centre does not auto-scroll.
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {})
  const canvasBox = await page.locator('canvas.mm3-fpv-overlay-canvas').boundingBox().catch(() => null)
  const clickPoint = canvasBox
    ? { x: canvasBox.x + canvasBox.width / 2, y: canvasBox.y + canvasBox.height / 2 }
    : { x: CAPTURE_SIZE.width / 2, y: CAPTURE_SIZE.height / 2 }
  const trailerAutomation = await page.evaluate(() => window.__MM3_TRAILER_AUTOMATION__ === true).catch(() => false)
  const playGate = page.getByText(/CLICK TO PLAY|HAZ CLIC PARA JUGAR/i)
  if (!trailerAutomation) {
    await page.mouse.click(clickPoint.x, clickPoint.y).catch(() => {})
    if (await playGate.isVisible().catch(() => false)) {
      await page.mouse.click(clickPoint.x, clickPoint.y).catch(() => {})
    }
  }
  // The deployed portal may predate the trailer-automation hook. Remove only
  // the pointer-lock CTA overlay from captured pixels; keyboard/touch/CDP
  // controls remain active and normal users never run this recorder code.
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('.mm3-desktop-only')) {
      if (/CLICK TO PLAY|HAZ CLIC PARA JUGAR/i.test(element.textContent || '')) {
        element.style.setProperty('display', 'none', 'important')
        element.dataset.mm3TrailerGateHidden = 'true'
      }
    }
  }).catch(() => {})
  await playGate.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {
    console.warn('  ! CLICK TO PLAY gate remained visible before capture')
  })
  cameraCursorY.set(page, clickPoint.y)
  await sleep(fastCombat ? 450 : 3_500)
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {})
  await sleep(300)
}

const AERIAL_MAP_SHOTS = Object.freeze([
  { mapId: '1', label: 'Speculation Plaza', pose: { x: -8, y: 61, z: 72, targetX: 28, targetY: 0, targetZ: 28, fov: 54 } },
  { mapId: '2', label: 'Frost Coliseum', pose: { x: 67, y: 59, z: 69, targetX: 28, targetY: 0, targetZ: 27, fov: 55 } },
  { mapId: '3', label: 'Peach Castle', pose: { x: -9, y: 60, z: -7, targetX: 28, targetY: 0, targetZ: 28, fov: 55 } },
  { mapId: '4', label: 'Desert Oasis', pose: { x: 69, y: 58, z: -8, targetX: 28, targetY: 0, targetZ: 28, fov: 55 } },
  { mapId: '5', label: 'Mystic Isle', pose: { x: -8, y: 62, z: 70, targetX: 28, targetY: 0, targetZ: 28, fov: 55 } },
])

// Capture each loaded map independently, then join the clean takes into one
// deliverable. This avoids recording reload screens between aerial views.
async function recordAerialTourClip(page, outDir, supabase, wallet) {
  const name = '13-mining-aerial-all-maps'
  const parts = []
  console.log(`\n=== Clip: ${name} ===`)
  try {
    for (let index = 0; index < AERIAL_MAP_SHOTS.length; index += 1) {
      const shot = AERIAL_MAP_SHOTS[index]
      console.log(`  🚁 aerial map ${shot.mapId}: ${shot.label}`)
      await gotoMiningAt(page, supabase, wallet, shot.mapId, 27, 8)
      await page.waitForFunction(() => (
        typeof window.__MM3_TRAILER_SET_CINEMATIC_CAMERA__ === 'function'
      ), null, { timeout: 12_000 })
      if (!await setCinematicCamera(page, shot.pose)) {
        throw new Error(`aerial camera unavailable on map ${shot.mapId}`)
      }
      const partPath = resolve(outDir, `.${name}-${index + 1}.mp4`)
      let ffmpeg = null
      try {
        ffmpeg = await startFfmpegCapture(page, partPath)
        await playMapEntryAudio(page, shot.mapId)
        await sleep(5_500)
        // A second angle creates motion through an actual camera cut while
        // retaining the complete map and its skyline decorations in frame.
        if (!await setCinematicCamera(page, {
          ...shot.pose,
          x: 56 - shot.pose.x,
          z: 56 - shot.pose.z,
        })) throw new Error(`second aerial angle unavailable on map ${shot.mapId}`)
        await sleep(4_500)
      } finally {
        await stopFfmpegCapture(ffmpeg)
      }
      const probe = spawnSync(BIN.ffprobe, [
        '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', partPath,
      ], { encoding: 'utf8' })
      const duration = Number.parseFloat(probe.stdout || '')
      if (probe.status !== 0 || !Number.isFinite(duration) || duration < 8) {
        throw new Error(`invalid aerial segment for map ${shot.mapId} (${duration || 0}s)`)
      }
      parts.push(partPath)
      await clearCinematicCamera(page)
    }
    const manifestPath = resolve(outDir, `.${name}-concat.txt`)
    writeFileSync(manifestPath, parts.map((part) => `file '${part.replaceAll("'", "'\\''")}'`).join('\n'))
    const joinedPath = resolve(outDir, `${name}.mp4`)
    const joined = spawnSync(BIN.ffmpeg, [
      '-y', '-f', 'concat', '-safe', '0', '-i', manifestPath,
      '-fflags', '+genpts', '-avoid_negative_ts', 'make_zero',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', joinedPath,
    ], { encoding: 'utf8' })
    if (joined.status !== 0) throw new Error(`aerial concat failed: ${(joined.stderr || '').trim()}`)
    const finalProbe = spawnSync(BIN.ffprobe, [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', joinedPath,
    ], { encoding: 'utf8' })
    const finalDuration = Number.parseFloat(finalProbe.stdout || '')
    if (finalProbe.status !== 0 || !Number.isFinite(finalDuration) || finalDuration < 40) {
      throw new Error(`joined aerial clip is invalid (${finalDuration || 0}s)`)
    }
    unlinkSync(manifestPath)
    for (const part of parts) unlinkSync(part)
  } catch (error) {
    await clearCinematicCamera(page)
    throw error
  }
}

async function visitRelayingPage(page) {
  console.log('Visiting Relaying — sending a live message...')
  await page.goto(`${BASE_URL}/relaying`, { waitUntil: 'commit', timeout: 45_000 }).catch((err) => {
    console.warn(`  ! could not navigate to /relaying (${err.message})`)
  })
  await sleep(3_000) // let the terminal mount + wallet/relay-ready state settle
  // Stable selectors: no data-testid on this form, but maxLength=280 on the
  // one input and the mm3-irc-submit class on the one submit button are
  // both unique to it (RelayingTerminal.jsx).
  const input = page.locator('form input[maxlength="280"]')
  const submit = page.locator('button.mm3-irc-submit')
  await input.click({ timeout: 5_000 }).catch(() => {})
  await input.fill('gm from the trailer bot 🤖').catch(() => {})
  await sleep(400)
  const sent = await submit.click({ timeout: 5_000 }).then(() => true).catch(() => false)
  if (!sent) throw new Error('Relaying SEND stayed unavailable')
  await sleep(2_500) // hold the sent message on screen for the footage
}

// Board.jsx's game controls all carry stable, English-only aria-labels
// ("Start game", "Next round", "Answer: {choice}") independent of the
// visible/translated button text — no need to juggle locale here.
async function visitTrainingPage(page) {
  console.log('Visiting Training — playing a few rounds...')
  await page.goto(`${BASE_URL}/training`, { waitUntil: 'commit', timeout: 45_000 }).catch((err) => {
    console.warn(`  ! could not navigate to /training (${err.message})`)
  })
  await sleep(3_000) // let the board mount + wallet/slot state settle

  const started = await page.getByRole('button', { name: 'Start game' })
    .click({ timeout: 8_000 }).then(() => true).catch(() => false)
  if (!started) {
    throw new Error('Training could not start (board unavailable or no daily slots)')
  }
  await sleep(3_500) // pre-game countdown (3-2-1) before the first problem

  // The correct choice isn't exposed anywhere in the DOM (problem.answer is
  // internal React state — Board.jsx:2283), so there's no way to deliberately
  // pick right vs. wrong ahead of time. Picking a random choice among the
  // options each round is the closest available proxy: across a few rounds
  // it naturally lands on both the correct-flash and wrong-flash states,
  // which is what actually needs to be visible on screen.
  const ROUNDS = 3
  for (let i = 0; i < ROUNDS; i += 1) {
    const answers = page.getByRole('button', { name: /^Answer:/ })
    const count = await answers.count().catch(() => 0)
    if (count === 0) break
    await answers.nth(randomInt(count)).click({ timeout: 6_000 })
    await sleep(1_100) // hold the correct/wrong flash on screen
    const nextRound = page.getByRole('button', { name: 'Next round' })
    if (await nextRound.count().catch(() => 0)) {
      await nextRound.click({ timeout: 5_000 }).catch(() => {})
      await sleep(1_000)
    }
  }
  await sleep(1_500)
}

// approach is a spawn OFFSET (added to row/col to get the spawn point), not
// a distance to travel — small (3-4 cells) and, for the arena-bound ones
// (RL node, the M3-M5 bosses), kept on the same row/col as the target so
// the whole approach stays on the compass-gap line already known to be
// clear. The open plazas (Milei, Zelensky, market, Macron) tolerate any
// direction since there's nothing to clip nearby.
const LANDMARKS = {
  // Hold a wide, slightly raised establishing frame before approaching. At
  // melee distance the sword is taller than the viewport, so the wide beat
  // is what guarantees the complete node (blade, hilt and base) is visible.
  m1ChainNode: {
    row: MINING_CHAIN_NODE_POSITION.row,
    col: MINING_CHAIN_NODE_POSITION.col,
    label: 'M1 chain node',
    approach: { dRow: 0, dCol: -5 },
    preApproachHoldMs: 6_500,
    cameraUpPixels: 320,
    moveSpeedCellsS: 0.24,
    chainCinematic: true,
    beautyShots: [
      // Whole colosseum and full sword silhouette.
      { x: 12, y: 13, z: 43, targetX: 27.5, targetY: 3.8, targetZ: 27.5, fov: 52, holdMs: 6_000 },
      // Closer full-node view: base, hilt and blade tip remain inside frame.
      { x: 20, y: 7.2, z: 35, targetX: 27.5, targetY: 4.0, targetZ: 27.5, fov: 50, holdMs: 6_000 },
    ],
  },
  // Keep these in sync with the exported positions in lib/m1-*-statue.js,
  // lib/m2-macron-statue.js, lib/mining-rl-mount.js and lib/m*-boss.js.
  // Those frontend modules use extensionless imports understood by Next but
  // not by a directly executed Node ESM script, so they cannot be imported.
  // Player angle starts at 0 (+col/east). Spawning west of each subject means
  // it is already straight ahead: no frame-rate-sensitive timed turn, and
  // these centre-row approaches avoid the arenas' walls and scenery.
  // Milei and Zelensky face M1's chain centre; approach along that facing
  // vector so their face/body—not the back of the sculpt—fills the shot.
  m1Milei: {
    row: 10, col: 44, label: 'Milei statue', approach: { dRow: 3, dCol: -3 }, cameraUpPixels: 118, moveSpeedCellsS: 0.11, preApproachHoldMs: 3_500,
    beautyShots: [
      { x: 39, y: 2.7, z: 16, targetX: 44.5, targetY: 1.25, targetZ: 10.5, fov: 47, holdMs: 5_500 },
      { x: 41.3, y: 2.05, z: 13.7, targetX: 44.5, targetY: 1.15, targetZ: 10.5, fov: 43, holdMs: 6_500 },
    ],
  },
  m1Zelensky: {
    row: 44, col: 11, label: 'Zelensky statue', approach: { dRow: -3, dCol: 3 }, cameraUpPixels: 118, moveSpeedCellsS: 0.11, preApproachHoldMs: 3_500,
    beautyShots: [
      { x: 17, y: 2.7, z: 38, targetX: 11.5, targetY: 1.25, targetZ: 44.5, fov: 47, holdMs: 5_500 },
      { x: 14.7, y: 2.05, z: 40.7, targetX: 11.5, targetY: 1.15, targetZ: 44.5, fov: 43, holdMs: 6_500 },
    ],
  },
  // Macron's authored yaw faces north on M2.
  m2Macron: {
    row: 50, col: 25, label: 'Macron statue', approach: { dRow: -4, dCol: 0 }, cameraUpPixels: 118, moveSpeedCellsS: 0.11, preApproachHoldMs: 3_500,
    beautyShots: [
      { x: 20, y: 2.8, z: 43, targetX: 25.5, targetY: 1.25, targetZ: 50.5, fov: 47, holdMs: 5_500 },
      { x: 22.7, y: 2.05, z: 46.7, targetX: 25.5, targetY: 1.15, targetZ: 50.5, fov: 43, holdMs: 6_500 },
    ],
  },
  // A longer establishing view lets the autonomous RL cars race/jump before
  // the player enters the node's purchase radius.
  m2RlNode: {
    row: 27, col: 27, label: 'M2 RL node (Frost Coliseum)', approach: { dRow: 0, dCol: -10 },
    preApproachHoldMs: 12_000, cameraUpPixels: 42, moveSpeedCellsS: 0.14,
    // High diagonal keeps the node readable while revealing both seating
    // bowls, banners, arches, fountain and the racing RL cars.
    beautyShots: [
      { x: 6, y: 25, z: 48, targetX: 28, targetY: 1.6, targetZ: 27, fov: 58, holdMs: 7_000 },
      { x: 18, y: 7.5, z: 37, targetX: 27.5, targetY: 2.2, targetZ: 27.5, fov: 50, holdMs: 6_500 },
      { x: 23, y: 3.4, z: 32, targetX: 27.5, targetY: 1.45, targetZ: 27.5, fov: 45, holdMs: 6_500 },
    ],
  },
  m3Putin: {
    row: 35, col: 27, label: 'Putin boss', approach: { dRow: 0, dCol: -2 }, cameraUpPixels: 94, standoffCells: 1.75, isBoss: true,
    beautyShots: [
      { x: 22, y: 2.8, z: 29, targetX: 27.5, targetY: 1.35, targetZ: 35.5, fov: 48, holdMs: 4_500, followBoss: true },
      { x: 24.6, y: 2.15, z: 32.1, targetX: 27.5, targetY: 1.25, targetZ: 35.5, fov: 43, holdMs: 5_500, followBoss: true },
    ],
  },
  m4Kim: {
    row: 28, col: 28, label: 'Kim boss', approach: { dRow: 0, dCol: -2 }, cameraUpPixels: 94, standoffCells: 1.75, isBoss: true,
    beautyShots: [
      { x: 23, y: 2.7, z: 22, targetX: 28.5, targetY: 1.25, targetZ: 28.5, fov: 48, holdMs: 4_500, followBoss: true },
      { x: 25.5, y: 2.1, z: 25, targetX: 28.5, targetY: 1.2, targetZ: 28.5, fov: 43, holdMs: 5_500, followBoss: true },
    ],
  },
  m5Trump: {
    row: 27, col: 27, label: 'Trump boss', approach: { dRow: 0, dCol: -2 }, cameraUpPixels: 44, standoffCells: 1.75, isBoss: true,
    beautyShots: [
      { x: 22, y: 2.25, z: 21, targetX: 27.5, targetY: 0.9, targetZ: 27.5, fov: 48, holdMs: 3_500, followBoss: true },
      { x: 24.2, y: 1.65, z: 23.6, targetX: 27.5, targetY: 0.82, targetZ: 27.5, fov: 43, holdMs: 4_000, followBoss: true },
    ],
  },
  m1NodeDice: {
    row: NODE_DICE_POSITION.row,
    col: NODE_DICE_POSITION.col,
    label: 'M1 Node Dice and Cipher House rooftop',
    approach: { dRow: 3, dCol: 0 },
    beautyShots: [
      { x: 20, y: 13.5, z: 17, targetX: 11.5, targetY: 6.6, targetZ: 7.5, fov: 52, holdMs: 7_000 },
      { x: 16.5, y: 10.8, z: 12.5, targetX: 11.5, targetY: 7.25, targetZ: 6.5, fov: 45, holdMs: 7_000 },
    ],
    beautyOnly: true,
  },
}

async function findPurchasableNftjiTarget(supabase) {
  const [{ data: blocks, error: blocksError }, { data: mined, error: minedError }, { data: owners }, { data: token }] = await Promise.all([
    supabase.from('mm3_mining_blocks').select('block_key,grid_row,grid_col,price_eur,market_command,is_active').eq('is_active', true),
    supabase.from('mm3_mined_blocks').select('block_hex'),
    supabase.from('player_progress').select('mining_nftji_key').not('mining_nftji_key', 'is', null),
    supabase.from('token_value').select('total_eth').limit(1).maybeSingle(),
  ])
  if (blocksError) throw new Error(`load NFTJI blocks: ${blocksError.message}`)
  if (minedError && minedError.code !== '42P01') throw new Error(`load mined blocks: ${minedError.message}`)

  const takenHexes = new Set((mined || []).map(({ block_hex }) => String(block_hex).toUpperCase()))
  const ownedKeys = new Set((owners || []).map(({ mining_nftji_key }) => mining_nftji_key).filter(Boolean))
  const globalMm3 = Number(Number(token?.total_eth || 0).toFixed(2))
  const mm3PaymentKeys = new Set(['mm3-01d', 'mm3-04a', 'mm3-091', 'mm3-0f8', 'mm3-15c', 'mm3-1a6', 'mm3-20b', 'mm3-29b', 'mm3-2da', 'mm3-2f9'])
  const candidates = (blocks || [])
    .filter((block) => block.grid_row != null && block.grid_col != null && !ownedKeys.has(block.block_key))
    .map((block) => {
      const row = Number(block.grid_row)
      const col = Number(block.grid_col)
      const index = row * 28 + col
      const hex = `#${index.toString(16).toUpperCase().padStart(3, '0')}`
      const progress = index / 999
      const minLevel = Math.round(progress * 100)
      const magnitude = Number((progress * 100).toFixed(2))
      const requiredMm3 = index === 0 ? 0 : (index % 2 === 1 ? magnitude : -magnitude)
      return { ...block, row, col, index, hex, minLevel, requiredMm3 }
    })
    .filter((block) => block.col >= 4 && !takenHexes.has(block.hex) && block.minLevel <= 55)
    .filter((block) => block.requiredMm3 < 0 ? globalMm3 <= block.requiredMm3 : globalMm3 >= block.requiredMm3)
    // MM3-payment NFTJIs cannot be bought while the global value is
    // negative (available MM3 is max(0, global - sold)). Prefer a money
    // NFTJI, which the seeded EUR/USD/CNY balances comfortably cover.
    .filter((block) => !mm3PaymentKeys.has(block.block_key) || Math.max(0, globalMm3) >= Number(block.price_eur || 0))
    .sort((a, b) => Number(Boolean(b.market_command)) - Number(Boolean(a.market_command)) || a.index - b.index)

  const block = candidates[0]
  if (!block) throw new Error(`no free NFTJI satisfies wallet level 55 and MM3 global ${globalMm3}`)
  console.log(`Selected free NFTJI ${block.hex} (${block.block_key}) at ${block.row},${block.col}`)
  return {
    row: block.row,
    col: block.col,
    label: `NFTJI block ${block.hex}`,
    blockHex: block.hex,
    marketCommand: block.market_command || null,
    beautyShot: {
      x: block.col - 5.5,
      y: 3.2,
      z: block.row + 6.5,
      targetX: block.col + 0.5,
      targetY: 0.85,
      targetZ: block.row + 0.5,
      fov: 50,
    },
    // NFTJI cells reserve every adjacent approach, but the procedural maze
    // can still block a longer straight run. Spawn on the guaranteed-clear
    // west neighbour so Enter is deterministically inside interaction range.
    approach: { dRow: 0, dCol: -1 },
  }
}

function assertCaptureDepsInstalled() {
  const required = SOFTWARE_CAPTURE
    ? ['Xvfb', 'pulseaudio', 'pactl', 'ffmpeg', 'ffprobe']
    : ['pulseaudio', 'pactl', 'ffmpeg', 'ffprobe', 'xwininfo']
  const missing = required.filter((cmd) => !existsSync(BIN[cmd]))
  if (missing.length === 0) return
  console.error(
    `Missing on this host: ${missing.join(', ')}\n` +
    'Real-audio capture needs a virtual display + virtual audio sink, ' +
    "which aren't npm packages — install them once with:\n" +
    '  sudo apt-get update && sudo apt-get install -y xvfb pulseaudio pulseaudio-utils\n'
  )
  process.exit(1)
}

// Headed Chromium on a virtual X display — audio only plays (and can be
// captured) with a real display; --headless never renders/plays audio at all.
function startXvfb() {
  console.log(`Starting Xvfb on ${DISPLAY_NUM}...`)
  return spawn(BIN.Xvfb, [DISPLAY_NUM, '-screen', '0', `${DISPLAY_SIZE.width}x${DISPLAY_SIZE.height}x24`, '-nolisten', 'tcp'], {
    stdio: 'ignore',
  })
}

// A null-sink is a virtual speaker: Chromium plays into it like normal
// audio hardware, and its .monitor source is that same audio available to
// read from — which is what ffmpeg captures as each clip's audio track.
let pulseModuleId = null
let privatePulseProcess = null
let previousPulseServer = null

function pactl(args) {
  return spawnSync(BIN.pactl, args, { encoding: 'utf8' })
}

async function ensurePulseAudio() {
  let info = pactl(['info'])
  if (info.status !== 0) {
    console.log('Starting PulseAudio...')
    spawnSync(BIN.pulseaudio, ['--start', '--exit-idle-time=-1'], { stdio: 'ignore' })
    for (let attempt = 0; attempt < 6 && info.status !== 0; attempt += 1) {
      await sleep(250)
      info = pactl(['info'])
    }
  }
  if (info.status !== 0 && !privatePulseProcess) {
    // WSLg normally points PULSE_SERVER at /mnt/wslg/PulseServer. That socket
    // can remain configured while its server is unavailable, and `--start`
    // then refuses to autospawn. Run an isolated server for this recorder;
    // do not alter or kill the user's global WSL audio service.
    const socketPath = `/tmp/mm3trailer-pulse-${process.pid}.sock`
    previousPulseServer = process.env.PULSE_SERVER ?? null
    process.env.PULSE_SERVER = `unix:${socketPath}`
    console.log(`Starting isolated PulseAudio server at ${socketPath}...`)
    privatePulseProcess = spawn(BIN.pulseaudio, [
      '-n', '--daemonize=no', '--exit-idle-time=-1', '--use-pid-file=no',
      '--load', `module-native-protocol-unix socket=${socketPath}`,
      '--load', `module-null-sink sink_name=${PULSE_SINK_NAME}`,
    ], {
      stdio: 'ignore',
      // Multiple WSL Pulse clients can contend for org.PulseAudio1 even when
      // they use different private sockets. This recorder needs no D-Bus.
      env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'disabled:' },
    })
    for (let attempt = 0; attempt < 20 && info.status !== 0; attempt += 1) {
      await sleep(250)
      info = pactl(['info'])
    }
  }
  if (info.status !== 0) {
    throw new Error(`PulseAudio did not become available: ${(info.stderr || '').trim()}`)
  }

  let sources = pactl(['list', 'short', 'sources'])
  if (!sources.stdout?.split('\n').some((line) => line.split('\t')[1] === `${PULSE_SINK_NAME}.monitor`)) {
    console.log(`Creating virtual audio sink ${PULSE_SINK_NAME}...`)
    const loaded = pactl(['load-module', 'module-null-sink', `sink_name=${PULSE_SINK_NAME}`])
    const id = Number.parseInt((loaded.stdout || '').trim(), 10)
    if (loaded.status !== 0 || !Number.isInteger(id)) {
      throw new Error(`Could not create PulseAudio sink: ${(loaded.stderr || loaded.stdout || '').trim()}`)
    }
    pulseModuleId = id
    await sleep(300)
    sources = pactl(['list', 'short', 'sources'])
  }

  const monitorReady = sources.status === 0
    && sources.stdout?.split('\n').some((line) => line.split('\t')[1] === `${PULSE_SINK_NAME}.monitor`)
  if (!monitorReady) throw new Error(`PulseAudio source ${PULSE_SINK_NAME}.monitor is missing`)

  const defaultSink = pactl(['set-default-sink', PULSE_SINK_NAME])
  if (defaultSink.status !== 0) {
    throw new Error(`Could not select PulseAudio sink: ${(defaultSink.stderr || '').trim()}`)
  }
}

function stopPulseAudio() {
  if (pulseModuleId != null) pactl(['unload-module', String(pulseModuleId)])
  pulseModuleId = null
  if (privatePulseProcess && privatePulseProcess.exitCode == null) privatePulseProcess.kill('SIGTERM')
  privatePulseProcess = null
  if (previousPulseServer == null) delete process.env.PULSE_SERVER
  else process.env.PULSE_SERVER = previousPulseServer
  previousPulseServer = null
}

// -f pulse -i <sink>.monitor captures what's playing INTO the sink (i.e.
// Chromium's output), not a microphone. -use_wallclock_as_timestamps keeps
// video/audio in sync even if frame capture briefly stalls under load.
async function findGpuCaptureWindow(page) {
  const marker = `MM3-TRAILER-CAPTURE-${process.pid}`
  await page.evaluate((title) => { document.title = title }, marker)
  await sleep(250)
  const tree = spawnSync(BIN.xwininfo, ['-root', '-tree'], { encoding: 'utf8' })
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = tree.stdout?.match(new RegExp(`^\\s*(0x[0-9a-f]+) "${escaped}`, 'mi'))
  if (!match) throw new Error('Could not locate the WSLg Chromium window for GPU capture')
  if (PROTECT_GPU_WINDOW) protectWindowsHostWindow(marker)
  return match[1]
}

function protectWindowsHostWindow(titleMarker) {
  const script = String.raw`
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class Mm3WindowGuard {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int index);
  [DllImport("user32.dll")] static extern IntPtr SetWindowLongPtr(IntPtr hWnd, int index, IntPtr value);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] static extern bool SetLayeredWindowAttributes(IntPtr hWnd, uint colorKey, byte alpha, uint flags);
  public static bool Protect(string marker) {
    bool found = false;
    EnumWindows((hWnd, _) => {
      var title = new StringBuilder(512);
      GetWindowText(hWnd, title, title.Capacity);
      if (!title.ToString().Contains(marker)) return true;
      const int GWL_EXSTYLE = -20;
      const long WS_EX_TRANSPARENT = 0x20L;
      const long WS_EX_LAYERED = 0x00080000L;
      const long WS_EX_NOACTIVATE = 0x08000000L;
      long style = GetWindowLongPtr(hWnd, GWL_EXSTYLE).ToInt64();
      SetWindowLongPtr(hWnd, GWL_EXSTYLE, new IntPtr(style | WS_EX_TRANSPARENT | WS_EX_LAYERED | WS_EX_NOACTIVATE));
      // Alpha 0 lets WSLg optimize the surface away and x11grab receives
      // irregular timestamps. 1/255 is visually imperceptible but keeps the
      // GPU surface composited and updating at full cadence.
      SetLayeredWindowAttributes(hWnd, 0, 1, 0x00000002);
      SetWindowPos(hWnd, new IntPtr(1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
      found = true;
      return false;
    }, IntPtr.Zero);
    return found;
  }
}
'@
if (-not [Mm3WindowGuard]::Protect($env:MM3_WINDOW_TITLE)) { exit 2 }
`
  if (!existsSync(BIN.powershell)) {
    console.warn('  ! PowerShell not found; GPU browser window remains interactive')
    return
  }
  const result = spawnSync(BIN.powershell, ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    env: { ...process.env, MM3_WINDOW_TITLE: titleMarker },
  })
  if (result.status !== 0) {
    console.warn(`  ! could not protect GPU browser window from user input (${(result.stderr || '').trim() || `exit ${result.status}`})`)
  } else {
    console.log('  Browser window protected: invisible + click-through')
  }
}

async function startFfmpegCapture(page, outPath) {
  console.log(`Recording ${DISPLAY_NUM} + ${PULSE_SINK_NAME}.monitor → ${outPath}`)
  const videoInput = GPU_CAPTURE
    ? ['-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30', '-window_id', await findGpuCaptureWindow(page), '-i', DISPLAY_NUM]
    : ['-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30', '-video_size', `${CAPTURE_SIZE.width}x${CAPTURE_SIZE.height}`, '-i', `${DISPLAY_NUM}+0,${CHROMIUM_FRAME_TOP}`]
  const ffmpeg = spawn(BIN.ffmpeg, [
    '-y',
    '-thread_queue_size', '1024',
    ...videoInput,
    '-thread_queue_size', '1024',
    '-f', 'pulse', '-i', `${PULSE_SINK_NAME}.monitor`,
    ...(GPU_CAPTURE ? ['-vf', `crop=${CAPTURE_SIZE.width}:${CAPTURE_SIZE.height}:8:85`] : []),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-af', 'aresample=async=1:first_pts=0', '-c:a', 'aac', '-b:a', '192k',
    outPath,
  ], { stdio: 'inherit' })
  // Opening x11grab + PulseAudio happens immediately. If either input is
  // missing ffmpeg exits in under a second; detect that before performing a
  // 30s scene and falsely reporting a clip that was never recorded.
  await Promise.race([
    new Promise((resolveStarted) => setTimeout(resolveStarted, 1_500)),
    new Promise((_, rejectStarted) => ffmpeg.once('exit', (code) => {
      rejectStarted(new Error(`ffmpeg could not start capture (exit ${code})`))
    })),
  ])
  if (ffmpeg.exitCode != null) throw new Error(`ffmpeg could not start capture (exit ${ffmpeg.exitCode})`)
  return ffmpeg
}

// SIGINT (not kill -9) so ffmpeg's mp4 muxer writes a valid trailer/moov
// atom instead of leaving a broken file.
async function stopFfmpegCapture(ff) {
  if (!ff || ff.exitCode != null) return
  ff.kill('SIGINT')
  await new Promise((r) => { ff.once('exit', r); setTimeout(r, 8000) })
}

// Records one clip with its own ffmpeg process. Do not call page.screenshot()
// while x11grab is running: under headed Chromium + bare Xvfb Playwright's
// screenshot path temporarily invalidates part of the browser surface. That
// was the source of the intermittent white lower half in the resulting MP4s.
async function recordClip(page, outDir, name, actionFn) {
  console.log(`\n=== Clip: ${name} ===`)
  const outPath = resolve(outDir, `${name}.mp4`)
  await ensurePulseAudio()
  const ffmpeg = await startFfmpegCapture(page, outPath)
  let clipError = null
  try {
    await actionFn()
  } catch (err) {
    console.error(`  clip "${name}" hit an error:`, err)
    clipError = err
  } finally {
    await stopFfmpegCapture(ffmpeg)
  }
  if (clipError) {
    const failedPath = outPath.replace(/\.mp4$/, '.failed.mp4')
    if (existsSync(outPath)) renameSync(outPath, failedPath)
    throw clipError
  }
}

async function recordClipWithRetries(page, outDir, name, prepareFn, actionFn, attempts = 2) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prepareFn()
      await recordClip(page, outDir, name, actionFn)
      return true
    } catch (err) {
      lastError = err
      const failedPath = resolve(outDir, `${name}.failed.mp4`)
      const archivedPath = resolve(outDir, `${name}.attempt-${attempt}.failed.mp4`)
      if (existsSync(failedPath)) renameSync(failedPath, archivedPath)
      console.warn(`  ! ${name} attempt ${attempt}/${attempts} failed: ${err.message}`)
    }
  }
  throw new Error(`${name} failed after ${attempts} attempts: ${lastError?.message || 'unknown error'}`)
}

async function seedProgress(wallet) {
  const supabase = sbClient()
  // The trailer wallet is disposable. Remove blocks it bought in a previous
  // recording so rerunning the NFTJI purchase story does not start from an
  // inconsistent "already owned" state. Never touches another wallet's rows.
  const { error: cleanupError } = await supabase.from('mm3_mined_blocks').delete().eq('wallet', wallet)
  if (cleanupError && cleanupError.code !== '42P01') {
    throw new Error(`reset trailer wallet blocks ${wallet}: ${cleanupError.message}`)
  }
  // Training's "Start game" is gated on dailyMineLeft = (100 + execs) minus
  // today's row count in `games` for this wallet (Board.jsx loadMiningAttempts)
  // — a wallet that already ran the trailer earlier today (or any real
  // training rounds) shows "NEXT BLOCK"/no slots instead of a startable
  // board. Clear today's rows so the Training clip always has a fresh count.
  const todayStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()))
  const { error: gamesCleanupError } = await supabase.from('games').delete().eq('wallet', wallet).gte('created_at', todayStart.toISOString())
  if (gamesCleanupError && gamesCleanupError.code !== '42P01') {
    throw new Error(`reset trailer wallet training slots ${wallet}: ${gamesCleanupError.message}`)
  }
  await ensureProgress(supabase, wallet, {
    level: 55,
    eur_earned: 4200,
    usd_earned: 4600,
    cny_earned: 32000,
    wallet_emojis: ['🔁'],
  })
  // total_eth feeds the RL node's mm3 balance check (mm3 = total_eth -
  // mm3_sold) — comfortably above RL_NODE_PRICE_MM3 (10) so the in-video
  // car purchase actually succeeds instead of hitting "not enough MM3".
  await ensureLeaderboard(supabase, wallet, 50)
  console.log(`Seeded progress for ${wallet}`)
}

async function loadSkilledBotCast(supabase) {
  const { data, error } = await supabase
    .from('player_progress')
    .select('wallet,level,wallet_emojis,mining_nftji_key,mining_nftji_levels,is_bot')
    .eq('is_bot', true)
    .limit(100)
  if (error) console.warn(`  ! could not rank bot cast (${error.message}); using configured boss wallets`)
  const ranked = (data || [])
    .filter((row) => /^0x[0-9a-f]{40}$/i.test(String(row.wallet || '')))
    .map((row) => ({
      ...row,
      skillCount: Array.isArray(row.wallet_emojis) ? row.wallet_emojis.length : 0,
      nftjiCount: Object.keys(row.mining_nftji_levels || {}).length + (row.mining_nftji_key ? 1 : 0),
    }))
    .sort((a, b) => (b.skillCount * 20 + b.nftjiCount * 5 + Number(b.level || 0))
      - (a.skillCount * 20 + a.nftjiCount * 5 + Number(a.level || 0)))
  const wallets = [...new Set([...ranked.map((row) => row.wallet), ...Object.values(BOT_WALLETS)])]
  for (const row of ranked.slice(0, 8)) {
    console.log(`Cast ${row.wallet.slice(0, 8)}…${row.wallet.slice(-4)}: ${row.skillCount} skills, ${row.nftjiCount} NFTJIs, level ${row.level}`)
  }
  return wallets
}

async function run() {
  assertCaptureDepsInstalled()
  loadEnvLocal()
  await seedProgress(TRAILER_WALLET)
  const supabase = sbClient()
  const skilledCast = await loadSkilledBotCast(supabase)
  const castWallet = (index) => skilledCast[index % skilledCast.length] || TRAILER_WALLET
  const homeWallet = castWallet(0)

  const outDir = resolve(__dirname, 'out', new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(outDir, { recursive: true })

  const xvfb = GPU_CAPTURE ? null : startXvfb()
  if (xvfb) await sleep(1000) // let the X server come up before Chromium tries to connect
  console.log('Preparing PulseAudio + virtual sink...')
  await ensurePulseAudio()

  // headless:false so audio actually renders — Chromium never plays sound
  // in --headless mode regardless of any mute/unmute flag. DISPLAY points
  // it at the Xvfb server instead of a real screen; PULSE_SINK routes its
  // audio into the virtual sink ffmpeg is capturing. --kiosk makes
  // Chromium size itself to fill the whole display without a WM (Xvfb has
  // none) to negotiate window geometry with.
  console.log(GPU_CAPTURE ? 'GPU capture: WSLg + NVIDIA D3D12' : 'Software capture: Xvfb + SwiftShader')
  const browser = await chromium.launch({
    headless: false,
    // Keep exactly one browser surface. --app=<url> created an extra window
    // beside Playwright's page; under bare Xvfb the two surfaces periodically
    // covered each other, producing clips that alternated between a complete
    // frame and a large white lower half. The fixed x11grab offset removes
    // kiosk's browser chrome without needing a second app window.
    args: [
      ...(GPU_CAPTURE ? ['--use-gl=angle', '--use-angle=gl'] : ['--kiosk']),
      '--window-position=0,0',
      `--window-size=${DISPLAY_SIZE.width},${DISPLAY_SIZE.height}`,
    ],
    env: {
      ...process.env,
      DISPLAY: DISPLAY_NUM,
      PULSE_SINK: PULSE_SINK_NAME,
      ...(GPU_CAPTURE ? {
        MESA_LOADER_DRIVER_OVERRIDE: 'd3d12',
        GALLIUM_DRIVER: 'd3d12',
        MESA_D3D12_DEFAULT_ADAPTER_NAME: 'NVIDIA',
      } : {}),
    },
  })
  // Never let Chromium/Xvfb renegotiate the page's usable height mid-clip.
  // viewport:null followed the outer window and produced alternating frames:
  // one ended at the footer, the next exposed a white strip below it.
  const context = await browser.newContext({
    viewport: CAPTURE_SIZE,
    screen: DISPLAY_SIZE,
  })
  // Mining statues normally leave their plinth on autonomous patrols. Every
  // trailer page sees this flag before application code runs, so statue
  // motion objects are born fixed and remain on their authored base for the
  // entire shot. This runtime-only flag never changes normal gameplay.
  await context.addInitScript(() => {
    window.__MM3_TRAILER_LOCK_STATUES__ = true
    window.__MM3_TRAILER_AUTOMATION__ = true
    window.__MM3_TRAILER_LIGHT_TEXTURES__ = true
  })
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  const failedClips = []
  const keepRecording = async (name, fn) => {
    try { await fn() } catch (err) {
      failedClips.push({ name, error: err })
      console.error(`  ✗ ${name} exhausted its retries; continuing with the remaining clips`)
    }
  }

  try {
    // about:blank already owns the final WSLg host window, so protect it
    // before the first portal navigation can ever become visible/focusable.
    if (PROTECT_GPU_WINDOW) await findGpuCaptureWindow(page)
    await initSession(page, homeWallet)
    await zoomBrowserOut(page, 2)

    if (!ONLY || '00-home'.includes(ONLY)) {
      await keepRecording('00-home', () => recordClipWithRetries(
        page, outDir, '00-home', async () => {
          await page.goto(`${BASE_URL}/`, { waitUntil: 'commit', timeout: 45_000 })
          await waitForHomeLoaded(page)
        },
        async () => {
          await enterPolygonSidesInOrder(page)
        },
      ))
    }

    // Trump/death first: it's the one clip that truly needs pointer lock
    // (clicking swings the melee weapon), and the very first Home→Mining
    // navigation has reliably granted it every time this was tested —
    // unlike any RELOAD after that, which never got it back. Put the one
    // lock-dependent clip where the odds are best.
    if (!QUICK && (!ONLY || '01-m5-trump-death'.includes(ONLY))) {
      await switchSessionWallet(page, BOT_WALLETS.m5)
      const spawn = { row: LANDMARKS.m5Trump.row + LANDMARKS.m5Trump.approach.dRow, col: LANDMARKS.m5Trump.col + LANDMARKS.m5Trump.approach.dCol }
      await keepRecording('01-m5-trump-death', () => recordClipWithRetries(page, outDir, '01-m5-trump-death',
        () => gotoMiningAt(page, supabase, BOT_WALLETS.m5, '5', spawn.row, spawn.col, { fastCombat: true }), async () => {
        await playMapEntryAudio(page, '5')
        await holdSubjectBeautyShot(page, LANDMARKS.m5Trump)
        await approachTarget(page, spawn, LANDMARKS.m5Trump, LANDMARKS.m5Trump.label)
        // The stinger starts after FFmpeg and plays across the long beauty
        // takes; leave a final clean beat before combat SFX joins it.
        await sleep(1_500)
        await fightBossToDeath(page, LANDMARKS.m5Trump.label)
      }))
    }

    const nftjiTarget = (!ONLY || '06-m1-nftji-buy'.includes(ONLY))
      ? await findPurchasableNftjiTarget(supabase)
      : null
    const miningClips = [
      ['02-m1-chain-node', '1', LANDMARKS.m1ChainNode, () => solveChainWithTrailerAnswer(page), castWallet(0)],
      ['03-m1-milei', '1', LANDMARKS.m1Milei, () => interact(page, LANDMARKS.m1Milei.label), castWallet(1)],
      ['04-m1-zelensky', '1', LANDMARKS.m1Zelensky, () => interact(page, LANDMARKS.m1Zelensky.label), castWallet(2)],
      ['05-m1-node-dice', '1', LANDMARKS.m1NodeDice, async () => { await sleep(2_000) }, castWallet(3)],
      ...(nftjiTarget ? [['06-m1-nftji-buy', '1', nftjiTarget, () => buyNftjiThroughRelaying(page, nftjiTarget), TRAILER_WALLET]] : []),
    ]
    if (!QUICK) {
      miningClips.push(
        ['07-m2-macron', '2', LANDMARKS.m2Macron, () => interact(page, LANDMARKS.m2Macron.label), castWallet(3)],
        ['08-m2-rlnode-buy', '2', LANDMARKS.m2RlNode, () => interactAndBuyRlCar(page, LANDMARKS.m2RlNode.label), castWallet(0)],
        ['09-m3-putin', '3', LANDMARKS.m3Putin, async () => {
          await fightBossToDeath(page, LANDMARKS.m3Putin.label)
        }, BOT_WALLETS.m3],
        ['10-m4-kim', '4', LANDMARKS.m4Kim, async () => {
          await fightBossToDeath(page, LANDMARKS.m4Kim.label)
        }, BOT_WALLETS.m4],
      )
    }

    let activeWallet = (!QUICK && (!ONLY || '01-m5-trump-death'.includes(ONLY))) ? BOT_WALLETS.m5 : homeWallet
    for (const [name, mapId, target, action, clipWallet] of miningClips) {
      if (ONLY && !name.includes(ONLY)) continue
      const wallet = clipWallet || TRAILER_WALLET
      if (wallet !== activeWallet) {
        await switchSessionWallet(page, wallet)
        activeWallet = wallet
      }
      const spawn = { row: target.row + target.approach.dRow, col: target.col + target.approach.dCol }
      await keepRecording(name, () => recordClipWithRetries(page, outDir, name,
        () => gotoMiningAt(page, supabase, wallet, mapId, spawn.row, spawn.col, { fastCombat: Boolean(target.isBoss) }), async () => {
        await playMapEntryAudio(page, mapId)
        await holdSubjectBeautyShot(page, target)
        if (target.chainCinematic) await approachChainNode(page, spawn, target)
        else if (!target.beautyOnly) await approachTarget(page, spawn, target, target.label)
        await action()
        await sleep(2_000) // linger on the result before the clip ends
      }))
    }

    if (!QUICK && (!ONLY || '11-relaying'.includes(ONLY))) {
      if (activeWallet !== castWallet(1)) {
        await switchSessionWallet(page, castWallet(1))
        activeWallet = castWallet(1)
      }
      await keepRecording('11-relaying', () => recordClipWithRetries(
        page, outDir, '11-relaying', async () => {}, () => visitRelayingPage(page),
      ))
    }
    if (!QUICK && (!ONLY || '12-training'.includes(ONLY))) {
      // TRAILER_WALLET, not a skilled cast wallet — those are real bots
      // playing training throughout the day in production and can already
      // be at their daily slot cap. seedProgress() clears today's `games`
      // rows for this wallet up front, so it always has slots here.
      if (activeWallet !== TRAILER_WALLET) {
        await switchSessionWallet(page, TRAILER_WALLET)
        activeWallet = TRAILER_WALLET
      }
      await keepRecording('12-training', () => recordClipWithRetries(
        page, outDir, '12-training', async () => {}, () => visitTrainingPage(page),
      ))
    }
    if (!QUICK && (!ONLY || '13-mining-aerial-all-maps'.includes(ONLY))) {
      if (activeWallet !== TRAILER_WALLET) {
        await switchSessionWallet(page, TRAILER_WALLET)
        activeWallet = TRAILER_WALLET
      }
      await keepRecording('13-mining-aerial-all-maps', () => (
        recordAerialTourClip(page, outDir, supabase, TRAILER_WALLET)
      ))
    }
  } catch (err) {
    console.error('Trailer clip session hit an error:', err)
  } finally {
    // A Ctrl+C (or a page/browser crash mid-run) can tear the browser down
    // before we get here — closing an already-gone context/browser throws
    // and, unhandled in a finally, crashes the process with a scary
    // Protocol-error stack instead of the real error above it.
    await context.close().catch(() => {})
    await browser.close().catch(() => {})
    stopPulseAudio()
    xvfb?.kill()
  }

  console.log(`\nClips written to: ${outDir}`)
  if (failedClips.length) {
    console.error(`Invalid clips: ${failedClips.map(({ name }) => name).join(', ')}`)
    process.exitCode = 1
  } else {
    console.log('All requested clips completed their required ending.')
  }
}

run()
