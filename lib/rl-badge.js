/**
 * Rocket-league style badge for the RL node — a low wedge battle-car with a
 * rear wing, boosting nose-up toward a glowing ball. Shared by the 3D node
 * sprite (128px canvas) and the minimaps (chips down to ~5px radius), so all
 * RL markers look the same. Scene is designed in a 100-unit space (u = r/50)
 * and fits inside the badge circle.
 */
export function drawRlBadge(ctx, cx, cy, r, { ring = true, ringColor = '#0ea5e9' } = {}) {
  ctx.save()
  ctx.translate(cx, cy)
  if (ring) {
    ctx.shadowColor = ringColor
    ctx.shadowBlur = Math.max(3, r * 0.3)
    ctx.fillStyle = 'rgba(1,7,14,.94)'
    ctx.strokeStyle = ringColor
    ctx.lineWidth = Math.max(1, r * 0.11)
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0
  }
  // Scene extends ~55 design units at the flame tip — u = r/64 keeps a clear
  // margin to the ring so the car never overlaps the badge border.
  const u = r / 64

  // Ball — glowing, top-right, where the car's nose points.
  ctx.save()
  ctx.translate(27 * u, -23 * u)
  ctx.shadowColor = '#7dd3fc'
  ctx.shadowBlur = 7 * u
  ctx.fillStyle = '#e2e8f0'
  ctx.beginPath()
  ctx.arc(0, 0, 11 * u, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = Math.max(0.5, 1.3 * u)
  ctx.stroke()
  ctx.fillStyle = '#475569'
  ctx.beginPath()
  ctx.arc(0, 0, 3.4 * u, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5)
    ctx.beginPath()
    ctx.arc(Math.cos(a) * 7.4 * u, Math.sin(a) * 7.4 * u, 1.9 * u, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // Car + boost, tilted nose-up toward the ball.
  ctx.save()
  ctx.translate(-7 * u, 12 * u)
  ctx.rotate(-0.30)

  // Boost flame: layered cones out the rear, plus two speed streaks.
  const flame = (len, half, color) => {
    ctx.beginPath()
    ctx.moveTo(-30 * u, -half * u)
    ctx.quadraticCurveTo((-30 - len * 0.55) * u, -half * 0.3 * u, (-30 - len) * u, 0)
    ctx.quadraticCurveTo((-30 - len * 0.55) * u, half * 0.3 * u, -30 * u, half * u)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.shadowColor = '#fb923c'
  ctx.shadowBlur = 6 * u
  flame(24, 6.5, '#f97316')
  flame(15, 3.6, '#fde047')
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(125,211,252,.55)'
  ctx.lineWidth = Math.max(0.5, 1.2 * u)
  ctx.beginPath()
  ctx.moveTo(-34 * u, -10 * u)
  ctx.lineTo(-46 * u, -8 * u)
  ctx.moveTo(-32 * u, 12 * u)
  ctx.lineTo(-44 * u, 13 * u)
  ctx.stroke()

  // Rear wing (the rocket-league silhouette signature).
  ctx.strokeStyle = '#0c4a6e'
  ctx.lineWidth = Math.max(0.8, 2 * u)
  ctx.beginPath()
  ctx.moveTo(-26 * u, -8 * u)
  ctx.lineTo(-33 * u, -13 * u)
  ctx.stroke()
  ctx.fillStyle = '#38bdf8'
  ctx.beginPath()
  ctx.moveTo(-36 * u, -15.5 * u)
  ctx.lineTo(-27 * u, -12.5 * u)
  ctx.lineTo(-28 * u, -9.5 * u)
  ctx.lineTo(-37 * u, -12.5 * u)
  ctx.closePath()
  ctx.fill()

  // Body: low aggressive wedge, pointy nose right.
  const body = new Path2D()
  body.moveTo(-30 * u, 4 * u)
  body.lineTo(-31 * u, -6 * u)
  body.lineTo(-13 * u, -11 * u)
  body.lineTo(3 * u, -8.5 * u)
  body.lineTo(33 * u, -2 * u)
  body.lineTo(33 * u, 3 * u)
  body.closePath()
  ctx.fillStyle = '#0e7fc4'
  ctx.fill(body)
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = Math.max(0.5, 1.2 * u)
  ctx.stroke(body)

  // Canopy window.
  ctx.fillStyle = '#0b1826'
  ctx.beginPath()
  ctx.moveTo(-11 * u, -9.5 * u)
  ctx.lineTo(1 * u, -7.5 * u)
  ctx.lineTo(3 * u, -3.5 * u)
  ctx.lineTo(-13 * u, -4.5 * u)
  ctx.closePath()
  ctx.fill()

  // Side accent stripe.
  ctx.strokeStyle = '#fb923c'
  ctx.lineWidth = Math.max(0.6, 1.6 * u)
  ctx.beginPath()
  ctx.moveTo(-26 * u, 0.5 * u)
  ctx.lineTo(28 * u, -0.5 * u)
  ctx.stroke()

  // Wheels: dark tires with light rims.
  for (const [wx, wr] of [[-18, 6.2], [19, 5.4]]) {
    ctx.beginPath()
    ctx.arc(wx * u, 5.5 * u, wr * u, 0, Math.PI * 2)
    ctx.fillStyle = '#0f172a'
    ctx.fill()
    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = Math.max(0.5, 1.2 * u)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(wx * u, 5.5 * u, wr * 0.45 * u, 0, Math.PI * 2)
    ctx.fillStyle = '#7dd3fc'
    ctx.fill()
  }

  ctx.restore()
  ctx.restore()
}
