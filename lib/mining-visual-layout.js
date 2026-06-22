import { blockHexToGrid, MM3_BLOCK_GRID_COLS, MM3_BLOCK_GRID_ROWS } from './mm3-block-chain';
import { CRYPTO_COLOSSEUM_BOUNDS, MINING_CHAIN_NODE_POSITION } from './mining-world-layout';

export const MINING_PORTAL_NODES = [
  { row: 5, col: 5, color: '#4ade80' },
  { row: 5, col: 50, color: '#fb923c' },
  { row: 18, col: 14, color: '#a78bfa' },
  { row: 18, col: 42, color: '#ffd700' },
  { row: 32, col: 50, color: '#fb7185' },
  { row: 50, col: 50, color: '#60a5fa' },
  { row: 50, col: 5, color: '#bef264' },
  { row: 32, col: 5, color: '#f472b6' },
  { row: 50, col: 28, color: '#2dd4bf' },
];

export const MINING_MARKET_LANDMARK_POSITIONS = [
  [4, 14], [4, 27], [4, 41],
  [12, 4], [12, 26], [12, 52],
  [23, 8], [23, 19], [23, 36], [23, 48],
  [36, 15], [36, 40],
  [44, 4], [44, 18], [44, 38], [44, 52],
  [52, 16], [52, 40],
].map(([row, col]) => ({ row, col }));

const VISUAL_BLOCK_REGIONS = [
  { row: 2, col: 2, size: 26 },
  { row: 2, col: 29, size: 26 },
  { row: 29, col: 2, size: 26 },
  { row: 29, col: 29, size: 26 },
];

export const MINING_VISUAL_BLOCK_POSITIONS = (() => {
  const occupied = new Set(MINING_PORTAL_NODES.map(({ row, col }) => `${row},${col}`));
  MINING_MARKET_LANDMARK_POSITIONS.forEach(({ row, col }) => occupied.add(`${row},${col}`));
  for (let row = CRYPTO_COLOSSEUM_BOUNDS.minRow; row <= CRYPTO_COLOSSEUM_BOUNDS.maxRow; row += 1) {
    for (let col = CRYPTO_COLOSSEUM_BOUNDS.minCol; col <= CRYPTO_COLOSSEUM_BOUNDS.maxCol; col += 1) {
      occupied.add(`${row},${col}`);
    }
  }
  occupied.add(`${MINING_CHAIN_NODE_POSITION.row},${MINING_CHAIN_NODE_POSITION.col}`);

  const positions = new Map();
  for (let index = 0; index < MM3_BLOCK_GRID_ROWS * MM3_BLOCK_GRID_COLS; index += 1) {
    const blockHex = `#${index.toString(16).toUpperCase().padStart(3, '0')}`;
    const region = VISUAL_BLOCK_REGIONS[index % VISUAL_BLOCK_REGIONS.length];
    const slots = region.size * region.size;
    for (let probe = 0; probe < slots; probe += 1) {
      const slot = (Math.floor(index / 4) * 137 + (index % 4) * 17 + probe * 53) % slots;
      const row = region.row + Math.floor(slot / region.size);
      const col = region.col + (slot % region.size);
      const key = `${row},${col}`;
      if (occupied.has(key)) continue;
      occupied.add(key);
      positions.set(blockHex, { row, col });
      break;
    }
  }
  return positions;
})();

export function placeMiningVisualBlock(blockHex) {
  const index = Number.parseInt(String(blockHex || '').replace('#', ''), 16);
  const normalized = Number.isFinite(index)
    ? `#${index.toString(16).toUpperCase().padStart(3, '0')}`
    : '';
  return MINING_VISUAL_BLOCK_POSITIONS.get(normalized) || blockHexToGrid(blockHex);
}
