import { MINING_MAP_GATEWAY_COL_BANDS } from './mining-maps'
import {
  MINING_WORLD_PLAYABLE_MAX_COL,
  MINING_WORLD_PLAYABLE_MAX_ROW,
  MINING_WORLD_PLAYABLE_MIN_COL,
  MINING_WORLD_PLAYABLE_MIN_ROW,
} from './mining-world-layout'

/** Maps whose outer ring cells get a softened visual coast (physics unchanged). */
export const MINING_SOFT_PERIMETER_MAPS = Object.freeze(['1', '2'])

const MIN = MINING_WORLD_PLAYABLE_MIN_ROW
const MAX = MINING_WORLD_PLAYABLE_MAX_ROW

function inGatewayColBand(col) {
  return MINING_MAP_GATEWAY_COL_BANDS.some(([lo, hi]) => col >= lo && col <= hi)
}

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
function isGatewayPerimeterCell(row, col, mapId) {
  if (mapId === '2' && row === MAX && inGatewayColBand(col)) return true
  if (mapId === '1' && row === MIN && inGatewayColBand(col)) return true
  return false
}

/**
 * Visual-only modifier for one perimeter cell.
 * corner: diagonal sea chamfer on the outer corner
 * edge: small outer-edge notch (0 = none)
 */
export function getPerimeterCellVisual(row, col, mapId) {
  if (!usesSoftPerimeter(mapId) || !isPlayablePerimeterCell(row, col)) return null
  if (isGatewayPerimeterCell(row, col, mapId)) {
    return { kind: 'edge', side: row === MIN ? 'north' : 'south', notch: 0.06 }
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
