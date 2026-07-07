import {
  blockHexToGrid,
  MM3_BLOCK_CHAIN_TOTAL,
  MM3_BLOCK_GRID_TOTAL,
} from './mm3-block-chain';
import { getMiningMapAmbientObstacles, isMiningMapPerimeterFree } from './mining-map-ambient';
import { addBossMiningExclusions, isInBossMiningExclusion } from './map-boss-mining-exclusion';
import { RL_NODE_POSITION } from './mining-rl-mount';
import { getBlockMapId, MINING_MAP_BLOCK_BANDS, MINING_MAP_BLOCK_COUNT } from './mining-block-maps';
import {
  CIPHER_HOUSE_BOUNDS,
  CIPHER_HOUSE_MINING_EXCLUSION,
  CIPHER_HOUSE_MINING_LEVELS,
  CIPHER_HOUSE_STRUCTURE_CELLS,
  CRYPTO_COLOSSEUM_BOUNDS,
  MINING_CHAIN_NODE_POSITION,
  MINING_WORLD_PLAYABLE_MAX_COL,
  MINING_WORLD_PLAYABLE_MAX_ROW,
  MINING_WORLD_PLAYABLE_MIN_COL,
  MINING_WORLD_PLAYABLE_MIN_ROW,
} from './mining-world-layout';

export const MINING_PORTAL_NODES = [
  { row: 5, col: 5, emoji: '🎮', color: '#4ade80' },
  { row: 5, col: 50, emoji: '💹', color: '#fb923c' },
  { row: 18, col: 14, emoji: '📈', color: '#a78bfa' },
  { row: 18, col: 42, emoji: '🏆', color: '#ffd700' },
  { row: 32, col: 50, emoji: '💥', color: '#fb7185' },
  { row: 50, col: 50, emoji: '🔗', color: '#60a5fa' },
  { row: 50, col: 5, emoji: '🤖', color: '#bef264' },
  { row: 32, col: 5, emoji: '📜', color: '#f472b6' },
  { row: 50, col: 28, emoji: '✅', color: '#2dd4bf' },
];

/** Legacy M1-only NFTJI slots — kept for home minimap fallback ordering. */
export const MINING_MARKET_LANDMARK_POSITIONS = [
  [4, 16], [4, 27], [4, 41],
  [12, 16], [12, 26], [12, 52],
  [23, 8], [23, 19], [23, 36], [23, 48],
  [36, 15], [36, 28], [36, 40],
  [44, 4], [44, 18], [44, 38], [44, 52],
  [52, 16], [52, 28], [52, 40],
].map(([row, col]) => ({ row, col }));

export { getBlockMapId, MINING_MAP_BLOCK_BANDS, MINING_MAP_BLOCK_COUNT } from './mining-block-maps';

const PERIPHERAL_MAP_IDS = ['2', '3', '4', '5'];

const VISUAL_BLOCK_REGIONS = [
  { row: 2, col: 2, rows: 26, cols: 26 },
  { row: 2, col: 29, rows: 26, cols: 26 },
  { row: 29, col: 2, rows: 26, cols: 26 },
  { row: 29, col: 29, rows: 26, cols: 26 },
];

const VISUAL_BLOCK_EXTENDED_REGIONS = [
  { row: 1, col: 2, rows: 1, cols: 52 },
  { row: 54, col: 2, rows: 1, cols: 52 },
  { row: 2, col: 1, rows: 52, cols: 1 },
  { row: 2, col: 54, rows: 52, cols: 1 },
  { row: 28, col: 2, rows: 1, cols: 26 },
  { row: 28, col: 29, rows: 1, cols: 26 },
  { row: 2, col: 28, rows: 26, cols: 1 },
  { row: 29, col: 28, rows: 26, cols: 1 },
  { row: 14, col: 14, rows: 4, cols: 4 },
  { row: 14, col: 38, rows: 4, cols: 4 },
  { row: 38, col: 14, rows: 4, cols: 4 },
  { row: 38, col: 38, rows: 4, cols: 4 },
];

const MINING_EXCLUSION_KEYS = new Set(CIPHER_HOUSE_MINING_EXCLUSION);

function blockHexFromIndex(index) {
  return `#${index.toString(16).toUpperCase().padStart(3, '0')}`;
}

