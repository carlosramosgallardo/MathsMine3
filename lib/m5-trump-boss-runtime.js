import { unitRandom } from '@/lib/game-random'
import {
  M5_TRUMP_BOSS_ATTACK_COOLDOWN_MS,
  M5_TRUMP_BOSS_ATTACK_RANGE,
  M5_TRUMP_BOSS_BOUNDS,
  M5_TRUMP_BOSS_ENGAGE_DELAY_MS,
  M5_TRUMP_BOSS_HIT_RANGE,
  M5_TRUMP_BOSS_IDLE_FACING,
  M5_TRUMP_BOSS_MODEL_URL,
  M5_TRUMP_BOSS_SCALE,
  M5_TRUMP_BOSS_SPEED_MULT,
  M5_TRUMP_BOSS_SPAWN,
} from './m5-trump-boss'
import { attachQuadrupedGlb } from './quadruped-glb'
import { applyQuadrupedPose, quadrupedPose } from './quadruped-motion'
import { attachBotEyeGlows, setBossMaskEyesRed } from './boss-head-photo'
import { placeEyeGlowsFromFit } from './prop-eye-glows'
import { vivifyTrumpBibiVertexColors } from './trump-bibi-colors'
import { advanceShowcaseSpin, approachYaw, bossFacingFromDelta } from './map-boss-facing'

const MOVE_SPD = 47
/** Cells per second at full chase speed — the gait's 100% reference. */
const FULL_SPEED = (MOVE_SPD / 40) * M5_TRUMP_BOSS_SPEED_MULT
/** Attack window in ms; the pose plays over exactly this span. */
const ATTACK_MS = 520

/**
 * Trump is a crawling sculpt, not a capsule rig: the GLB carries the whole
 * character (pose, face, colours) and lib/quadruped-motion.js animates it as
 * one body. Until the sculpt streams in, a slab keeps the boss visible and
 * hittable.
 */
export function createM5TrumpBossVisual(THREE, lowDetail = false) {
  const group = new THREE.Group()
  group.name = 'm5TrumpBoss'
  group.userData.m5TrumpBoss = true

  const bodyPivot = new THREE.Group()
  bodyPivot.name = 'm5TrumpBossBody'
  group.add(bodyPivot)

  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(M5_TRUMP_BOSS_BOUNDS.halfWidth * 2, M5_TRUMP_BOSS_BOUNDS.backY, 1.0),
    lowDetail
      ? new THREE.MeshLambertMaterial({ color: '#1e293b' })
      : new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8, metalness: 0.1 }),
  )
  placeholder.position.y = M5_TRUMP_BOSS_BOUNDS.backY / 2
  placeholder.visible = false
  bodyPivot.add(placeholder)
  group.userData.modelReady = false

  const finishModel = (ok) => {
    if (ok && placeholder.parent) {
      placeholder.removeFromParent()
      placeholder.geometry.dispose()
      placeholder.material.dispose()
    }
    if (ok) {
      // Trump crawl (~0.55) + Bibi rider (~0.92) — four eye glows on real faces.
      // Bibi (rider, high/back) + Trump (crawler, lower/forward) — 4 sockets.
      // Face is −Z after the shared π plant (camera-facing on the home rail).
      placeEyeGlowsFromFit(THREE, bodyPivot, {
        eyeLine: 0.55,
        spacingFrac: 0.065,
        forwardFrac: 0.12,
        faceSign: -1,
        padPct: 0.08,
        size: 0.048,
        skullFrac: 0.28,
        // Crawler head sits lower; stick outliers already trimmed by padPct.
        extraHeads: [{ eyeLine: 0.38, forwardFrac: 0.08 }],
      })
    }
    group.userData.modelReady = true
    group.userData.onModelReady?.(group)
  }

  attachQuadrupedGlb(THREE, bodyPivot, {
    url: M5_TRUMP_BOSS_MODEL_URL,
    onReady: (clone) => {
      if (clone) {
        clone.traverse((obj) => {
          if (!obj.isMesh?.geometry) return
          // Lift vertex paint at load (Uint8 → Float32) so combat tints stay vivid.
          obj.geometry = obj.geometry.clone()
          vivifyTrumpBibiVertexColors(obj.geometry, THREE)
          if (obj.material) {
            obj.material.vertexColors = true
            obj.material.needsUpdate = true
          }
        })
      }
      finishModel(Boolean(clone))
    },
  })

  // Four eyes: crawling Trump (lower/forward) + Bibi rider (higher/back).
  // Seed positions; finishModel re-plants from the fitted AABB.
  attachBotEyeGlows(THREE, bodyPivot, {
    color: '#67e8f9',
    size: 0.055,
    idleOpacity: 0,
    points: [
      { x: -0.04, y: 0.95, z: 0.15 },
      { x: 0.04, y: 0.95, z: 0.15 },
      { x: -0.045, y: 0.55, z: 0.55 },
      { x: 0.045, y: 0.55, z: 0.55 },
    ],
  })

  // Wider than a standing boss: the crawl spreads the contact patch forward.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.scale.set(1.05, 1.7, 1)
  shadow.position.y = 0.02
  group.add(shadow)

  bodyPivot.rotation.y = Math.PI
  group.scale.setScalar(M5_TRUMP_BOSS_SCALE)
  group.matrixAutoUpdate = true
  group.userData.bodyPivot = bodyPivot
  group.userData.headY = M5_TRUMP_BOSS_BOUNDS.headTop * M5_TRUMP_BOSS_SCALE
  group.position.set(M5_TRUMP_BOSS_SPAWN.gx, 0, M5_TRUMP_BOSS_SPAWN.gy)

  return { group, bodyPivot }
}

