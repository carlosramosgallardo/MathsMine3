import { PEACH_CASTLE_DECOR } from './mining-map-ambient'

export const M3_PUTIN_BOSS_ID = 'm3_putin'
export const M3_PUTIN_BOSS_NAME = 'Vladimir Putin'
export const M3_PUTIN_BOSS_MAP_ID = '3'

/** Easier than M5 — lower HP, softer hits, smaller rewards. */
export const M3_PUTIN_BOSS_MAX_HP = 2500
export const M3_PUTIN_BOSS_HIT_DAMAGE = 12
export const M3_PUTIN_BOSS_CRIT_DAMAGE = 18
export const M3_PUTIN_BOSS_CRIT_CHANCE = 0.12
export const M3_PUTIN_BOSS_RESPAWN_MS = 24 * 60 * 60 * 1000
export const M3_PUTIN_BOSS_MM3_REWARD = 400
export const M3_PUTIN_BOSS_EUR_REWARD = 400

/** Just south of the castle gate — visible, away from central minable blocks. */
const M3_PUTIN_GATE = PEACH_CASTLE_DECOR.castleGate
export const M3_PUTIN_BOSS_SPAWN = Object.freeze({
  row: M3_PUTIN_GATE.z + 3.5,
  col: M3_PUTIN_GATE.x,
  gx: M3_PUTIN_GATE.x + 0.5,
  gy: M3_PUTIN_GATE.z + 3.5,
})

export const M3_PUTIN_BOSS_SCALE = 1.85
export const M3_PUTIN_BOSS_HIT_RANGE = 2.25
export const M3_PUTIN_BOSS_ATTACK_RANGE = 5
export const M3_PUTIN_BOSS_MAX_WANDER = 28
export const M3_PUTIN_BOSS_ATTACK_COOLDOWN_MS = 2200
export const M3_PUTIN_BOSS_ENGAGE_DELAY_MS = 1800
export const M3_PUTIN_BOSS_SPEED_MULT = 2.2
export const M3_PUTIN_BOSS_ATTACK_RANGE_SERVER = M3_PUTIN_BOSS_ATTACK_RANGE + 0.35

export function bossDistanceFromSpawn(gx, gy) {
  return Math.hypot(gx - M3_PUTIN_BOSS_SPAWN.gx, gy - M3_PUTIN_BOSS_SPAWN.gy)
}

export function isBossPositionValid(gx, gy) {
  return bossDistanceFromSpawn(gx, gy) <= M3_PUTIN_BOSS_MAX_WANDER
}

export function normalizeBossState(row) {
  if (!row) {
    return {
      ok: true,
      bossId: M3_PUTIN_BOSS_ID,
      name: M3_PUTIN_BOSS_NAME,
      mapId: M3_PUTIN_BOSS_MAP_ID,
      state: 'idle',
      health: M3_PUTIN_BOSS_MAX_HP,
      maxHealth: M3_PUTIN_BOSS_MAX_HP,
      spawn: M3_PUTIN_BOSS_SPAWN,
      respawnAt: null,
    }
  }
  const now = Date.now()
  let state = row.state || 'idle'
  let health = Number(row.health) || 0
  if (state === 'dead' && row.respawn_at && new Date(row.respawn_at).getTime() <= now) {
    state = 'idle'
    health = M3_PUTIN_BOSS_MAX_HP
  }
  return {
    ok: true,
    bossId: row.id || M3_PUTIN_BOSS_ID,
    name: row.name || M3_PUTIN_BOSS_NAME,
    mapId: row.map_id || M3_PUTIN_BOSS_MAP_ID,
    state,
    health: state === 'dead' ? 0 : health,
    maxHealth: Number(row.max_health) || M3_PUTIN_BOSS_MAX_HP,
    spawn: M3_PUTIN_BOSS_SPAWN,
    respawnAt: row.respawn_at || null,
    damageTotals: row.damage_totals || {},
  }
}

export function splitBossRewards(damageTotals) {
  const entries = Object.entries(damageTotals || {})
    .map(([wallet, damage]) => [wallet, Math.max(0, Number(damage) || 0)])
    .filter(([, damage]) => damage > 0)
  const total = entries.reduce((sum, [, damage]) => sum + damage, 0)
  if (!total) return []
  return entries.map(([wallet, damage]) => ({
    wallet,
    damage,
    share: damage / total,
    mm3: Number((M3_PUTIN_BOSS_MM3_REWARD * (damage / total)).toFixed(4)),
    eur: Number((M3_PUTIN_BOSS_EUR_REWARD * (damage / total)).toFixed(4)),
  }))
}
