export const BLOCK_CHAIN_TITLE = 'MM3 BLOCK CHAIN IN PROGRESS';
export const MM3_BLOCK_GRID_ROWS = 28;
export const MM3_BLOCK_GRID_COLS = 28;
// Legacy 28×28 board used by the 2D Mining panel and NFTJI grid coordinates.
export const MM3_BLOCK_GRID_TOTAL = MM3_BLOCK_GRID_ROWS * MM3_BLOCK_GRID_COLS;
// Full chain: 980 regular blocks + 20 NFTJI blocks = 1000 mineable cells.
export const MM3_BLOCK_CHAIN_TOTAL = 1000;
export const MM3_REGULAR_BLOCK_TOTAL = 980;
export const MM3_NFTJI_BLOCK_TOTAL = 20;
export const MM3_NON_MINE_CELLS = 0;
export const MM3_MINE_BLOCK_TOTAL = MM3_BLOCK_CHAIN_TOTAL;
export const MM3_BLOCK_VALUE_DECIMALS = 2;
export const MM3_BLOCK_VALUE_SCALE = 10 ** MM3_BLOCK_VALUE_DECIMALS;

export const MM3_BLOCK_CHAIN_REQUIREMENTS = Array.from({ length: MM3_BLOCK_CHAIN_TOTAL }, (_, index) => {
  const progress = MM3_BLOCK_CHAIN_TOTAL <= 1 ? 0 : index / (MM3_BLOCK_CHAIN_TOTAL - 1);
  const level = Math.round(progress * 100);
  const mm3Magnitude = Number((progress * 100).toFixed(MM3_BLOCK_VALUE_DECIMALS));
  const requiredMm3 = index === 0 ? 0 : (index % 2 === 1 ? mm3Magnitude : -mm3Magnitude);
  return {
    blockHex: `#${index.toString(16).toUpperCase().padStart(3, '0')}`,
    minLevel: level,
    requiredMm3,
  };
});

export const MM3_BLOCK_REQUIREMENT_BY_HEX = new Map(
  MM3_BLOCK_CHAIN_REQUIREMENTS.map((entry) => [entry.blockHex, entry])
);

export function normalizeBlockHex(value) {
  const raw = String(value || '').trim().toUpperCase();
  const match = raw.match(/^#?([0-9A-F]{1,3})$/);
  if (!match) return '';
  return `#${match[1].padStart(3, '0')}`;
}

export function blockHexToGrid(blockHex, cols = MM3_BLOCK_GRID_COLS) {
  const normalized = normalizeBlockHex(blockHex);
  if (!normalized) return null;
  const index = parseInt(normalized.slice(1), 16);
  if (!Number.isFinite(index) || index < 0 || index >= MM3_BLOCK_CHAIN_TOTAL) return null;
  return {
    index,
    row: Math.floor(index / cols),
    col: index % cols,
  };
}

export function formatBlockRequirement(requirement) {
  if (!requirement) return '';
  return `min wallet lvl. ${requirement.minLevel}; mm3_global_value ${Number(requirement.requiredMm3).toFixed(MM3_BLOCK_VALUE_DECIMALS)}`;
}

export function doesGlobalValueMeetRequirement(currentValue, requiredValue) {
  const current = Number(Number(currentValue || 0).toFixed(MM3_BLOCK_VALUE_DECIMALS));
  const required = Number(requiredValue) || 0;
  if (required < 0) return current <= required;
  return current >= required;
}

export function mm3ValueToHex(value) {
  const scaled = Math.round(Math.abs(Number(value) || 0) * MM3_BLOCK_VALUE_SCALE);
  const hex = scaled.toString(16).toUpperCase();
  return Number(value) < 0 ? `-${hex}` : hex;
}

export function buildBlockChainCode(entries = []) {
  return entries
    .slice()
    .sort((a, b) => (Number(a.chain_index) || 0) - (Number(b.chain_index) || 0))
    .map((entry) => `#${String(entry.wallet || '').toLowerCase()}${entry.block_hex}#${entry.mm3_value_hex}`)
    .join('');
}

export function gridToBlockHex(gridRow, gridCol, cols = MM3_BLOCK_GRID_COLS) {
  const index = Number(gridRow) * cols + Number(gridCol);
  return `#${index.toString(16).toUpperCase().padStart(3, '0')}`;
}

export function isLegacyBoardHex(blockHex) {
  const grid = blockHexToGrid(blockHex);
  if (!grid) return false;
  return grid.index < MM3_BLOCK_GRID_TOTAL;
}
