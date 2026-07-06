import {
  MINING_WORLD_PLAYABLE_MAX_COL,
  MINING_WORLD_PLAYABLE_MAX_ROW,
  MINING_WORLD_PLAYABLE_MIN_COL,
  MINING_WORLD_PLAYABLE_MIN_ROW,
} from './mining-world-layout'

export const MINING_GATEWAY_CORRIDOR_DEPTH = 12

/** M1-connected edge on each peripheral map. */
export const PERIPHERAL_M1_GATEWAY_EDGE = Object.freeze({
  '2': 'south',
  '3': 'north',
  '4': 'west',
  '5': 'east',
})

/** Hand-tuned NE cells that blocked sight toward the north gateways (M2). */
const M1_NORTH_EXTRA_CLEAR = Object.freeze([
  '5,52', '1,50', '1,51', '2,45', '1,45', '4,43', '5,44', '3,40', '2,39', '2,38',
  '1,37', '4,36', '5,33', '5,32', '4,31', '3,30', '1,31', '1,32',
])

let m1GatewaySightClearCache = null
const peripheralGatewaySightClearCache = new Map()

function addFullEdgeStrip(clear, side, depth = MINING_GATEWAY_CORRIDOR_DEPTH) {
  const r0 = MINING_WORLD_PLAYABLE_MIN_ROW
  const r1 = MINING_WORLD_PLAYABLE_MAX_ROW
  const c0 = MINING_WORLD_PLAYABLE_MIN_COL
  const c1 = MINING_WORLD_PLAYABLE_MAX_COL
  if (side === 'north') {
    for (let r = r0; r < r0 + depth; r += 1) {
      for (let c = c0; c <= c1; c += 1) clear.add(`${r},${c}`)
    }
    return
  }
  if (side === 'south') {
    for (let r = r1 - depth + 1; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) clear.add(`${r},${c}`)
    }
    return
  }
  if (side === 'east') {
    for (let c = c1 - depth + 1; c <= c1; c += 1) {
      for (let r = r0; r <= r1; r += 1) clear.add(`${r},${c}`)
    }
    return
  }
  if (side === 'west') {
    for (let c = c0; c < c0 + depth; c += 1) {
      for (let r = r0; r <= r1; r += 1) clear.add(`${r},${c}`)
    }
  }
}

/**
 * M1 gateway approach strips — keeps decorative walls out of N/S/E/W exit corridors.
 * On M1 every playable perimeter cell is a valid map exit, so corridors span full edges.
 * Mineable blocks stay protected via cellMap `reserved` (never overwritten).
 */
export function buildM1GatewaySightClear() {
  const clear = new Set(M1_NORTH_EXTRA_CLEAR)
  addFullEdgeStrip(clear, 'north')
  addFullEdgeStrip(clear, 'south')
  addFullEdgeStrip(clear, 'east')
  addFullEdgeStrip(clear, 'west')
  return clear
}

export function buildPeripheralGatewaySightClear(mapId) {
  const edge = PERIPHERAL_M1_GATEWAY_EDGE[String(mapId)]
  if (!edge) return new Set()
  const clear = new Set()
  addFullEdgeStrip(clear, edge)
  return clear
}

export function getPeripheralGatewaySightClear(mapId) {
  const id = String(mapId)
  if (!peripheralGatewaySightClearCache.has(id)) {
    peripheralGatewaySightClearCache.set(id, buildPeripheralGatewaySightClear(id))
  }
  return peripheralGatewaySightClearCache.get(id)
}

export function getM1GatewaySightClear() {
  if (!m1GatewaySightClearCache) {
    m1GatewaySightClearCache = buildM1GatewaySightClear()
  }
  return m1GatewaySightClearCache
}

export function isM1GatewayApproachCell(row, col) {
  return getM1GatewaySightClear().has(`${row},${col}`)
}
