import {
  MINING_WORLD_COLS,
  MINING_WORLD_PLAYABLE_MAX_COL,
  MINING_WORLD_PLAYABLE_MAX_ROW,
  MINING_WORLD_PLAYABLE_MIN_COL,
  MINING_WORLD_PLAYABLE_MIN_ROW,
  MINING_WORLD_ROWS,
} from './mining-world-layout'

/** Playable interior of every mining map (same as map 1). */
export const MINING_MAP_PLAYABLE = Object.freeze({
  minRow: MINING_WORLD_PLAYABLE_MIN_ROW,
  maxRow: MINING_WORLD_PLAYABLE_MAX_ROW,
  minCol: MINING_WORLD_PLAYABLE_MIN_COL,
  maxCol: MINING_WORLD_PLAYABLE_MAX_COL,
  rows: MINING_WORLD_ROWS,
  cols: MINING_WORLD_COLS,
})

export const MINING_CORE_MAP_ID = '1'

/** Adjacent map per edge from the current map (only connected sides exist). */
export const MINING_MAP_ADJACENCY = Object.freeze({
  '1': { north: '2', south: '3', east: '4', west: '5' },
  '2': { south: '1' },
  '3': { north: '1' },
  '4': { west: '1' },
  '5': { east: '1' },
})

/** Centre col/row for each gateway band on N/S and E/W edges. */
export const MINING_MAP_GATEWAY_COL_BANDS = Object.freeze([
  [28, 30],
  [33, 36],
  [39, 43],
  [46, 49],
  [52, 54],
])

export const MINING_MAP_GATEWAY_ROW_BANDS = Object.freeze([
  [38, 40],
  [46, 48],
  [52, 54],
])

/**
 * Five-map cross layout centred on map 1.
 *   2 (north)
 * 5 — 1 — 4
 *   3 (south)
 */
export const MINING_MAP_DEFINITIONS = Object.freeze({
  '1': {
    id: '1',
    chunkX: 0,
    chunkY: 0,
    labelEn: 'Speculation Plaza',
    labelEs: 'Plaza de la Especulación',
    primaryBiome: 'coast',
  },
  '2': {
    id: '2',
    chunkX: 0,
    chunkY: -1,
    labelEn: 'RL Coliseum',
    labelEs: 'Coliseo RL',
    primaryBiome: 'ice',
  },
  '3': {
    id: '3',
    chunkX: 0,
    chunkY: 1,
    labelEn: 'Former Soviet Union',
    labelEs: 'Antigua Unión Soviética',
    primaryBiome: 'coast',
  },
  '4': {
    id: '4',
    chunkX: 1,
    chunkY: 0,
    labelEn: 'Korean Midzone',
    labelEs: 'Korean Midzone',
    primaryBiome: 'inferno',
  },
  '5': {
    id: '5',
    chunkX: -1,
    chunkY: 0,
    labelEn: 'Epstein Island',
    labelEs: 'Isla Epstein',
    primaryBiome: 'ice',
  },
})

function normalizeMapId(value) {
  const id = String(value || MINING_CORE_MAP_ID)
  return MINING_MAP_DEFINITIONS[id] ? id : MINING_CORE_MAP_ID
}

export function getMiningMapDefinition(mapId) {
  return MINING_MAP_DEFINITIONS[normalizeMapId(mapId)]
}

export function getMiningMapLabel(mapId, es = false) {
  const def = getMiningMapDefinition(mapId)
  return es ? def.labelEs : def.labelEn
}

export function isMiningCoreMap(mapId) {
  return normalizeMapId(mapId) === MINING_CORE_MAP_ID
}

function clampGatewayEntryCoord(value, min, max) {
  return Math.max(min + 1, Math.min(max - 1, Math.floor(value)))
}

/**
 * Detect whether the player is crossing a gateway into an adjacent map.
 * Returns { targetMapId, row, col } for the entry cell on the destination map.
 */
