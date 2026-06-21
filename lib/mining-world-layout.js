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
