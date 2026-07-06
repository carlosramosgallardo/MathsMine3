export const BOSS_DOLLAR_VFX_MS = 780
export const BOSS_DOLLAR_VFX_MAX = 22

function billId(at) {
  return `${at}-${Math.random().toString(36).slice(2, 7)}`
}

export function createBossDollarBill(opts = {}) {
  return {
    id: billId(opts.at ?? performance.now()),
    at: opts.at ?? performance.now(),
    x: Number(opts.x),
    y: Number(opts.y) || 1.15,
    z: Number(opts.z),
    vx: Number(opts.vx) || 0,
    vy: Number(opts.vy) || 0,
    vz: Number(opts.vz) || 0,
    rot: Number(opts.rot) || 0,
    spin: Number(opts.spin) || 0,
    mapId: String(opts.mapId || '5'),
  }
}

export function spawnBossDollarBurst(existing, { fromGx, fromGy, toGx, toGy, at, mapId = '5', count = 6 }) {
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
    const speed = 3.8 + Math.random() * 2.4
    burst.push(createBossDollarBill({
      at: at + i * 28 + Math.random() * 24,
      x: fromGx + dirX * 0.35 + (Math.random() - 0.5) * 0.18,
      y: 1.05 + Math.random() * 0.55,
      z: fromGy + dirY * 0.35 + (Math.random() - 0.5) * 0.18,
      vx: dirX * speed + perpX * spread,
      vy: 2.1 + Math.random() * 1.6,
      vz: dirY * speed + perpY * spread,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 10,
      mapId,
    }))
  }
  const room = Math.max(0, BOSS_DOLLAR_VFX_MAX - burst.length)
  return [...(existing || []).slice(-room), ...burst]
}

export function bossDollarBillPosition(bill, ageMs) {
  const t = ageMs / 1000
  const gravity = 4.2
  return {
    x: bill.x + bill.vx * t,
    y: bill.y + bill.vy * t - 0.5 * gravity * t * t,
    z: bill.z + bill.vz * t,
    rot: bill.rot + bill.spin * t,
  }
}

export function drawBossDollarBills(ctx, bills, { mapId, W, H, threeState, now, lowDetail = false }) {
  if (!bills?.length || mapId !== '5' || !threeState?.camera) return []
  const active = []
  const billW = lowDetail ? 18 : 24
  const billH = lowDetail ? 10 : 13
  for (const bill of bills) {
    const age = now - bill.at
    if (age < 0 || age >= BOSS_DOLLAR_VFX_MS) continue
    if (bill.mapId !== mapId) continue
    const pos = bossDollarBillPosition(bill, age)
    if (pos.y < 0.05) continue
    const sv = threeState._v3a
    sv.set(pos.x, pos.y, pos.z)
    sv.project(threeState.camera)
    if (sv.z > 1) continue
    const sx = (sv.x + 1) / 2 * W
    const sy = (-sv.y + 1) / 2 * H
    if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue
    const alpha = 1 - (age / BOSS_DOLLAR_VFX_MS) ** 1.6
    const pop = 0.85 + (1 - Math.min(1, age / 160)) * 0.2
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(pos.rot)
    ctx.scale(pop, pop)
    ctx.globalAlpha = alpha
    ctx.fillStyle = 'rgba(0,0,0,.55)'
    ctx.fillRect(-billW / 2 + 1, -billH / 2 + 1, billW, billH)
    ctx.fillStyle = '#86efac'
    ctx.fillRect(-billW / 2, -billH / 2, billW, billH)
    ctx.strokeStyle = '#166534'
    ctx.lineWidth = 1
    ctx.strokeRect(-billW / 2 + 0.5, -billH / 2 + 0.5, billW - 1, billH - 1)
    ctx.strokeStyle = 'rgba(34,197,94,.55)'
    ctx.strokeRect(-billW / 2 + 2, -billH / 2 + 2, billW - 4, billH - 4)
    ctx.font = `900 ${lowDetail ? 8 : 10}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#14532d'
    ctx.fillText('$', 0, 0.5)
    ctx.restore()
    active.push(bill)
  }
  return active
}
