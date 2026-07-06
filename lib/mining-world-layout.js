export const MINING_WORLD_ROWS = 56
export const MINING_WORLD_COLS = 56

export const MINING_CHAIN_NODE_POSITION = Object.freeze({ row: 27, col: 27 })

// Rooftop StormRoll node — kept clear of the pool terrace rails and swim basin.
export const NODE_DICE_POSITION = Object.freeze({ row: 6, col: 11 })

// Visual-only reservation. Block identity still comes from blockHex and the
// Block identity comes from blockHex. Grid mapping uses 28 columns across 1000 chain indices.
export const CRYPTO_COLOSSEUM_BOUNDS = Object.freeze({
  minRow: 19,
  maxRow: 35,
  minCol: 19,
  maxCol: 35,
})

export const CIPHER_HOUSE_BOUNDS = Object.freeze({
  minRow: 3,
  maxRow: 13,
  minCol: 3,
  maxCol: 13,
})

// Rooftop swim basin — symmetric about house centre (col 8.5), terrace ring
// fills the roof grid evenly east/west.
export const HOUSE_POOL_OUTER = Object.freeze({
  minX: 5.00,
  maxX: 12.00,
  minZ: 9.50,
  maxZ: 12.00,
})
export const HOUSE_POOL_TERRACE_MARGIN = 0.85
export const HOUSE_POOL_TERRACE = Object.freeze({
  minX: HOUSE_POOL_OUTER.minX - HOUSE_POOL_TERRACE_MARGIN,
  maxX: HOUSE_POOL_OUTER.maxX + HOUSE_POOL_TERRACE_MARGIN,
  minZ: HOUSE_POOL_OUTER.minZ - HOUSE_POOL_TERRACE_MARGIN,
  maxZ: HOUSE_POOL_OUTER.maxZ + HOUSE_POOL_TERRACE_MARGIN,
})
export const HOUSE_POOL_CENTER_X = (HOUSE_POOL_OUTER.minX + HOUSE_POOL_OUTER.maxX) / 2
export const HOUSE_POOL_CENTER_Z = (HOUSE_POOL_OUTER.minZ + HOUSE_POOL_OUTER.maxZ) / 2
export const HOUSE_POOL_HEAL_ZONE = Object.freeze({ ...HOUSE_POOL_OUTER })
export const HOUSE_POOL_PVP_SAFE_ZONE = Object.freeze({
  minX: HOUSE_POOL_OUTER.minX - 0.55,
  maxX: HOUSE_POOL_OUTER.maxX + 0.55,
  minY: HOUSE_POOL_OUTER.minZ - 0.55,
  maxY: HOUSE_POOL_OUTER.maxZ + 0.55,
})
export const HOUSE_POOL_DECK_LEVEL = 5.836
export const HOUSE_POOL_FLOOR_LEVEL = HOUSE_POOL_DECK_LEVEL - 0.82
export const HOUSE_POOL_SWIM_MAX_Z  = HOUSE_POOL_DECK_LEVEL - 0.14 + 0.22
export const HOUSE_POOL_PVP_SAFE_Z_MIN = HOUSE_POOL_FLOOR_LEVEL - 0.35
export const HOUSE_POOL_PVP_SAFE_Z_MAX = HOUSE_POOL_DECK_LEVEL + 0.45

/** No PvP damage while inside the rooftop pool basin (on foot or RL mount). */
export function isInHousePoolPvpSafeZone(gx, gy, gz = 0) {
  if (!Number.isFinite(gx) || !Number.isFinite(gy)) return false
  if (!(gx > HOUSE_POOL_PVP_SAFE_ZONE.minX && gx < HOUSE_POOL_PVP_SAFE_ZONE.maxX &&
    gy > HOUSE_POOL_PVP_SAFE_ZONE.minY && gy < HOUSE_POOL_PVP_SAFE_ZONE.maxY)) {
    return false
  }
  const z = Number(gz) || 0
  return z >= HOUSE_POOL_PVP_SAFE_Z_MIN && z <= HOUSE_POOL_PVP_SAFE_Z_MAX
}

// Interior stair cells — reserved so auto block placement never overlaps the climb.
export const CIPHER_HOUSE_INTERIOR_STAIR_KEYS = Object.freeze((() => {
  const keys = new Set()
  for (const row of [4, 5]) {
    for (const col of [5, 6, 7, 8]) keys.add(`${row},${col}`)
  }
  for (const row of [6, 7, 8]) {
    for (const col of [6, 7]) keys.add(`${row},${col}`)
  }
  return [...keys]
})())

const DOOR_WALL_DELTA = {
  north: { dr: -1, dc: 0 },
  south: { dr: 1, dc: 0 },
  east: { dr: 0, dc: 1 },
  west: { dr: 0, dc: -1 },
}

const CIPHER_HOUSE_DOOR_ASCENTS = [
  { wall: 'north', cells: ['3,5', '3,6'], steps: 6 },
  { wall: 'south', cells: ['13,9', '13,10'], steps: 8 },
  { wall: 'east', cells: ['8,13', '9,13'], steps: 8 },
]

export const MINING_WORLD_PLAYABLE_MIN_ROW = 1
export const MINING_WORLD_PLAYABLE_MAX_ROW = MINING_WORLD_ROWS - 2
export const MINING_WORLD_PLAYABLE_MIN_COL = 1
export const MINING_WORLD_PLAYABLE_MAX_COL = MINING_WORLD_COLS - 2

