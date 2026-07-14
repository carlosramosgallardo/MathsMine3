import { drawBanknote } from './boss-banknote'

export const BOSS_MISSILE_VFX_MS = 920
export const BOSS_MISSILE_VFX_MAX = 18

function symbolId(at) {
  return `${at}-${Math.random().toString(36).slice(2, 7)}`
}

export function createBossMissileSymbol(opts = {}) {
  return {
    id: symbolId(opts.at ?? performance.now()),
    at: opts.at ?? performance.now(),
    x: Number(opts.x),
    y: Number(opts.y) || 1.2,
    z: Number(opts.z),
    vx: Number(opts.vx) || 0,
    vy: Number(opts.vy) || 0,
    vz: Number(opts.vz) || 0,
    rot: Number(opts.rot) || 0,
    spin: Number(opts.spin) || 0,
    trail: Number(opts.trail) || 0,
    mapId: String(opts.mapId || '4'),
  }
}

export function spawnBossMissileBurst(existing, { fromGx, fromGy, toGx, toGy, at, mapId = '4', count = 5 }) {
  const dx = toGx - fromGx
  const dy = toGy - fromGy
  const dist = Math.hypot(dx, dy) || 1
  const dirX = dx / dist
  const dirY = dy / dist
  const perpX = -dirY
  const perpY = dirX
  const burst = []
  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * 0.45
    const speed = 4.2 + Math.random() * 2.8
    const loft = 2.8 + Math.random() * 2.2
    burst.push(createBossMissileSymbol({
      at: at + i * 55 + Math.random() * 40,
      x: fromGx + dirX * 0.4 + (Math.random() - 0.5) * 0.2,
      y: 1.1 + Math.random() * 0.35,
      z: fromGy + dirY * 0.4 + (Math.random() - 0.5) * 0.2,
      vx: dirX * speed + perpX * spread,
      vy: loft,
      vz: dirY * speed + perpY * spread,
      rot: Math.atan2(dirY, dirX) + Math.PI / 2,
      spin: (Math.random() - 0.5) * 0.6,
      trail: Math.random() * Math.PI * 2,
      mapId,
    }))
  }
  const room = Math.max(0, BOSS_MISSILE_VFX_MAX - burst.length)
  return [...(existing || []).slice(-room), ...burst]
}

export function bossMissilePosition(symbol, ageMs) {
  const t = ageMs / 1000
  const gravity = 3.6
  return {
    x: symbol.x + symbol.vx * t,
    y: symbol.y + symbol.vy * t - 0.5 * gravity * t * t,
    z: symbol.z + symbol.vz * t,
    rot: symbol.rot + symbol.spin * t * 0.4,
    trail: symbol.trail + t * 9,
  }
}

export function drawBossMissileSymbols(ctx, symbols, { mapId, W, H, threeState, now, lowDetail = false }) {
  if (!symbols?.length || mapId !== '4' || !threeState?.camera) return []
  const active = []
  // Kim throws North-Korean won banknotes — same bill format as the dollars.
  const billW = lowDetail ? 18 : 24
  const billH = lowDetail ? 10 : 13
  const cam = threeState.camera.position
  for (const symbol of symbols) {
    const age = now - symbol.at
    if (age >= BOSS_MISSILE_VFX_MS) continue
    if (age < 0) { active.push(symbol); continue }
    if (symbol.mapId !== mapId) continue
    const pos = bossMissilePosition(symbol, age)
    if (pos.y < 0.05) continue
    const distToCam = Math.hypot(pos.x - cam.x, pos.y - cam.y, pos.z - cam.z)
    if (distToCam < 0.75) continue
    const sv = threeState._v3a
    sv.set(pos.x, pos.y, pos.z)
    sv.project(threeState.camera)
    if (sv.z > 1) continue
    const sx = (sv.x + 1) / 2 * W
    const sy = (-sv.y + 1) / 2 * H
    if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) continue
    let alpha = 1 - (age / BOSS_MISSILE_VFX_MS) ** 1.4
    if (distToCam < 2.2) alpha *= Math.max(0, (distToCam - 0.75) / 1.45)
    if (alpha < 0.06) continue
    const pop = 0.88 + (1 - Math.min(1, age / 180)) * 0.18
    const depthScale = Math.max(0.5, Math.min(1.1, distToCam / 3.2))
    const w = billW * depthScale
    const h = billH * depthScale
    const flutter = Math.sin(age * 0.011 + symbol.rot) * 0.22
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(flutter)
    ctx.scale(pop, pop)
    ctx.globalAlpha = alpha
    drawBanknote(ctx, w, h, 'kpw', Math.max(7, Math.round((lowDetail ? 8 : 10) * depthScale)))
    ctx.restore()
    active.push(symbol)
  }
  return active
}