export const M5_TRUMP_BOSS_LOCAL_BOUNDS = M5_TRUMP_BOSS_BOUNDS

export function createBossRuntime(state) {
  return {
    gx: M5_TRUMP_BOSS_SPAWN.gx,
    gy: M5_TRUMP_BOSS_SPAWN.gy,
    targetWallet: null,
    facing: M5_TRUMP_BOSS_IDLE_FACING,
    lastAttackMs: 0,
    engageAt: 0,
    idlePhase: unitRandom() * Math.PI * 2,
    visible: state !== 'dead',
    hitFlashUntil: 0,
    attackUntil: 0,
    combatEngaged: state === 'active',
    /** Smoothed 0..1 gait gain driving the crawl cadence. */
    moving: 0,
  }
}

/**
 * Ground speed → gait gain. Smoothed so a boss that stutters around an
 * obstacle does not flicker between crawling and standing still.
 */
export function trackBossGait(runtime, fromGx, fromGy, dt) {
  const step = Math.min(1, Math.max(0, Number(dt) || 0))
  const moved = Math.hypot(runtime.gx - fromGx, runtime.gy - fromGy)
  const target = step > 0 ? Math.min(1, moved / step / (FULL_SPEED * 0.6)) : 0
  const previous = Number.isFinite(runtime.moving) ? runtime.moving : 0
  runtime.moving = previous + (target - previous) * Math.min(1, step * 6)
  return runtime.moving
}

function fighterMatchesLocal(fighter, myWallet, myIdentity) {
  const fw = String(fighter?.wallet || '').toLowerCase()
  const mw = String(myWallet || '').toLowerCase()
  const mi = String(myIdentity || '').toLowerCase()
  return Boolean(fighter?.isLocal || (mw && fw === mw) || (mi && fw === mi))
}

/**
 * Screen-space boss hit test — crosshair must be on the boss mesh; head only when
 * the reticle is inside the projected head bounds (same approach as PvP avatars).
 */
