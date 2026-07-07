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

function drawStar(ctx, cx, cy, r, points = 5) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i += 1) {
    const angle = (i * Math.PI) / points - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.42
    const px = cx + Math.cos(angle) * rad
    const py = cy + Math.sin(angle) * rad
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

function drawMissileIcon(ctx, size, rot) {
  const s = size
  ctx.save()
  ctx.rotate(rot)
  // Exhaust plume
  const grad = ctx.createLinearGradient(0, s * 0.5, 0, s * 0.95)
  grad.addColorStop(0, 'rgba(251,146,60,0)')
  grad.addColorStop(0.4, 'rgba(251,146,60,0.85)')
  grad.addColorStop(1, 'rgba(239,68,68,0.95)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(-s * 0.12, s * 0.42)
  ctx.lineTo(0, s * 0.92)
  ctx.lineTo(s * 0.12, s * 0.42)
  ctx.closePath()
  ctx.fill()
  // Body
  ctx.fillStyle = '#64748b'
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = Math.max(1, s * 0.05)
  ctx.beginPath()
  ctx.roundRect(-s * 0.1, -s * 0.38, s * 0.2, s * 0.72, s * 0.04)
  ctx.fill()
  ctx.stroke()
  // Nose cone
  ctx.fillStyle = '#dc2626'
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.55)
  ctx.lineTo(-s * 0.1, -s * 0.38)
  ctx.lineTo(s * 0.1, -s * 0.38)
  ctx.closePath()
  ctx.fill()
  // Juche star on nose
  ctx.fillStyle = '#fef08a'
  drawStar(ctx, 0, -s * 0.44, s * 0.09, 5)
  // Fins
  ctx.fillStyle = '#475569'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * s * 0.1, s * 0.28)
    ctx.lineTo(side * s * 0.28, s * 0.42)
    ctx.lineTo(side * s * 0.1, s * 0.42)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

export function drawBossMissileSymbols(ctx, symbols, { mapId, W, H, threeState, now, lowDetail = false }) {
  if (!symbols?.length || mapId !== '4' || !threeState?.camera) return []
  const active = []
  const symSize = lowDetail ? 18 : 26
  const cam = threeState.camera.position
  for (const symbol of symbols) {
    const age = now - symbol.at
    if (age < 0 || age >= BOSS_MISSILE_VFX_MS) continue
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
    const size = symSize * depthScale
    ctx.save()
    ctx.translate(sx, sy)
    ctx.scale(pop, pop)
    ctx.globalAlpha = alpha
    // Smoke trail sparks
    for (let i = 0; i < 3; i += 1) {
      const phase = pos.trail + i * 1.4
      const tx = Math.sin(phase) * size * 0.35
      const ty = size * (0.35 + i * 0.22)
      ctx.fillStyle = `rgba(251,146,60,${alpha * (0.35 - i * 0.08)})`
      ctx.beginPath()
      ctx.arc(tx, ty, size * (0.14 - i * 0.03), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(0,0,0,.35)'
    ctx.beginPath()
    ctx.ellipse(0, size * 0.15, size * 0.35, size * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()
    drawMissileIcon(ctx, size, pos.rot)
    ctx.restore()
    active.push(symbol)
  }
  return active
}
