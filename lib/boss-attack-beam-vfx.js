import { drawHammerSickleIcon } from './m3-boss-hammer-sickle-vfx.js'
import { drawMissileIcon } from './m4-boss-missile-vfx.js'

// ─── Line beam (used in Mining game) ────────────────────────────────────────
// Horizontal attack-range beam drawn from each boss's hands toward the
// attack target. Lasts 520 ms (matches the boss attackUntil window).
export const BOSS_BEAM_VFX_MS = 520

// Per-boss visual style + attack range (in grid cells).
const BEAM_CFG = {
  '3': { color: '#ef4444', r: 239, g: 68,  b: 68,  range: 5 },  // Putin — red
  '4': { color: '#facc15', r: 250, g: 204, b: 21,  range: 5 },  // Kim   — gold
  '5': { color: '#4ade80', r: 74,  g: 222, b: 128, range: 5 },  // Trump — green
}

// Spawn one beam record.  `fromGx/Gy` = boss grid position,
// `toGx/Gy` = target (player) grid position.
// `range` overrides cfg.range — pass it when the coordinate system uses
// different units (e.g. home scene world-space vs. mining grid cells).
export function spawnBossAttackBeam(existing, { fromGx, fromGy, toGx, toGy, at, mapId, range }) {
  const cfg = BEAM_CFG[mapId]
  if (!cfg) return existing || []

  const dx = toGx - fromGx
  const dy = toGy - fromGy
  const dist = Math.hypot(dx, dy)
  if (dist < 0.01) return existing || []   // no valid direction

  const nx = dx / dist
  const ny = dy / dist
  const r  = range ?? cfg.range

  return [
    ...(existing || []).slice(-6),
    {
      at,
      mapId,
      // Origin: slightly forward of boss centre so it looks like it leaves
      // the hands rather than the body core.
      ox: fromGx + nx * 0.3,
      oy: fromGy + ny * 0.3,
      // End: r units along the attack direction.
      ex: fromGx + nx * r,
      ey: fromGy + ny * r,
    },
  ]
}

// Draw all active beams on the 2-D overlay canvas.  Uses threeState scratch
// vectors _v3a (origin) and _v3b (end).
export function drawBossAttackBeams(ctx, beams, { mapId, W, H, threeState, now }) {
  if (!beams?.length || !threeState?.camera) return []
  const cfg = BEAM_CFG[mapId]
  if (!cfg) return []

  const active = []
  const sv1 = threeState._v3a
  const sv2 = threeState._v3b
  const HAND_Y = 1.1   // hand height in world-space grid units

  for (const beam of beams) {
    if (beam.mapId !== mapId) continue
    const age = now - beam.at
    if (age >= BOSS_BEAM_VFX_MS) continue

    const t = age / BOSS_BEAM_VFX_MS
    const fadeIn = Math.min(1, age / 65)       // fast 65 ms ramp-in
    const alpha  = fadeIn * (1 - t ** 1.2) * 0.9
    if (alpha < 0.025) { active.push(beam); continue }

    // Project both endpoints to screen space.
    sv1.set(beam.ox, HAND_Y, beam.oy)
    sv1.project(threeState.camera)
    if (sv1.z > 1) { active.push(beam); continue }   // behind camera

    sv2.set(beam.ex, HAND_Y, beam.ey)
    sv2.project(threeState.camera)

    const x1 = (sv1.x + 1) / 2 * W
    const y1 = (-sv1.y + 1) / 2 * H
    const x2 = (sv2.x + 1) / 2 * W
    const y2 = (-sv2.y + 1) / 2 * H

    // Cull if both ends are clearly off-screen in the same direction.
    if (x1 < -W   && x2 < -W)   continue
    if (x1 > 2*W  && x2 > 2*W)  continue
    if (y1 < -H   && y2 < -H)   continue
    if (y1 > 2*H  && y2 > 2*H)  continue

    const pulse = 1 + Math.sin(age * 0.028) * 0.12
    const { color, r, g, b } = cfg

    ctx.save()
    ctx.lineCap = 'round'
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'

    // Wide soft halo — no canvas shadow to avoid color bleed between bosses
    ctx.strokeStyle = `rgba(${r},${g},${b},1)`
    ctx.globalAlpha = alpha * 0.12
    ctx.lineWidth   = 28 * pulse
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()

    ctx.globalAlpha = alpha * 0.22
    ctx.lineWidth   = 16 * pulse
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()

    // Mid beam
    ctx.globalAlpha = alpha * 0.70
    ctx.lineWidth   = 5 * pulse
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()

    // Bright core
    ctx.globalAlpha = alpha
    ctx.strokeStyle = `rgba(255,255,255,0.90)`
    ctx.lineWidth   = Math.max(1, 2 * pulse)
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()

    ctx.restore()
    active.push(beam)
  }
  return active
}

// ─── Boss attack trail (used in Home showcase) ───────────────────────────────
// Elements (boss-specific symbols) shoot out one by one from the boss's hands
// along the attack direction, with a colored glow. Replaces both the line beam
// and the random burst VFX in the home scene.

