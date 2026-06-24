export const MINING_WORLD_ROWS = 56
export const MINING_WORLD_COLS = 56

export const MINING_CHAIN_NODE_POSITION = Object.freeze({ row: 27, col: 27 })

// Visual-only reservation. Block identity still comes from blockHex and the
// immutable 28x28 chain coordinates used by the API and database.
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
