import { M3_PUTIN_BOSS_SPAWN } from './m3-putin-boss'
import { M5_TRUMP_BOSS_SPAWN } from './m5-trump-boss'

/** Keep minable blocks outside this radius (cells) around each map boss arena. */
export const BOSS_MINING_CLEAR_RADIUS = 9
export const BOSS_MINING_CLEAR_RADIUS_SQ = BOSS_MINING_CLEAR_RADIUS * BOSS_MINING_CLEAR_RADIUS

const BOSS_SPAWN_BY_MAP = Object.freeze({
  '3': M3_PUTIN_BOSS_SPAWN,
  '5': M5_TRUMP_BOSS_SPAWN,
})

function bossGridCenter(spawn) {
  return {
    row: Number.isFinite(spawn.row) ? spawn.row : Math.round(spawn.gy),
    col: Number.isFinite(spawn.col) ? spawn.col : Math.round(spawn.gx),
  }
}

export function isInBossMiningExclusion(mapId, row, col) {
  const spawn = BOSS_SPAWN_BY_MAP[String(mapId)]
  if (!spawn) return false
  const { row: centerRow, col: centerCol } = bossGridCenter(spawn)
  const dr = row - centerRow
  const dc = col - centerCol
  return dr * dr + dc * dc <= BOSS_MINING_CLEAR_RADIUS_SQ
}

export function addBossMiningExclusions(mapId, occupiedSet) {
  const spawn = BOSS_SPAWN_BY_MAP[String(mapId)]
  if (!spawn || !occupiedSet) return
  const { row: centerRow, col: centerCol } = bossGridCenter(spawn)
  const r = BOSS_MINING_CLEAR_RADIUS
  for (let dr = -r; dr <= r; dr += 1) {
    for (let dc = -r; dc <= r; dc += 1) {
      if (dr * dr + dc * dc > BOSS_MINING_CLEAR_RADIUS_SQ) continue
      occupiedSet.add(`${centerRow + dr},${centerCol + dc}`)
    }
  }
}
