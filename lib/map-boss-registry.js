import {
  M3_PUTIN_BOSS_ID,
  M3_PUTIN_BOSS_MAP_ID,
  M3_PUTIN_BOSS_NAME,
  M3_PUTIN_BOSS_SPAWN,
  normalizeBossState as normalizeM3BossState,
} from './m3-putin-boss'
import {
  M5_TRUMP_BOSS_ID,
  M5_TRUMP_BOSS_MAP_ID,
  M5_TRUMP_BOSS_NAME,
  M5_TRUMP_BOSS_SPAWN,
  normalizeBossState as normalizeM5BossState,
} from './m5-trump-boss'

export const MAP_BOSS_REGISTRY = Object.freeze({
  [M3_PUTIN_BOSS_MAP_ID]: Object.freeze({
    bossId: M3_PUTIN_BOSS_ID,
    mapId: M3_PUTIN_BOSS_MAP_ID,
    name: M3_PUTIN_BOSS_NAME,
    spawn: M3_PUTIN_BOSS_SPAWN,
    apiBase: '/api/m3-boss',
    normalize: normalizeM3BossState,
    minimapEmoji: '🇷🇺',
  }),
  [M5_TRUMP_BOSS_MAP_ID]: Object.freeze({
    bossId: M5_TRUMP_BOSS_ID,
    mapId: M5_TRUMP_BOSS_MAP_ID,
    name: M5_TRUMP_BOSS_NAME,
    spawn: M5_TRUMP_BOSS_SPAWN,
    apiBase: '/api/m5-boss',
    normalize: normalizeM5BossState,
    minimapEmoji: '👹',
  }),
})

export function getMapBossConfig(mapId) {
  return MAP_BOSS_REGISTRY[String(mapId)] || null
}

export function mapHasBoss(mapId) {
  return Boolean(getMapBossConfig(mapId))
}

export function normalizeBossStateForMap(mapId, row) {
  const cfg = getMapBossConfig(mapId)
  return cfg ? cfg.normalize(row) : null
}
