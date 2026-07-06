import { isM1GatewayApproachCell, MINING_GATEWAY_CORRIDOR_DEPTH } from './mining-gateway-corridors'
import {
  MINING_WORLD_PLAYABLE_MAX_COL,
  MINING_WORLD_PLAYABLE_MAX_ROW,
  MINING_WORLD_PLAYABLE_MIN_COL,
  MINING_WORLD_PLAYABLE_MIN_ROW,
} from './mining-world-layout'

/** Maps whose outer ring cells get a softened visual coast (physics unchanged). */
export const MINING_SOFT_PERIMETER_MAPS = Object.freeze(['1', '2', '3', '4', '5'])

const MIN = MINING_WORLD_PLAYABLE_MIN_ROW
const MAX = MINING_WORLD_PLAYABLE_MAX_ROW

function cellSeed(row, col, mapId) {
  const value = Math.sin((row * 19.17 + col * 37.83 + Number(mapId) * 113.2) * 0.017)
  return value - Math.floor(value)
}

export function usesSoftPerimeter(mapId) {
  return MINING_SOFT_PERIMETER_MAPS.includes(String(mapId))
}

export function isPlayablePerimeterCell(row, col) {
  if (row < MIN || row > MAX || col < MIN || col > MAX) return false
  return row === MIN || row === MAX || col === MIN || col === MAX
}

/** Skip heavy cuts on gateway exit strips so causeways stay clean. */
function getGatewayPerimeterSide(row, col, mapId) {
  const depth = MINING_GATEWAY_CORRIDOR_DEPTH - 1
  if (mapId === '1') {
    if (row === MIN) return 'north'
    if (row === MAX) return 'south'
    if (col === MIN) return 'west'
    if (col === MAX) return 'east'
    if (isM1GatewayApproachCell(row, col)) {
      if (row <= MIN + depth) return 'north'
      if (row >= MAX - depth) return 'south'
      if (col <= MIN + depth) return 'west'
      if (col >= MAX - depth) return 'east'
    }
    return null
  }
  if (mapId === '2') {
    if (row === MAX) return 'south'
    if (row >= MAX - depth) return 'south'
    return null
  }
  if (mapId === '3') {
    if (row === MIN) return 'north'
    if (row <= MIN + depth) return 'north'
    return null
  }
  if (mapId === '4') {
    if (col === MIN) return 'west'
    if (col <= MIN + depth) return 'west'
    return null
  }
  if (mapId === '5') {
    if (col === MAX) return 'east'
    if (col >= MAX - depth) return 'east'
    return null
  }
  return null
}

/**
 * Visual-only modifier for one perimeter cell.
 * corner: diagonal sea chamfer on the outer corner
 * edge: small outer-edge notch (0 = none)
 */
export function getPerimeterCellVisual(row, col, mapId) {
  if (!usesSoftPerimeter(mapId) || !isPlayablePerimeterCell(row, col)) return null

  const gatewaySide = getGatewayPerimeterSide(row, col, mapId)
  if (gatewaySide) {
    return { kind: 'edge', side: gatewaySide, notch: 0.02, gateway: true }
  }

  const isCorner = (row === MIN || row === MAX) && (col === MIN || col === MAX)
  if (isCorner) {
    const cut = 0.34 + cellSeed(row, col, mapId) * 0.14
    let corner = 'nw'
    if (row === MIN && col === MAX) corner = 'ne'
    else if (row === MAX && col === MIN) corner = 'sw'
    else if (row === MAX && col === MAX) corner = 'se'
    return { kind: 'corner', corner, cut }
  }

  const side = row === MIN ? 'north' : row === MAX ? 'south' : col === MIN ? 'west' : 'east'
  const seed = cellSeed(row, col, mapId)
  const notch = seed < 0.22 ? 0 : 0.10 + (seed - 0.22) * 0.28
  return { kind: 'edge', side, notch }
}

/** Iterate every playable perimeter cell once. */
export function forEachPerimeterCell(fn) {
  for (let col = MIN; col <= MAX; col += 1) {
    fn(MIN, col)
    if (MAX !== MIN) fn(MAX, col)
  }
  for (let row = MIN + 1; row < MAX; row += 1) {
    fn(row, MIN)
    fn(row, MAX)
  }
}
