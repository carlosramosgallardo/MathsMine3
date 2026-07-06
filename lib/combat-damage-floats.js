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
  if (entry.dodged) return '#00ffff'
  if (entry.kind === 'received') {
    return entry.critical || entry.headshot ? '#ff3333' : '#ff4477'
  }
  return entry.critical || entry.headshot ? '#ffee00' : '#33ff66'
}

export function combatDamageFloatFont(entry, base = 18) {
  const bump = entry.critical || entry.headshot ? 8 : 0
  return `900 ${base + bump}px monospace`
}
