// Deterministic hourly dice — same window for all clients simultaneously.
// Current product meaning:
//   r1 → activation offset within the hour (1–2699 s, ends by 59:59)
//   r3 → commission modifier: continuous random in [−0.50, +0.50] at 1% precision
// The UI uses a static 🎲 glyph plus the percentage modifier.
// A face lane still exists internally for backward compatibility, but it has no gameplay meaning.

export const DICE_FACES  = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

// negative modifier → cheaper commissions (cyan), positive → pricier (orange)
const COLOR_CHEAP  = '#22d3ee'
const COLOR_PRICEY = '#fb923c'

function seededRand(n) {
  let s = (n ^ 0xdeadbeef) >>> 0
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0
  return ((s ^ (s >>> 16)) >>> 0) / 0x100000000
}

function modifierColor(modifier) {
  return modifier < 0 ? COLOR_CHEAP : COLOR_PRICEY
}

export function getDiceWindowForHour(hourStartMs) {
  const seed = Math.floor(hourStartMs / 3_600_000)
  const r1 = seededRand(seed * 1664525  + 1013904223)  // activation offset
  const r2 = seededRand(seed * 22695477 + 1013904223)  // legacy face lane (unused in product semantics)
  const r3 = seededRand(seed * 6364136  + 1442695041)  // modifier value

  const startSecond = Math.floor(r1 * 2699) + 1        // 1–2699 s into hour
  const faceIndex   = Math.floor(r2 * 6)               // 0–5
  // Continuous modifier rounded to nearest 1% so displayed value is clean
  const modifier    = Math.round((r3 - 0.5) * 100) / 100  // [−0.50, +0.50]

  const startMs = hourStartMs + startSecond * 1000
  const endMs   = startMs + 15 * 60 * 1000
  return {
    startMs, endMs,
    faceIndex,
    face:     DICE_FACES[faceIndex],
    modifier,
    color:    modifierColor(modifier),
  }
}

export function getDiceState(now = Date.now()) {
  const hourStart = Math.floor(now / 3_600_000) * 3_600_000
  const win    = getDiceWindowForHour(hourStart)
  const active = now >= win.startMs && now < win.endMs
  return {
    ...win,
    active,
    hourStart,
    secsLeft: active ? Math.ceil((win.endMs - now) / 1000) : 0,
  }
}