export function resolveBossSwingTarget({
  runtime,
  bossState,
  playerGx,
  playerGy,
  playerAngle,
  crossX,
  crossY,
  canvasW,
  canvasH,
  threeState,
  groundY = 0,
  touchPadding = 0,
}) {
  if (!runtime || bossState?.state === 'dead' || runtime.visible === false) return null

  const dx = runtime.gx - playerGx
  const dy = runtime.gy - playerGy
  const dist = Math.hypot(dx, dy)
  if (dist > M5_TRUMP_BOSS_HIT_RANGE) return null
  if (dist > 1.2) {
    const aimDx = Math.cos(playerAngle)
    const aimDy = Math.sin(playerAngle)
    if (dx * aimDx + dy * aimDy < 0.15) return null
  }

  const scale = M5_TRUMP_BOSS_SCALE
  const bossGx = runtime.gx
  const bossGy = runtime.gy
  const bounds = M5_TRUMP_BOSS_LOCAL_BOUNDS
  const floorY = Number.isFinite(groundY) ? groundY : Number(runtime.floorY) || 0
  let hitZone = 'body'

  if (threeState?.camera && Number.isFinite(crossX) && Number.isFinite(crossY)) {
    const headTopW = floorY + scale * bounds.headTop
    const headBotW = floorY + scale * bounds.headBottom
    const feetW = floorY + scale * bounds.feet
    const halfW = scale * bounds.halfWidth
    const sv = threeState._v3a
    if (!sv) return dist <= 1.0 ? { dist, hitZone: 'body', bossGx, bossGy } : null

    sv.set(bossGx, headTopW, bossGy)
    sv.project(threeState.camera)
    if (sv.z > 1) return dist <= 1.0 ? { dist, hitZone: 'body', bossGx, bossGy } : null
    const pyHeadTop = (-sv.y + 1) / 2 * canvasH

    sv.set(bossGx, headBotW, bossGy)
    sv.project(threeState.camera)
    const pyHeadBottom = (-sv.y + 1) / 2 * canvasH

    sv.set(bossGx - halfW, headBotW, bossGy)
    sv.project(threeState.camera)
    const pxLeft = (sv.x + 1) / 2 * canvasW

    sv.set(bossGx + halfW, headBotW, bossGy)
    sv.project(threeState.camera)
    const pxRight = (sv.x + 1) / 2 * canvasW

    sv.set(bossGx, feetW, bossGy)
    sv.project(threeState.camera)
    const pyFeet = (-sv.y + 1) / 2 * canvasH

    const padX = 8 + touchPadding
    const minX = Math.min(pxLeft, pxRight) - padX
    const maxX = Math.max(pxLeft, pxRight) + padX
    const minY = Math.min(pyHeadTop, pyHeadBottom) - (6 + touchPadding)
    const maxY = pyFeet + (8 + touchPadding)

    if (crossX < minX || crossX > maxX || crossY < minY || crossY > maxY) {
      if (dist <= 1.0) return { dist, hitZone: 'body', bossGx, bossGy }
      return null
    }

    const headPad = 4 + Math.round(touchPadding * 0.5)
    hitZone = (crossY >= pyHeadTop - headPad && crossY <= pyHeadBottom + headPad) ? 'head' : 'body'
  } else if (dist > 0.55) {
    return null
  }

  return {
    dist,
    hitZone,
    bossGx,
    bossGy,
  }
}

function listAliveFightersOnM5(presenceMap, mapId, myIdentity, myDead) {
  const fighters = []
  if (mapId !== '5') return fighters
  for (const [wallet, pres] of Object.entries(presenceMap || {})) {
    if ((pres.mapId || '1') !== '5') continue
    if (pres.isDead) continue
    fighters.push({
      wallet,
      gx: Number(pres.gx ?? (pres.col ?? 0) + 0.5),
      gy: Number(pres.gy ?? (pres.row ?? 0) + 0.5),
    })
  }
  if (myIdentity && !myDead && mapId === '5') {
    const mi = myIdentity.toLowerCase()
    const exists = fighters.some(f => f.wallet.toLowerCase() === mi)
    if (!exists) {
      fighters.push({ wallet: myIdentity, gx: null, gy: null, isLocal: true })
    }
  }
  return fighters
}

export function updateM5TrumpBoss(params) {
  const runtime = params?.runtime
  if (!runtime) return runtime
  const fromGx = runtime.gx
  const fromGy = runtime.gy
  const out = stepM5TrumpBoss(params)
  trackBossGait(runtime, fromGx, fromGy, params.dt)
  return out
}

/** Slide toward a target cell, sacrificing an axis when the other is blocked. */
function slideTowards(runtime, nx, ny, canMoveTo) {
  if (!canMoveTo || canMoveTo(nx, ny)) {
    runtime.gx = nx
    runtime.gy = ny
  } else if (canMoveTo(nx, runtime.gy)) {
    runtime.gx = nx
  } else if (canMoveTo(runtime.gx, ny)) {
    runtime.gy = ny
  }
}

