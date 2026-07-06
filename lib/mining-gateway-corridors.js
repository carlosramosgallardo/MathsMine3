import {
  MINING_MAP_GATEWAY_COL_BANDS,
  MINING_MAP_GATEWAY_ROW_BANDS,
} from './mining-maps'
import {
  MINING_WORLD_PLAYABLE_MAX_COL,
  MINING_WORLD_PLAYABLE_MAX_ROW,
  MINING_WORLD_PLAYABLE_MIN_COL,
  MINING_WORLD_PLAYABLE_MIN_ROW,
} from './mining-world-layout'

/** Hand-tuned NE cells that blocked sight toward the north gateways (M2). */
const M1_NORTH_EXTRA_CLEAR = Object.freeze([
  '5,52', '1,50', '1,51', '2,45', '1,45', '4,43', '5,44', '3,40', '2,39', '2,38',
  '1,37', '4,36', '5,33', '5,32', '4,31', '3,30', '1,31', '1,32',
])

let m1GatewaySightClearCache = null

/**
 * M1 gateway approach strips — keeps decorative walls out of N/S/E/W exit corridors.
 * On M1 every playable perimeter cell is a valid map exit, so corridors span full edges.
 * Mineable blocks stay protected via cellMap `reserved` (never overwritten).
 */
export function buildM1GatewaySightClear() {
  const clear = new Set(M1_NORTH_EXTRA_CLEAR)
  const r0 = MINING_WORLD_PLAYABLE_MIN_ROW
  const r1 = MINING_WORLD_PLAYABLE_MAX_ROW
  const c0 = MINING_WORLD_PLAYABLE_MIN_COL
  const c1 = MINING_WORLD_PLAYABLE_MAX_COL
  const depth = 12

  for (let r = r0; r < r0 + depth; r += 1) {
    for (let c = c0; c <= c1; c += 1) clear.add(`${r},${c}`)
  }
  for (let r = r1 - depth + 1; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) clear.add(`${r},${c}`)
  }
  for (let c = c1 - depth + 1; c <= c1; c += 1) {
    for (let r = r0; r <= r1; r += 1) clear.add(`${r},${c}`)
  }
  for (let c = c0; c < c0 + depth; c += 1) {
    for (let r = r0; r <= r1; r += 1) clear.add(`${r},${c}`)
  }

  // Peripheral maps still use band-aligned spines when returning to M1.
  for (const [minC, maxC] of MINING_MAP_GATEWAY_COL_BANDS) {
    for (let c = minC - 1; c <= maxC + 1; c += 1) {
      clear.add(`${r0},${c}`)
      clear.add(`${r1},${c}`)
    }
  }
  for (const [minR, maxR] of MINING_MAP_GATEWAY_ROW_BANDS) {
    for (let r = minR - 1; r <= maxR + 1; r += 1) {
      clear.add(`${r},${c0}`)
      clear.add(`${r},${c1}`)
    }
  }

  return clear
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