const TRAIL_N           = 7    // elements per trail
const TRAIL_INTERVAL_MS = 60   // ms gap between consecutive elements appearing
const TRAIL_ELEMENT_MS  = 620  // lifespan of each element once it spawns
const TRAIL_TOTAL_MS    = (TRAIL_N - 1) * TRAIL_INTERVAL_MS + TRAIL_ELEMENT_MS

const TRAIL_CFG = {
  '3': { r: 239, g: 68,  b: 68  },  // Putin — red
  '4': { r: 250, g: 204, b: 21  },  // Kim   — gold
  '5': { r: 74,  g: 222, b: 128 },  // Trump — green
}

export function spawnBossTrail(existing, { fromGx, fromGy, toGx, toGy, at, mapId, range = 8 }) {
  const cfg = TRAIL_CFG[mapId]
  if (!cfg) return existing || []
  const dx = toGx - fromGx
  const dy = toGy - fromGy
  const dist = Math.hypot(dx, dy)
  if (dist < 0.01) return existing || []
  return [
    ...(existing || []).slice(-3),
    { at, mapId, ox: fromGx, oy: fromGy, nx: dx / dist, ny: dy / dist, range },
  ]
}

export function drawBossTrail(ctx, trails, { mapId, W, H, threeState, now }) {
  if (!trails?.length || !threeState?.camera) return []
  const cfg = TRAIL_CFG[mapId]
  if (!cfg) return []
  const { r, g, b } = cfg
  const sv1 = threeState._v3a
  const sv2 = threeState._v3b
  const HAND_Y = 1.1
  const active = []

  for (const trail of trails) {
    if (trail.mapId !== mapId) continue
    if (now - trail.at >= TRAIL_TOTAL_MS) continue
    active.push(trail)

    // Screen-space beam direction — used for missile rotation.
    // Project origin and one unit ahead, take the delta in screen coords.
    sv1.set(trail.ox, HAND_Y, trail.oy)
    sv1.project(threeState.camera)
    sv2.set(trail.ox + trail.nx, HAND_Y, trail.oy + trail.ny)
    sv2.project(threeState.camera)
    const dsx = sv2.x - sv1.x
    const dsy = sv1.y - sv2.y  // flip Y: NDC Y-up → canvas Y-down
    const screenAngle = Math.atan2(dsy, dsx)

    const step = trail.range / TRAIL_N

    for (let i = 0; i < TRAIL_N; i++) {
      const elemAge = now - (trail.at + i * TRAIL_INTERVAL_MS)
      if (elemAge < 0 || elemAge >= TRAIL_ELEMENT_MS) continue

      const d = (i + 1) * step
      sv1.set(trail.ox + trail.nx * d, HAND_Y, trail.oy + trail.ny * d)
      sv1.project(threeState.camera)
      if (sv1.z > 1) continue
      const sx = (sv1.x + 1) / 2 * W
      const sy = (-sv1.y + 1) / 2 * H
      if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) continue

      const fadeIn  = Math.min(1, elemAge / 80)
      const fadeOut = elemAge > 80
        ? Math.max(0, 1 - ((elemAge - 80) / (TRAIL_ELEMENT_MS - 80)) ** 1.3)
        : 1
      const alpha = fadeIn * fadeOut
      if (alpha < 0.03) continue

      ctx.save()
      ctx.shadowBlur    = 0
      ctx.shadowColor   = 'transparent'

      // Soft glow aura in boss color (no canvas shadow to avoid cross-boss bleed)
      ctx.fillStyle = `rgba(${r},${g},${b},1)`
      ctx.globalAlpha = alpha * 0.14
      ctx.beginPath(); ctx.arc(sx, sy, 38, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = alpha * 0.28
      ctx.beginPath(); ctx.arc(sx, sy, 20, 0, Math.PI * 2); ctx.fill()

      ctx.translate(sx, sy)
      ctx.globalAlpha = alpha

      if (mapId === '5') {
        // Trump — dollar bill
        const flutter = Math.sin(elemAge * 0.009 + i * 0.7) * 0.15
        ctx.rotate(flutter)
        const w = 28, h = 16
        ctx.fillStyle = 'rgba(0,0,0,.4)'
        ctx.fillRect(-w / 2 + 1, -h / 2 + 1, w, h)
        ctx.fillStyle = '#bbf7d0'
        ctx.fillRect(-w / 2, -h / 2, w, h)
        ctx.strokeStyle = '#15803d'
        ctx.lineWidth = 1
        ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1)
        ctx.strokeRect(-w / 2 + 2,   -h / 2 + 2,   w - 4, h - 4)
        ctx.font = '900 11px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#14532d'
        ctx.fillText('$', 0, 0.5)
      } else if (mapId === '3') {
        // Putin — hammer & sickle
        drawHammerSickleIcon(ctx, 22)
      } else if (mapId === '4') {
        // Kim — missile pointing in beam direction
        // At rot=0 missile faces up; +π/2 rotates to face right → add screenAngle
        drawMissileIcon(ctx, 24, screenAngle + Math.PI / 2)
      }

      ctx.restore()
    }
  }
  return active
}