function buildM1OccupiedCells() {
  const occupied = new Set(MINING_PORTAL_NODES.map(({ row, col }) => `${row},${col}`));
  CIPHER_HOUSE_STRUCTURE_CELLS.forEach(key => occupied.add(key));
  Object.keys(CIPHER_HOUSE_MINING_LEVELS).forEach(key => occupied.add(key));
  MINING_EXCLUSION_KEYS.forEach(key => occupied.add(key));
  for (let row = CIPHER_HOUSE_BOUNDS.minRow - 2; row <= CIPHER_HOUSE_BOUNDS.maxRow + 2; row += 1) {
    for (let col = CIPHER_HOUSE_BOUNDS.minCol - 2; col <= CIPHER_HOUSE_BOUNDS.maxCol + 2; col += 1) {
      occupied.add(`${row},${col}`);
    }
  }
  for (let row = CRYPTO_COLOSSEUM_BOUNDS.minRow; row <= CRYPTO_COLOSSEUM_BOUNDS.maxRow; row += 1) {
    for (let col = CRYPTO_COLOSSEUM_BOUNDS.minCol; col <= CRYPTO_COLOSSEUM_BOUNDS.maxCol; col += 1) {
      occupied.add(`${row},${col}`);
    }
  }
  occupied.add(`${MINING_CHAIN_NODE_POSITION.row},${MINING_CHAIN_NODE_POSITION.col}`);
  return occupied;
}

function buildPeriphOccupied(mapId) {
  const occupied = new Set(getMiningMapAmbientObstacles(mapId).keys());
  if (mapId === '2') {
    occupied.add(`${RL_NODE_POSITION.row},${RL_NODE_POSITION.col}`);
  }
  addBossMiningExclusions(mapId, occupied);
  return occupied;
}

function regionSlotCount(region) {
  return (region.rows ?? region.size) * (region.cols ?? region.size);
}

function regionSlotToCoord(region, slot, colSpan) {
  const row = region.row + Math.floor(slot / colSpan);
  const col = region.col + (slot % colSpan);
  return { row, col };
}

function probeM1VisualSlot(index, occupied) {
  const houseSlots = Object.keys(CIPHER_HOUSE_MINING_LEVELS);
  const blockHex = blockHexFromIndex(index);
  if (index < houseSlots.length) {
    const [row, col] = houseSlots[index].split(',').map(Number);
    const key = `${row},${col}`;
    if (!occupied.has(key) && !MINING_EXCLUSION_KEYS.has(key)) {
      return { blockHex, row, col, mapId: '1' };
    }
  }

  const extended = index >= MM3_BLOCK_GRID_TOTAL;
  const regionList = extended ? VISUAL_BLOCK_EXTENDED_REGIONS : VISUAL_BLOCK_REGIONS;
  const regionOffset = extended ? index - MM3_BLOCK_GRID_TOTAL : index;
  const region = regionList[regionOffset % regionList.length];
  const colSpan = region.cols ?? region.size;
  const slots = regionSlotCount(region);
  const band = Math.floor(regionOffset / regionList.length);

  for (let probe = 0; probe < slots; probe += 1) {
    const slot = (band * 137 + (regionOffset % 4) * 17 + probe * 53) % slots;
    const { row, col } = regionSlotToCoord(region, slot, colSpan);
    const key = `${row},${col}`;
    if (occupied.has(key) || MINING_EXCLUSION_KEYS.has(key)) continue;
    return { blockHex, row, col, mapId: '1' };
  }
  return null;
}

function buildPeriphPlacementCandidates(mapId, occupied) {
  const candidates = [];
  for (let row = MINING_WORLD_PLAYABLE_MIN_ROW; row <= MINING_WORLD_PLAYABLE_MAX_ROW; row += 1) {
    for (let col = MINING_WORLD_PLAYABLE_MIN_COL; col <= MINING_WORLD_PLAYABLE_MAX_COL; col += 1) {
      const key = `${row},${col}`;
      if (!isMiningMapPerimeterFree(mapId, row, col)) continue;
      if (occupied.has(key)) continue;
      candidates.push({ row, col, key });
    }
  }
  return candidates;
}