function nearestFighterTo(runtime, fighters) {
  let nearest = null
  let bestDist = Infinity
  for (const fighter of fighters) {
    if (!Number.isFinite(fighter.gx) || !Number.isFinite(fighter.gy)) continue
    const dist = Math.hypot(fighter.gx - runtime.gx, fighter.gy - runtime.gy)
    if (dist < bestDist) {
      bestDist = dist
      nearest = fighter
    }
  }
  return nearest
}

/** Hold the arena while out of combat: walk home, then wait facing the crowd. */
function stepBossOutOfCombat(runtime, dt, fighters, canMoveTo) {
  const dxS = M5_TRUMP_BOSS_SPAWN.gx - runtime.gx
  const dyS = M5_TRUMP_BOSS_SPAWN.gy - runtime.gy
  const distToSpawn = Math.hypot(dxS, dyS)
  if (distToSpawn > 0.45) {
    const step = Math.min(distToSpawn, FULL_SPEED * dt)
    slideTowards(runtime, runtime.gx + (dxS / distToSpawn) * step, runtime.gy + (dyS / distToSpawn) * step, canMoveTo)
    runtime.facing = approachYaw(runtime.facing, bossFacingFromDelta(dxS, dyS), dt, 5)
    runtime.waiting = false
    return
  }

  const nearest = nearestFighterTo(runtime, fighters)
  if (!nearest) {
    runtime.waiting = false
    runtime.gx = M5_TRUMP_BOSS_SPAWN.gx + Math.sin(runtime.idlePhase) * 0.08
    runtime.gy = M5_TRUMP_BOSS_SPAWN.gy + Math.cos(runtime.idlePhase * 0.9) * 0.08
    runtime.facing = M5_TRUMP_BOSS_IDLE_FACING + advanceShowcaseSpin(runtime, dt)
    return
  }

  runtime.facing = approachYaw(runtime.facing, bossFacingFromDelta(nearest.gx - runtime.gx, nearest.gy - runtime.gy), dt, 4)
  runtime.waiting = true
  // Hold the spawn spot but lean a small step toward the nearest player.
  const dxF = nearest.gx - M5_TRUMP_BOSS_SPAWN.gx
  const dyF = nearest.gy - M5_TRUMP_BOSS_SPAWN.gy
  const dF = Math.hypot(dxF, dyF) || 1
  const lean = Math.min(0.25, dF * 0.5)
  const blend = Math.min(1, dt * 3)
  runtime.gx += (M5_TRUMP_BOSS_SPAWN.gx + (dxF / dF) * lean - runtime.gx) * blend
  runtime.gy += (M5_TRUMP_BOSS_SPAWN.gy + (dyF / dF) * lean - runtime.gy) * blend
}

