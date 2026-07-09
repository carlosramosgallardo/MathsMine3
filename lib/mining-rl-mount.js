import { FROST_COLISEUM_ARENA } from './mining-map-ambient'
import { MINING_CORE_MAP_ID } from './mining-maps'
import { getBlockMapId } from './mining-block-maps'

/** RL Coliseum (M2) — mount node and Octane-style car purchase. */
export const RL_NODE_POSITION = Object.freeze({ row: 27, col: 27 })
export const RL_NODE_ICON = 'rl-suv'
export const RL_NODE_EVENT_EMOJI = '🚙'

/** Exact arena-centre world coords (cell centres are offset on a half-grid). */
export function getRlNodeWorldCenter() {
  return {
    x: FROST_COLISEUM_ARENA.col + 0.5,
    z: FROST_COLISEUM_ARENA.row + 0.5,
  }
}
export const RL_NODE_PRICE_MM3 = 10
export const RL_NODE_MIN_LEVEL = 10
export const RL_MOUNT_SPEED_MULT = 2
export const RL_MOUNT_JUMP_MULT = 2

export function buildRlNodeCell() {
  return {
    isRlNode: true,
    emoji: RL_NODE_ICON,
    titleEn: 'RL NODE',
    titleEs: 'NODO RL',
    color: '#0ea5e9',
  }
}

function cellBelongsToMap(cell, mapId) {
  if (!cell) return false
  if (cell.isChainNode || cell.isPortalNode || cell.isNodeDiceNode) {
    return mapId === MINING_CORE_MAP_ID
  }
  if (cell.isRlNode) return mapId === '2'
  if (cell.blockHex || cell.isMarket) {
    return (cell.mapId || getBlockMapId(cell.blockHex)) === mapId
  }
  return false
}

/** Active interactables + minable blocks for the map the player is on. */
export function buildActiveCellMap(mapId, fullCellMap) {
  const id = String(mapId || MINING_CORE_MAP_ID)
  const map = new Map()
  if (!fullCellMap) return map

  for (const [key, cell] of fullCellMap) {
    if (!cellBelongsToMap(cell, id)) continue
    map.set(key, cell)
  }

  if (id === '2') {
    const rlKey = `${RL_NODE_POSITION.row},${RL_NODE_POSITION.col}`
    if (!map.has(rlKey)) {
      map.set(rlKey, buildRlNodeCell())
    }
  }

  return map
}

/** @deprecated Use buildActiveCellMap(mapId, fullCellMap) */
export function buildPeripheralCellMap(mapId) {
  return buildActiveCellMap(mapId, new Map())
}