function pickPeriphVisualSlot(mapLocalIndex, globalIndex, candidates, occupied) {
  const len = candidates.length;
  if (!len) return null;
  for (let probe = 0; probe < len; probe += 1) {
    const idx = (mapLocalIndex * 137 + globalIndex * 53 + probe * 17) % len;
    const { row, col, key } = candidates[idx];
    if (occupied.has(key)) continue;
    return { row, col, key };
  }
  return null;
}

function buildAllVisualBlockPositions() {
  const positions = new Map();
  const m1Occupied = buildM1OccupiedCells();

  for (let index = 0; index < MM3_BLOCK_CHAIN_TOTAL; index += 1) {
    if (getBlockMapId(blockHexFromIndex(index)) !== '1') continue;
    const slot = probeM1VisualSlot(index, m1Occupied);
    if (!slot) continue;
    m1Occupied.add(`${slot.row},${slot.col}`);
    positions.set(slot.blockHex, { row: slot.row, col: slot.col, mapId: '1' });
  }

  for (const mapId of PERIPHERAL_MAP_IDS) {
    const occupied = buildPeriphOccupied(mapId);
    const candidates = buildPeriphPlacementCandidates(mapId, occupied);
    const band = MINING_MAP_BLOCK_BANDS[mapId];
    let mapLocalIndex = 0;
    for (let index = band[0]; index <= band[1]; index += 1) {
      const blockHex = blockHexFromIndex(index);
      const picked = pickPeriphVisualSlot(mapLocalIndex, index, candidates, occupied);
      mapLocalIndex += 1;
      if (!picked) continue;
      occupied.add(picked.key);
      positions.set(blockHex, { row: picked.row, col: picked.col, mapId });
    }
  }

  return positions;
}

export const MINING_VISUAL_BLOCK_POSITIONS = buildAllVisualBlockPositions();

export const MINING_VISUAL_BLOCK_POSITIONS_BY_MAP = (() => {
  const byMap = { '1': new Map(), '2': new Map(), '3': new Map(), '4': new Map(), '5': new Map() };
  for (const [blockHex, pos] of MINING_VISUAL_BLOCK_POSITIONS) {
    const mapId = pos.mapId || getBlockMapId(blockHex);
    byMap[mapId]?.set(blockHex, pos);
  }
  return Object.freeze(byMap);
})();

export function getBlocksForMap(mapId) {
  return MINING_VISUAL_BLOCK_POSITIONS_BY_MAP[String(mapId)] || new Map();
}

export { isInBossMiningExclusion } from './map-boss-mining-exclusion';

export function relocateMiningBlockPosition(blockHex, extraBlocked = new Set()) {
  const normalizedIndex = Number.parseInt(String(blockHex || '').replace('#', ''), 16);
  if (!Number.isFinite(normalizedIndex)) return null;
  const mapId = getBlockMapId(blockHex);
  const occupied = mapId === '1' ? buildM1OccupiedCells() : buildPeriphOccupied(mapId);
  for (const key of extraBlocked) occupied.add(key);
  for (const [hex, pos] of MINING_VISUAL_BLOCK_POSITIONS) {
    if ((pos.mapId || getBlockMapId(hex)) === mapId) {
      occupied.add(`${pos.row},${pos.col}`);
    }
  }

  if (mapId === '1') {
    const slot = probeM1VisualSlot(normalizedIndex, occupied);
    return slot ? { row: slot.row, col: slot.col, mapId: '1' } : null;
  }

  const candidates = buildPeriphPlacementCandidates(mapId, occupied);
  const band = MINING_MAP_BLOCK_BANDS[mapId];
  const mapLocalIndex = normalizedIndex - band[0];
  const picked = pickPeriphVisualSlot(mapLocalIndex, normalizedIndex, candidates, occupied);
  return picked ? { row: picked.row, col: picked.col, mapId } : null;
}

export function placeMiningVisualBlock(blockHex) {
  const index = Number.parseInt(String(blockHex || '').replace('#', ''), 16);
  const normalized = Number.isFinite(index)
    ? `#${index.toString(16).toUpperCase().padStart(3, '0')}`
    : '';
  const placed = MINING_VISUAL_BLOCK_POSITIONS.get(normalized);
  if (placed) return placed;
  const fallback = blockHexToGrid(blockHex);
  if (!fallback) return null;
  return { row: fallback.row, col: fallback.col, mapId: getBlockMapId(normalized) };
}
