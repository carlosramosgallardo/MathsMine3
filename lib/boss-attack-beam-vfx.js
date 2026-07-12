// Horizontal attack-range beam drawn from each boss's hands toward the
// attack target. Lasts 520 ms (matches the boss attackUntil window).
export const BOSS_BEAM_VFX_MS = 520

// Per-boss visual style + attack range (in grid cells).
const BEAM_CFG = {
  '3': { color: '#ef4444', r: 239, g: 68,  b: 68,  range: 5 },  // Putin — red
  '4': { color: '#4ade80', r: 74,  g: 222, b: 128, range: 5 },  // Kim   — green
  '5': { color: '#facc15', r: 250, g: 204, b: 21,  range: 5 },  // Trump — gold
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

    // Outer glow halo
    ctx.globalAlpha   = alpha * 0.28
    ctx.shadowBlur    = 28
    ctx.shadowColor   = color
    ctx.strokeStyle   = `rgba(${r},${g},${b},0.45)`
    ctx.lineWidth     = 16 * pulse
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()

    // Mid beam
    ctx.globalAlpha   = alpha * 0.65
    ctx.shadowBlur    = 10
    ctx.strokeStyle   = color
    ctx.lineWidth     = 5 * pulse
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()

    // Bright core
    ctx.globalAlpha   = alpha
    ctx.shadowBlur    = 3
    ctx.strokeStyle   = 'rgba(255,255,255,0.88)'
    ctx.lineWidth     = Math.max(1, 1.8 * pulse)
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()

    ctx.restore()
    active.push(beam)
  }
  return active
}
