export const BLOCK_CHAIN_TITLE = 'MM3 BLOCK CHAIN IN PROGRESS';

const LEVEL_STEPS = [0, 4, 4, 8, 8, 13, 13, 17, 17, 21, 21, 25, 25, 29, 29, 33, 33, 38, 38, 42, 42, 46, 46, 50, 50, 54, 54, 58, 58, 63, 63, 67, 67, 71, 71, 75, 75, 79, 79, 83, 83, 88, 88, 92, 92, 96, 96, 100, 100];

export const MM3_BLOCK_CHAIN_REQUIREMENTS = LEVEL_STEPS.map((level, index) => {
  const requiredMm3 = index === 0 ? 0 : (index % 2 === 1 ? level : -level);
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

export function blockHexToGrid(blockHex, cols = 28) {
  const normalized = normalizeBlockHex(blockHex);
  if (!normalized) return null;
  const index = parseInt(normalized.slice(1), 16);
  return {
    index,
    row: Math.floor(index / cols),
    col: index % cols,
  };
}

export function formatBlockRequirement(requirement) {
  if (!requirement) return '';
  return `min wallet lvl. ${requirement.minLevel}; mm3_global_value ${Number(requirement.requiredMm3).toFixed(5)}`;
}

export function doesGlobalValueMeetRequirement(currentValue, requiredValue) {
  const current = Number(currentValue) || 0;
  const required = Number(requiredValue) || 0;
  if (required < 0) return current <= required;
  return current >= required;
}

export function mm3ValueToHex(value) {
  const scaled = Math.round(Math.abs(Number(value) || 0) * 100000);
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