export function detectMiningMapTransition(mapId, gx, gy) {
  const id = normalizeMapId(mapId)
  const row = Math.floor(gy)
  const col = Math.floor(gx)

  if (id === '1') {
    if (gy < MINING_WORLD_PLAYABLE_MIN_ROW + 0.55) {
      return {
        targetMapId: '2',
        row: MINING_WORLD_PLAYABLE_MAX_ROW - 1,
        col: clampGatewayEntryCoord(col, MINING_WORLD_PLAYABLE_MIN_COL, MINING_WORLD_PLAYABLE_MAX_COL),
      }
    }
    if (gy > MINING_WORLD_PLAYABLE_MAX_ROW + 0.45) {
      return {
        targetMapId: '3',
        row: MINING_WORLD_PLAYABLE_MIN_ROW + 1,
        col: clampGatewayEntryCoord(col, MINING_WORLD_PLAYABLE_MIN_COL, MINING_WORLD_PLAYABLE_MAX_COL),
      }
    }
    if (gx > MINING_WORLD_PLAYABLE_MAX_COL + 0.45) {
      return {
        targetMapId: '4',
        row: clampGatewayEntryCoord(row, MINING_WORLD_PLAYABLE_MIN_ROW, MINING_WORLD_PLAYABLE_MAX_ROW),
        col: MINING_WORLD_PLAYABLE_MIN_COL + 1,
      }
    }
    if (gx < MINING_WORLD_PLAYABLE_MIN_COL + 0.55) {
      return {
        targetMapId: '5',
        row: clampGatewayEntryCoord(row, MINING_WORLD_PLAYABLE_MIN_ROW, MINING_WORLD_PLAYABLE_MAX_ROW),
        col: MINING_WORLD_PLAYABLE_MAX_COL - 1,
      }
    }
    return null
  }

  if (id === '2' && gy > MINING_WORLD_PLAYABLE_MAX_ROW + 0.45) {
    return {
      targetMapId: '1',
      row: MINING_WORLD_PLAYABLE_MIN_ROW + 1,
      col: clampGatewayEntryCoord(col, MINING_WORLD_PLAYABLE_MIN_COL, MINING_WORLD_PLAYABLE_MAX_COL),
    }
  }
  if (id === '3' && gy < MINING_WORLD_PLAYABLE_MIN_ROW + 0.55) {
    return {
      targetMapId: '1',
      row: MINING_WORLD_PLAYABLE_MAX_ROW - 1,
      col: clampGatewayEntryCoord(col, MINING_WORLD_PLAYABLE_MIN_COL, MINING_WORLD_PLAYABLE_MAX_COL),
    }
  }
  if (id === '4' && gx < MINING_WORLD_PLAYABLE_MIN_COL + 0.55) {
    return {
      targetMapId: '1',
      row: clampGatewayEntryCoord(row, MINING_WORLD_PLAYABLE_MIN_ROW, MINING_WORLD_PLAYABLE_MAX_ROW),
      col: MINING_WORLD_PLAYABLE_MAX_COL - 1,
    }
  }
  if (id === '5' && gx > MINING_WORLD_PLAYABLE_MAX_COL + 0.45) {
    return {
      targetMapId: '1',
      row: clampGatewayEntryCoord(row, MINING_WORLD_PLAYABLE_MIN_ROW, MINING_WORLD_PLAYABLE_MAX_ROW),
      col: MINING_WORLD_PLAYABLE_MIN_COL + 1,
    }
  }

  return null
}

export function isPlayableMiningMapCell(row, col) {
  return (
    row >= MINING_WORLD_PLAYABLE_MIN_ROW &&
    row <= MINING_WORLD_PLAYABLE_MAX_ROW &&
    col >= MINING_WORLD_PLAYABLE_MIN_COL &&
    col <= MINING_WORLD_PLAYABLE_MAX_COL
  )
}

function bandCenters(bands) {
  return bands.map(([min, max]) => (min + max) / 2)
}

/**
 * Per-edge minimap state: which sides connect to another map and where the gateways sit.
 */
export function getMiningMapEdgeState(mapId) {
  const id = normalizeMapId(mapId)
  const adj = MINING_MAP_ADJACENCY[id] || {}
  const colBands = bandCenters(MINING_MAP_GATEWAY_COL_BANDS)
  const rowBands = bandCenters(MINING_MAP_GATEWAY_ROW_BANDS)
  return {
    north: adj.north
      ? { open: true, targetMapId: adj.north, bands: colBands, fullEdge: true }
      : { open: false },
    south: adj.south
      ? { open: true, targetMapId: adj.south, bands: colBands, fullEdge: true }
      : { open: false },
    east: adj.east
      ? { open: true, targetMapId: adj.east, bands: rowBands, fullEdge: true }
      : { open: false },
    west: adj.west
      ? { open: true, targetMapId: adj.west, bands: rowBands, fullEdge: true }
      : { open: false },
  }
}
