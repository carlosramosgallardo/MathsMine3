export const BOSS_HAMMER_SICKLE_VFX_MS = 780
export const BOSS_HAMMER_SICKLE_VFX_MAX = 22

function symbolId(at) {
  return `${at}-${Math.random().toString(36).slice(2, 7)}`
}

export function createBossHammerSickleSymbol(opts = {}) {
  return {
    id: symbolId(opts.at ?? performance.now()),
    at: opts.at ?? performance.now(),
    x: Number(opts.x),
    y: Number(opts.y) || 1.15,
    z: Number(opts.z),
    vx: Number(opts.vx) || 0,
    vy: Number(opts.vy) || 0,
    vz: Number(opts.vz) || 0,
    rot: Number(opts.rot) || 0,
    spin: Number(opts.spin) || 0,
    mapId: String(opts.mapId || '3'),
  }
}

export function spawnBossHammerSickleBurst(existing, { fromGx, fromGy, toGx, toGy, at, mapId = '3', count = 6 }) {
  const dx = toGx - fromGx
  const dy = toGy - fromGy
  const dist = Math.hypot(dx, dy) || 1
  const dirX = dx / dist
  const dirY = dy / dist
  const perpX = -dirY
  const perpY = dirX
  const burst = []
  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * 0.55
    const speed = 3.5 + Math.random() * 2.2
    burst.push(createBossHammerSickleSymbol({
      at: at + i * 28 + Math.random() * 24,
      x: fromGx + dirX * 0.35 + (Math.random() - 0.5) * 0.18,
      y: 1.05 + Math.random() * 0.55,
      z: fromGy + dirY * 0.35 + (Math.random() - 0.5) * 0.18,
      vx: dirX * speed + perpX * spread,
      vy: 2.0 + Math.random() * 1.5,
      vz: dirY * speed + perpY * spread,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2.2,
      mapId,
    }))
  }
  const room = Math.max(0, BOSS_HAMMER_SICKLE_VFX_MAX - burst.length)
  return [...(existing || []).slice(-room), ...burst]
}

export function bossHammerSicklePosition(symbol, ageMs) {
  const t = ageMs / 1000
  const gravity = 4.2
  return {
    x: symbol.x + symbol.vx * t,
    y: symbol.y + symbol.vy * t - 0.5 * gravity * t * t,
    z: symbol.z + symbol.vz * t,
    rot: symbol.rot + symbol.spin * t,
  }
}

function drawHammerSickleIcon(ctx, size) {
  const s = size
  ctx.fillStyle = '#dc2626'
  ctx.strokeStyle = '#991b1b'
  ctx.lineWidth = Math.max(1, s * 0.06)
  // Hammer head
  ctx.fillRect(-s * 0.34, -s * 0.42, s * 0.38, s * 0.16)
  ctx.strokeRect(-s * 0.34, -s * 0.42, s * 0.38, s * 0.16)
  // Hammer handle
  ctx.save()
  ctx.translate(-s * 0.08, -s * 0.34)
  ctx.rotate(-0.55)
  ctx.fillRect(-s * 0.04, 0, s * 0.08, s * 0.52)
  ctx.restore()
  // Sickle blade
  ctx.beginPath()
  ctx.arc(s * 0.12, s * 0.08, s * 0.28, Math.PI * 0.15, Math.PI * 1.35)
  ctx.lineWidth = s * 0.11
  ctx.strokeStyle = '#dc2626'
  ctx.stroke()
}

export function drawBossHammerSickleSymbols(ctx, symbols, { mapId, W, H, threeState, now, lowDetail = false }) {
  if (!symbols?.length || mapId !== '3' || !threeState?.camera) return []
  const active = []
  const symSize = lowDetail ? 16 : 22
  const cam = threeState.camera.position
  for (const symbol of symbols) {
    const age = now - symbol.at
    if (age >= BOSS_HAMMER_SICKLE_VFX_MS) continue
    if (age < 0) { active.push(symbol); continue }
    if (symbol.mapId !== mapId) continue
    const pos = bossHammerSicklePosition(symbol, age)
    if (pos.y < 0.05) continue
    const distToCam = Math.hypot(pos.x - cam.x, pos.y - cam.y, pos.z - cam.z)
    if (distToCam < 0.75) continue
    const sv = threeState._v3a
    sv.set(pos.x, pos.y, pos.z)
    sv.project(threeState.camera)
    if (sv.z > 1) continue
    const sx = (sv.x + 1) / 2 * W
    const sy = (-sv.y + 1) / 2 * H
    if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue
    let alpha = 1 - (age / BOSS_HAMMER_SICKLE_VFX_MS) ** 1.6
    if (distToCam < 2.2) alpha *= Math.max(0, (distToCam - 0.75) / 1.45)
    if (alpha < 0.06) continue
    const pop = 0.85 + (1 - Math.min(1, age / 160)) * 0.2
    const depthScale = Math.max(0.45, Math.min(1, distToCam / 3.5))
    const size = symSize * depthScale
    const flutter = Math.sin(age * 0.011 + symbol.rot) * 0.22
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(flutter)
    ctx.scale(pop, pop)
    ctx.globalAlpha = alpha
    ctx.fillStyle = 'rgba(0,0,0,.4)'
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2)
    ctx.fill()
    drawHammerSickleIcon(ctx, size)
    ctx.restore()
    active.push(symbol)
  }
  return active
}
