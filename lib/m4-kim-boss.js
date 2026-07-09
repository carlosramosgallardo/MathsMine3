import { bossGatewayIdleFacing } from './map-boss-facing'

export const M4_KIM_BOSS_ID = 'm4_kim'
export const M4_KIM_BOSS_NAME = 'Kim Jong-un'
export const M4_KIM_BOSS_MAP_ID = '4'

/** Mid-tier boss — between M3 Putin and M5 Trump. */
export const M4_KIM_BOSS_MAX_HP = 3500
export const M4_KIM_BOSS_HIT_DAMAGE = 16
export const M4_KIM_BOSS_CRIT_DAMAGE = 24
export const M4_KIM_BOSS_CRIT_CHANCE = 0.13
export const M4_KIM_BOSS_RESPAWN_MS = 24 * 60 * 60 * 1000
export const M4_KIM_BOSS_MM3_REWARD = 700
export const M4_KIM_BOSS_EUR_REWARD = 700

/** Korea lagoon arena centre — gx=col, gy=row. */
export const M4_KIM_BOSS_SPAWN = Object.freeze({
  row: 28,
  col: 28,
  gx: 27.5,
  gy: 27.5,
})

export const M4_KIM_BOSS_IDLE_FACING = bossGatewayIdleFacing('4', M4_KIM_BOSS_SPAWN)

export const M4_KIM_BOSS_SCALE = 1.92
export const M4_KIM_HEAD_TEXTURE_URL = '/images/m4-kim-head.webp'
/** Alpha-cutout face (rounded-rect crop of kim-head.glb's embedded photo) for the mask shell. */
export const M4_KIM_MASK_TEXTURE_URL = '/images/m4-kim-mask.webp'
export const M4_KIM_BOSS_HIT_RANGE = 2.25
export const M4_KIM_BOSS_ATTACK_RANGE = 5
export const M4_KIM_BOSS_MAX_WANDER = 28
export const M4_KIM_BOSS_ATTACK_COOLDOWN_MS = 2100
export const M4_KIM_BOSS_ENGAGE_DELAY_MS = 1900
export const M4_KIM_BOSS_SPEED_MULT = 2.6
export const M4_KIM_BOSS_ATTACK_RANGE_SERVER = M4_KIM_BOSS_ATTACK_RANGE + 0.35

export function bossDistanceFromSpawn(gx, gy) {
  return Math.hypot(gx - M4_KIM_BOSS_SPAWN.gx, gy - M4_KIM_BOSS_SPAWN.gy)
}

export function isBossPositionValid(gx, gy) {
  return bossDistanceFromSpawn(gx, gy) <= M4_KIM_BOSS_MAX_WANDER
}

export function normalizeBossState(row) {
  if (!row) {
    return {
      ok: true,
      bossId: M4_KIM_BOSS_ID,
      name: M4_KIM_BOSS_NAME,
      mapId: M4_KIM_BOSS_MAP_ID,
      state: 'idle',
      health: M4_KIM_BOSS_MAX_HP,
      maxHealth: M4_KIM_BOSS_MAX_HP,
      spawn: M4_KIM_BOSS_SPAWN,
      respawnAt: null,
    }
  }
  const now = Date.now()
  let state = row.state || 'idle'
  let health = Number(row.health) || 0
  if (state === 'dead' && row.respawn_at && new Date(row.respawn_at).getTime() <= now) {
    state = 'idle'
    health = M4_KIM_BOSS_MAX_HP
  }
  return {
    ok: true,
    bossId: row.id || M4_KIM_BOSS_ID,
    name: row.name || M4_KIM_BOSS_NAME,
    mapId: row.map_id || M4_KIM_BOSS_MAP_ID,
    state,
    health: state === 'dead' ? 0 : health,
    maxHealth: Number(row.max_health) || M4_KIM_BOSS_MAX_HP,
    spawn: M4_KIM_BOSS_SPAWN,
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
    mm3: Number((M4_KIM_BOSS_MM3_REWARD * (damage / total)).toFixed(4)),
    eur: Number((M4_KIM_BOSS_EUR_REWARD * (damage / total)).toFixed(4)),
  }))
}
