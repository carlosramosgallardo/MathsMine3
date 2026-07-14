import { MYSTIC_ISLE_ARENA } from './mining-map-ambient'
import { bossGatewayIdleFacing } from './map-boss-facing'

export const M5_TRUMP_BOSS_ID = 'm5_trump'
export const M5_TRUMP_BOSS_NAME = 'Donald Trump'
export const M5_TRUMP_BOSS_MAP_ID = '5'

export const M5_TRUMP_BOSS_MAX_HP = 5000
export const M5_TRUMP_BOSS_HIT_DAMAGE = 20
export const M5_TRUMP_BOSS_CRIT_DAMAGE = 30
/** Boss melee crit chance (server-side roll). */
export const M5_TRUMP_BOSS_CRIT_CHANCE = 0.15
export const M5_TRUMP_BOSS_RESPAWN_MS = 24 * 60 * 60 * 1000
export const M5_TRUMP_BOSS_MM3_REWARD = 1000
export const M5_TRUMP_BOSS_EUR_REWARD = 1000

/** Grid centre of Epstein Island (M5). */
export const M5_TRUMP_BOSS_SPAWN = Object.freeze({
  row: Math.round(MYSTIC_ISLE_ARENA.row),
  col: Math.round(MYSTIC_ISLE_ARENA.col),
  gx: MYSTIC_ISLE_ARENA.col + 0.5,
  gy: MYSTIC_ISLE_ARENA.row + 0.5,
})

export const M5_TRUMP_BOSS_IDLE_FACING = bossGatewayIdleFacing('5', M5_TRUMP_BOSS_SPAWN)

// Boss heights are anchored here: scale 2 ≡ 190 cm (local body 0.72 + head 0.64).
export const M5_TRUMP_BOSS_SCALE = 2
export const M5_TRUMP_HEAD_TEXTURE_URL = '/images/m5-trump-head.webp'
/** Alpha-cutout face (from trump-head.glb's embedded image) — mask silhouette follows hair/jaw. */
export const M5_TRUMP_MASK_TEXTURE_URL = '/images/m5-trump-mask.webp'
export const M5_TRUMP_BOSS_HIT_RANGE = 2.25
/** Boss melee reach in grid cells — wide but out of range beyond ~5 cells. */
export const M5_TRUMP_BOSS_ATTACK_RANGE = 5
export const M5_TRUMP_BOSS_MAX_WANDER = 28
/** Minimum ms between boss hits and before the first hit after combat starts. */
export const M5_TRUMP_BOSS_ATTACK_COOLDOWN_MS = 2000
export const M5_TRUMP_BOSS_ENGAGE_DELAY_MS = 2000
export const M5_TRUMP_BOSS_SPEED_MULT = 3
/** Server-side tolerance above client attack range (latency / movement). */
export const M5_TRUMP_BOSS_ATTACK_RANGE_SERVER = M5_TRUMP_BOSS_ATTACK_RANGE + 0.35

export function bossDistanceFromSpawn(gx, gy) {
  return Math.hypot(gx - M5_TRUMP_BOSS_SPAWN.gx, gy - M5_TRUMP_BOSS_SPAWN.gy)
}

export function isBossPositionValid(gx, gy) {
  return bossDistanceFromSpawn(gx, gy) <= M5_TRUMP_BOSS_MAX_WANDER
}

export function normalizeBossState(row) {
  if (!row) {
    return {
      ok: true,
      bossId: M5_TRUMP_BOSS_ID,
      name: M5_TRUMP_BOSS_NAME,
      mapId: M5_TRUMP_BOSS_MAP_ID,
      state: 'idle',
      health: M5_TRUMP_BOSS_MAX_HP,
      maxHealth: M5_TRUMP_BOSS_MAX_HP,
      spawn: M5_TRUMP_BOSS_SPAWN,
      respawnAt: null,
    }
  }
  const now = Date.now()
  let state = row.state || 'idle'
  let health = Number(row.health) || 0
  if (state === 'dead' && row.respawn_at && new Date(row.respawn_at).getTime() <= now) {
    state = 'idle'
    health = M5_TRUMP_BOSS_MAX_HP
  }
  return {
    ok: true,
    bossId: row.id || M5_TRUMP_BOSS_ID,
    name: row.name || M5_TRUMP_BOSS_NAME,
    mapId: row.map_id || M5_TRUMP_BOSS_MAP_ID,
    state,
    health: state === 'dead' ? 0 : health,
    maxHealth: Number(row.max_health) || M5_TRUMP_BOSS_MAX_HP,
    spawn: M5_TRUMP_BOSS_SPAWN,
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
    mm3: Number((M5_TRUMP_BOSS_MM3_REWARD * (damage / total)).toFixed(4)),
    eur: Number((M5_TRUMP_BOSS_EUR_REWARD * (damage / total)).toFixed(4)),
  }))
}
