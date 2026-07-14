/**
 * Painted minimap flags — flag emojis do not render on Windows canvases, so
 * every boss/statue marker draws its country as stripes. Shared by the live
 * FPV minimap and the home world minimap.
 */
export const MINIMAP_FLAGS = Object.freeze({
  ru: { dir: 'h', stripes: ['#f8fafc', '#2563eb', '#dc2626'] },
  kp: { dir: 'h', stripes: ['#1d4ed8', '#dc2626', '#1d4ed8'] },
  us: { dir: 'h', stripes: ['#b22234', '#f8fafc', '#b22234'], canton: '#3c3b6e' },
  ar: { dir: 'h', stripes: ['#74acdf', '#f8fafc', '#74acdf'], dot: '#fcbf49' },
  ua: { dir: 'h', stripes: ['#005bbb', '#ffd500'] },
  // EU — blue field with the ring of gold stars (Zelensky's marker).
  eu: { dir: 'h', stripes: ['#003399'], starRing: '#ffcc00' },
  fr: { dir: 'v', stripes: ['#0055a4', '#f8fafc', '#ef4135'] },
})

/** Paints the flag body (no border/shadow — the caller owns marker styling). */
export function drawMinimapFlag(ctx, fx, fy, w, h, code) {
  const spec = MINIMAP_FLAGS[code]
  if (!spec) return
  const n = spec.stripes.length
  spec.stripes.forEach((color, i) => {
    ctx.fillStyle = color
    if (spec.dir === 'v') ctx.fillRect(fx + (i * w) / n, fy, w / n, h)
    else ctx.fillRect(fx, fy + (i * h) / n, w, h / n)
  })
  if (spec.canton) {
    ctx.fillStyle = spec.canton
    ctx.fillRect(fx, fy, w * 0.42, (h / n) * 1.5)
  }
  if (spec.dot) {
    ctx.fillStyle = spec.dot
    ctx.beginPath()
    ctx.arc(fx + w / 2, fy + h / 2, Math.min(w, h) * 0.16, 0, Math.PI * 2)
    ctx.fill()
  }
  if (spec.starRing) {
    // 12 stars reduced to a dotted ring — real stars don't survive flag sizes.
    ctx.fillStyle = spec.starRing
    const cx = fx + w / 2
    const cy = fy + h / 2
    const dotR = Math.max(0.5, h * 0.07)
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * h * 0.32, cy + Math.sin(a) * h * 0.32, dotR, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
