import { FROST_COLISEUM_ARENA } from './mining-map-ambient'

/** RL Coliseum (M2) — mount node and Octane-style car purchase. */
export const RL_NODE_POSITION = Object.freeze({ row: 27, col: 27 })

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
    emoji: '🏎️',
    titleEn: 'RL NODE',
    titleEs: 'NODO RL',
    color: '#0ea5e9',
  }
}

export function buildPeripheralCellMap(mapId) {
  const map = new Map()
  if (String(mapId) === '2') {
    map.set(`${RL_NODE_POSITION.row},${RL_NODE_POSITION.col}`, buildRlNodeCell())
  }
  return map
}
