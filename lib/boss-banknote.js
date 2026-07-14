/**
 * Painted banknotes for the boss attack VFX — one bill style per boss:
 * Trump throws dollars, Putin rubles, Kim North-Korean won. Same visual
 * grammar for all three (shadow, base, double border, big currency glyph)
 * so the attacks read as siblings; only the palette/glyph changes.
 */
export const BOSS_BANKNOTES = Object.freeze({
  usd: { base: '#bbf7d0', border: '#15803d', borderSoft: 'rgba(22,101,52,.45)', ink: '#14532d', glyph: '$' },
  // 5000₽ — the big Russian note is red-orange.
  rub: { base: '#fcd9a8', border: '#c2410c', borderSoft: 'rgba(124,45,18,.45)', ink: '#7c2d12', glyph: '₽' },
  // 5000₩ DPRK (Kim Il-sung series) — predominantly violet/purple.
  kpw: { base: '#ddc9e8', border: '#7e22ce', borderSoft: 'rgba(88,28,135,.45)', ink: '#581c87', glyph: '₩' },
})

/** Draws a w×h bill centred on the current origin (caller translates/rotates). */
export function drawBanknote(ctx, w, h, code, fontPx) {
  const spec = BOSS_BANKNOTES[code]
  if (!spec) return
  ctx.fillStyle = 'rgba(0,0,0,.45)'
  ctx.fillRect(-w / 2 + 1, -h / 2 + 1, w, h)
  ctx.fillStyle = spec.base
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.strokeStyle = spec.border
  ctx.lineWidth = 1
  ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1)
  ctx.strokeStyle = spec.borderSoft
  ctx.strokeRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4)
  ctx.font = `900 ${fontPx}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = spec.ink
  ctx.fillText(spec.glyph, 0, 0.5)
}