export function isPlayableMiningWorldCell(row, col) {
  return (
    row >= MINING_WORLD_PLAYABLE_MIN_ROW &&
    row <= MINING_WORLD_PLAYABLE_MAX_ROW &&
    col >= MINING_WORLD_PLAYABLE_MIN_COL &&
    col <= MINING_WORLD_PLAYABLE_MAX_COL
  )
}

const CIPHER_HOUSE_NORTH_ESPLANADE_MIN_ROW = 1
const CIPHER_HOUSE_SOUTH_ESPLANADE_MAX_ROW = 20
const CIPHER_HOUSE_EAST_STAIR_MAX_COL = 20

function doorExteriorAscentSteps(door) {
  const requested = door.steps || 4
  if (door.wall === 'north') {
    const minDoorRow = Math.min(...door.cells.map((cell) => Number(cell.split(',')[0])))
    return Math.min(requested, minDoorRow - CIPHER_HOUSE_NORTH_ESPLANADE_MIN_ROW + 1)
  }
  if (door.wall === 'south') {
    const maxDoorRow = Math.max(...door.cells.map((cell) => Number(cell.split(',')[0])))
    return Math.min(requested, CIPHER_HOUSE_SOUTH_ESPLANADE_MAX_ROW - maxDoorRow + 1)
  }
  if (door.wall === 'east') {
    const maxDoorCol = Math.max(...door.cells.map((cell) => Number(cell.split(',')[1])))
    return Math.min(requested, CIPHER_HOUSE_EAST_STAIR_MAX_COL - maxDoorCol + 1)
  }
  return requested
}

function effectiveDoorAscentSteps(door) {
  const { dr, dc } = DOOR_WALL_DELTA[door.wall]
  const requested = doorExteriorAscentSteps(door)
  let count = 0
  for (let step = 0; step < requested; step += 1) {
    let inBounds = false
    for (const cell of door.cells) {
      const [row, col] = cell.split(',').map(Number)
      if (isPlayableMiningWorldCell(row + dr * step, col + dc * step)) {
        inBounds = true
        break
      }
    }
    if (!inBounds) break
    count = step + 1
  }
  return Math.max(1, count)
}

const CIPHER_HOUSE_DOOR_OPENING_KEYS = new Set(
  CIPHER_HOUSE_DOOR_ASCENTS.flatMap(door => door.cells),
)

export const CIPHER_HOUSE_DOOR_STEP_KEYS = Object.freeze((() => {
  const keys = new Set()
  for (const door of CIPHER_HOUSE_DOOR_ASCENTS) {
    const { dr, dc } = DOOR_WALL_DELTA[door.wall]
    const steps = effectiveDoorAscentSteps(door)
    for (let step = 0; step < steps; step += 1) {
      for (const cell of door.cells) {
        const [row, col] = cell.split(',').map(Number)
        const nextRow = row + dr * step
        const nextCol = col + dc * step
        const key = `${nextRow},${nextCol}`
        if (CIPHER_HOUSE_DOOR_OPENING_KEYS.has(key)) continue
        if (isPlayableMiningWorldCell(nextRow, nextCol)) {
          keys.add(key)
        }
      }
    }
    for (const cell of door.cells) keys.add(cell)
  }
  return [...keys]
})())

// Stair treads + exterior door ramps + one-cell halo (blocks that visually touch stairs).
export const CIPHER_HOUSE_MINING_EXCLUSION = Object.freeze((() => {
  const keys = new Set([
    ...CIPHER_HOUSE_INTERIOR_STAIR_KEYS,
    ...CIPHER_HOUSE_DOOR_STEP_KEYS,
  ])
  for (const key of CIPHER_HOUSE_INTERIOR_STAIR_KEYS) {
    const [row, col] = key.split(',').map(Number)
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      keys.add(`${row + dr},${col + dc}`)
    }
  }
  return [...keys]
})())

// No in-house mining slots: every blockHex uses the outer-world visual grid.
export const CIPHER_HOUSE_MINING_LEVELS = Object.freeze({})

const houseDoorCells = new Set([
  '3,5', '3,6',
  '13,9', '13,10',
])

const houseStructureCells = new Set()
for (let col = CIPHER_HOUSE_BOUNDS.minCol; col <= CIPHER_HOUSE_BOUNDS.maxCol; col += 1) {
  for (const row of [CIPHER_HOUSE_BOUNDS.minRow, CIPHER_HOUSE_BOUNDS.maxRow]) {
    const key = `${row},${col}`
    if (!houseDoorCells.has(key)) houseStructureCells.add(key)
  }
}
for (let row = CIPHER_HOUSE_BOUNDS.minRow + 1; row < CIPHER_HOUSE_BOUNDS.maxRow; row += 1) {
  for (const col of [CIPHER_HOUSE_BOUNDS.minCol, CIPHER_HOUSE_BOUNDS.maxCol]) {
    const key = `${row},${col}`
    if (!houseDoorCells.has(key)) houseStructureCells.add(key)
  }
}

for (const key of ['12,10', '11,10', '10,10', '9,10', '9,9', '8,9', '7,9', '7,8', '6,8', '6,7']) {
  houseStructureCells.add(key)
}
for (let row = CIPHER_HOUSE_BOUNDS.minRow + 1; row < CIPHER_HOUSE_BOUNDS.maxRow; row += 1) {
  for (let col = CIPHER_HOUSE_BOUNDS.minCol + 1; col < CIPHER_HOUSE_BOUNDS.maxCol; col += 1) {
    houseStructureCells.add(`${row},${col}`)
  }
}

export const CIPHER_HOUSE_STRUCTURE_CELLS = Object.freeze([...houseStructureCells])
