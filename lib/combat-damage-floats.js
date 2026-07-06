export const COMBAT_DAMAGE_FLOAT_MS = 1300

export function createCombatDamageFloat(opts = {}) {
  return {
    id: `${opts.at ?? performance.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: opts.at ?? performance.now(),
    damage: Math.max(0, Number(opts.damage) || 0),
    kind: opts.kind === 'received' ? 'received' : 'dealt',
    gx: Number(opts.gx),
    gy: Number(opts.gy),
    z: Number(opts.z) || 0,
    yLift: Number(opts.yLift) || 1.1,
    mapId: String(opts.mapId || '1'),
    critical: Boolean(opts.critical),
    headshot: Boolean(opts.headshot),
    dodged: Boolean(opts.dodged),
  }
}

export function combatDamageFloatText(entry) {
  if (entry.dodged) return 'DODGE'
  if (entry.damage <= 0) return ''
  return `-${entry.damage}`
}

export function combatDamageFloatColor(entry) {
  if (entry.dodged) return '#22d3ee'
  if (entry.kind === 'received') return entry.critical || entry.headshot ? '#fca5a5' : '#fb7185'
  return entry.critical || entry.headshot ? '#fbbf24' : '#4ade80'
}

export function combatDamageFloatFont(entry, base = 13) {
  const bump = entry.critical || entry.headshot ? 4 : 0
  return `bold ${base + bump}px monospace`
}