function stepM5TrumpBoss({
  runtime,
  bossState,
  dt,
  mapId,
  presenceMap,
  myIdentity,
  myWallet,
  myDead,
  localGx,
  localGy,
  onAttack,
  onRequestIdle,
  stormAggro = false,
  canMoveTo = null,
}) {
  if (!runtime || mapId !== '5') return runtime
  const state = bossState?.state || 'idle'
  runtime.visible = state !== 'dead'
  if (state === 'dead') {
    runtime.combatEngaged = false
    return runtime
  }

  if (state === 'active') runtime.combatEngaged = true
  // During a Node Dice storm the boss hunts even from its waiting state.
  const fighting = state === 'active' || runtime.combatEngaged || stormAggro

  const fighters = listAliveFightersOnM5(presenceMap, mapId, myIdentity, myDead)
  // Presence coords for the local player are throttled/stale — always use live ones.
  const localCoordsOk = Number.isFinite(localGx) && Number.isFinite(localGy)
  for (const fighter of fighters) {
    if (fighter.isLocal || (localCoordsOk && fighterMatchesLocal(fighter, myWallet, myIdentity))) {
      fighter.gx = localGx
      fighter.gy = localGy
    }
  }

  if (fighting && fighters.length === 0) {
    onRequestIdle?.()
    runtime.targetWallet = null
    runtime.combatEngaged = false
    runtime.engageAt = 0
    return runtime
  }

  if (!fighting) {
    runtime.engageAt = 0
    runtime.targetWallet = null
    runtime.idlePhase += dt * 1.4
    stepBossOutOfCombat(runtime, dt, fighters, canMoveTo)
    return runtime
  }

  const target = nearestFighterTo(runtime, fighters)
  runtime.targetWallet = target?.wallet || null

  if (!target) return runtime

  if (!runtime.engageAt) runtime.engageAt = performance.now()

  const dx = target.gx - runtime.gx
  const dy = target.gy - runtime.gy
  const dist = Math.hypot(dx, dy) || 0.001
  runtime.facing = approachYaw(runtime.facing, bossFacingFromDelta(dx, dy), dt, 6)
  if (dist > M5_TRUMP_BOSS_ATTACK_RANGE) {
    const step = Math.min(dist - M5_TRUMP_BOSS_ATTACK_RANGE, FULL_SPEED * dt)
    slideTowards(runtime, runtime.gx + (dx / dist) * step, runtime.gy + (dy / dist) * step, canMoveTo)
    return runtime
  }

  const now = performance.now()
  if (now - runtime.engageAt < M5_TRUMP_BOSS_ENGAGE_DELAY_MS) return runtime
  if (now - runtime.lastAttackMs < M5_TRUMP_BOSS_ATTACK_COOLDOWN_MS) return runtime
  runtime.lastAttackMs = now
  runtime.attackUntil = now + ATTACK_MS

  if (!myDead && fighterMatchesLocal(target, myWallet, myIdentity)) {
    onAttack?.({
      wallet: myWallet || myIdentity,
      playerGx: localGx,
      playerGy: localGy,
      bossGx: runtime.gx,
      bossGy: runtime.gy,
    })
  }

  return runtime
}

export function syncBossVisual(group, runtime, bossState, time, groundY = 0) {
  if (!group || !runtime) return
  const visible = bossState?.state !== 'dead' && runtime.visible !== false
  group.visible = visible
  if (!visible) return

  const now = performance.now()
  const active = bossState?.state === 'active' || runtime.combatEngaged
  const attacking = runtime.attackUntil > now
  const hitFlash = runtime.hitFlashUntil > now
  const floorY = Number.isFinite(groundY) ? groundY : 0

  group.position.set(runtime.gx, floorY, runtime.gy)
  group.rotation.y = Number.isFinite(runtime.facing) ? runtime.facing : M5_TRUMP_BOSS_IDLE_FACING
  const bodyPivot = group.userData.bodyPivot
  if (bodyPivot) {
    applyQuadrupedPose(bodyPivot, quadrupedPose({
      time,
      // Engaged but stationary: paws the ground instead of freezing.
      moving: Math.max(runtime.moving || 0, active && !attacking ? 0.22 : 0),
      attackT: attacking ? Math.min(1, (now - runtime.lastAttackMs) / ATTACK_MS) : null,
    }))
    bodyPivot.scale.setScalar(hitFlash ? 1.04 : 1)
    // Eyes only — never tint the whole sculpt red on hit.
    setBossMaskEyesRed(group, hitFlash || active)
  }

  group.updateMatrix()
  group.updateMatrixWorld(true)
  if (bodyPivot) {
    bodyPivot.updateMatrix()
    bodyPivot.updateMatrixWorld(true)
  }
}

export function bossScreenTarget(runtime, camGX, camGY, angle, pitch, projScale, hProj, viewCY, cosP, sinP) {
  if (!runtime || runtime.visible === false) return null
  const rx = runtime.gx - camGX
  const ry = runtime.gy - camGY
  const tY = Math.cos(angle) * rx + Math.sin(angle) * ry
  const tX = -Math.sin(angle) * rx + Math.cos(angle) * ry
  if (tY < 0.2 || tY > 3.2) return null
  const sx = hProj * (tX / tY) + projScale * 0.5
  const sy = viewCY - ((tY * cosP + 0 * sinP) / tY) * projScale
  return { dist: tY, tX, tY, sx, sy, hitZone: Math.abs(sx - projScale * 0.5) < 18 && sy < viewCY - 8 ? 'head' : 'body' }
}
