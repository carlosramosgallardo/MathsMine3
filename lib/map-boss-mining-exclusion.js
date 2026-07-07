import { M3_PUTIN_BOSS_SPAWN } from './m3-putin-boss'
import { M4_KIM_BOSS_SPAWN } from './m4-kim-boss'
import { M5_TRUMP_BOSS_SPAWN } from './m5-trump-boss'
import { CIPHER_HOUSE_BOUNDS } from './mining-world-layout'

/** Keep minable blocks outside this radius (cells) around each map boss arena. */
export const BOSS_MINING_CLEAR_RADIUS = 9
export const BOSS_MINING_CLEAR_RADIUS_SQ = BOSS_MINING_CLEAR_RADIUS * BOSS_MINING_CLEAR_RADIUS

/** M4 lagoon + boss fight space — wider than generic boss radius. */
export const M4_OASIS_BLOCK_EXCLUSION_CENTER = Object.freeze({ row: 27.5, col: 27.5 })
export const M4_OASIS_BLOCK_EXCLUSION_RADIUS = 11
export const M4_OASIS_BLOCK_EXCLUSION_RADIUS_SQ = M4_OASIS_BLOCK_EXCLUSION_RADIUS * M4_OASIS_BLOCK_EXCLUSION_RADIUS

const BOSS_SPAWN_BY_MAP = Object.freeze({
  '3': M3_PUTIN_BOSS_SPAWN,
  '4': M4_KIM_BOSS_SPAWN,
  '5': M5_TRUMP_BOSS_SPAWN,
})

function bossGridCenter(spawn) {
  return {
    row: Number.isFinite(spawn.row) ? spawn.row : Math.round(spawn.gy),
    col: Number.isFinite(spawn.col) ? spawn.col : Math.round(spawn.gx),
  }
}

/** M1 Cipher House footprint — must stay empty on peripheral maps (no ghost floor/roof). */
export function isInM1CipherHouseGhostZone(mapId, row, col) {
  if (String(mapId) === '1') return false
  return (
    row >= CIPHER_HOUSE_BOUNDS.minRow - 2 &&
    row <= CIPHER_HOUSE_BOUNDS.maxRow + 2 &&
    col >= CIPHER_HOUSE_BOUNDS.minCol - 2 &&
    col <= CIPHER_HOUSE_BOUNDS.maxCol + 2
  )
}

export function addM1CipherHouseGhostExclusions(mapId, occupiedSet) {
  if (String(mapId) === '1' || !occupiedSet) return
  for (let row = CIPHER_HOUSE_BOUNDS.minRow - 2; row <= CIPHER_HOUSE_BOUNDS.maxRow + 2; row += 1) {
    for (let col = CIPHER_HOUSE_BOUNDS.minCol - 2; col <= CIPHER_HOUSE_BOUNDS.maxCol + 2; col += 1) {
      occupiedSet.add(`${row},${col}`)
    }
  }
}

export function isInM4OasisLagoonExclusion(row, col) {
  const dr = row - M4_OASIS_BLOCK_EXCLUSION_CENTER.row
  const dc = col - M4_OASIS_BLOCK_EXCLUSION_CENTER.col
  return dr * dr + dc * dc <= M4_OASIS_BLOCK_EXCLUSION_RADIUS_SQ
}

export function isInBossMiningExclusion(mapId, row, col) {
  const spawn = BOSS_SPAWN_BY_MAP[String(mapId)]
  if (!spawn) return false
  const { row: centerRow, col: centerCol } = bossGridCenter(spawn)
  const dr = row - centerRow
  const dc = col - centerCol
  if (dr * dr + dc * dc <= BOSS_MINING_CLEAR_RADIUS_SQ) return true
  if (String(mapId) === '4' && isInM4OasisLagoonExclusion(row, col)) return true
  return false
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
  if (String(mapId) === '4') {
    const minRow = Math.ceil(M4_OASIS_BLOCK_EXCLUSION_CENTER.row - M4_OASIS_BLOCK_EXCLUSION_RADIUS)
    const maxRow = Math.floor(M4_OASIS_BLOCK_EXCLUSION_CENTER.row + M4_OASIS_BLOCK_EXCLUSION_RADIUS)
    const minCol = Math.ceil(M4_OASIS_BLOCK_EXCLUSION_CENTER.col - M4_OASIS_BLOCK_EXCLUSION_RADIUS)
    const maxCol = Math.floor(M4_OASIS_BLOCK_EXCLUSION_CENTER.col + M4_OASIS_BLOCK_EXCLUSION_RADIUS)
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        if (!isInM4OasisLagoonExclusion(row, col)) continue
        occupiedSet.add(`${row},${col}`)
      }
    }
  }
}
