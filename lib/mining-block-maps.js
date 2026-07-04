/** Map tier assignment for the 1000-block chain — no layout imports. */
export const MINING_MAP_BLOCK_COUNT = 200;

export const MINING_MAP_BLOCK_BANDS = Object.freeze({
  '1': [0, 199],
  '2': [200, 399],
  '3': [400, 599],
  '4': [600, 799],
  '5': [800, 999],
});

export function getBlockMapId(blockHex) {
  const index = Number.parseInt(String(blockHex || '').replace('#', ''), 16);
  if (!Number.isFinite(index) || index < 0) return '1';
  return String(Math.min(4, Math.floor(index / MINING_MAP_BLOCK_COUNT)) + 1);
}
