export const WALLET_DECORATIONS = {
  revive: '❤️',
  lucky50: '🔮',
  lucky100: '🍀',
  lucky500: '🎰',
  lucky1000: '🧿',
  marketGenesis: '🛰',
};

// Names and descriptions for each NFTJI — used as tooltips throughout the portal
export const WALLET_DECORATION_LABELS = {
  [WALLET_DECORATIONS.lucky50]: {
    name: 'Void Seer',
    title: 'Void Seer — 1/50 probability · +0.5% MM3 global value boost',
  },
  [WALLET_DECORATIONS.lucky100]: {
    name: 'Fortune Leaf',
    title: 'Fortune Leaf — 1/100 probability · +1.0% MM3 global value boost',
  },
  [WALLET_DECORATIONS.lucky500]: {
    name: 'Jackpot Engine',
    title: 'Jackpot Engine — 1/500 probability · +5.0% MM3 global value surge',
  },
  [WALLET_DECORATIONS.lucky1000]: {
    name: 'Fate Singularity',
    title: 'Fate Singularity — 1/1000 probability · +10% MM3 global value detonation',
  },
  [WALLET_DECORATIONS.revive]: {
    name: 'Life Toll',
    title: 'Life Toll — Triggered on death survival · -25% MM3 global value deflation',
  },
  [WALLET_DECORATIONS.marketGenesis]: {
    name: 'Genesis Uplink',
    title: 'Genesis Uplink — Market nftji claimed · uplink synced to this wallet',
  },
};

export function getEmojiTitle(emoji) {
  return WALLET_DECORATION_LABELS[emoji]?.title || emoji;
}

export const TRADE_SLOT_ORDER = [
  { key: 'lucky50', emoji: WALLET_DECORATIONS.lucky50, probability: '1/50', multiplier: 1.005 },
  { key: 'lucky100', emoji: WALLET_DECORATIONS.lucky100, probability: '1/100', multiplier: 1.01 },
  { key: 'lucky500', emoji: WALLET_DECORATIONS.lucky500, probability: '1/500', multiplier: 1.05 },
  { key: 'lucky1000', emoji: WALLET_DECORATIONS.lucky1000, probability: '1/1000', multiplier: 1.5 },
  { key: 'revive', emoji: WALLET_DECORATIONS.revive, probability: 'life', multiplier: 0.2 },
];

export const MARKET_EVENT_TYPE_LIFE = 'life_continue';
export const MARKET_EVENT_TYPE_NFTJI = 'nftmoji_claim';

export function getWalletMarketDelta(emoji) {
  if (emoji === WALLET_DECORATIONS.lucky50) return 0.005;
  if (emoji === WALLET_DECORATIONS.lucky100) return 0.01;
  if (emoji === WALLET_DECORATIONS.lucky500) return 0.05;
  if (emoji === WALLET_DECORATIONS.lucky1000) return 0.1;
  if (emoji === WALLET_DECORATIONS.revive) return -0.25;
  return 0;
}

export function normalizeWalletDecorations(value) {
  const items = Array.isArray(value) ? value : [];
  return [...new Set(items.filter((item) => typeof item === 'string' && item.trim()))];
}

export function appendWalletDecoration(existing, emoji) {
  return normalizeWalletDecorations([...(existing || []), emoji]);
}

export function walletDecorationSuffix(value) {
  const items = normalizeWalletDecorations(value);
  return items.length ? ` ${items.join('')}` : '';
}

export function getWalletTradeMultiplier(value, level = 0) {
  const owned = new Set(normalizeWalletDecorations(value));
  const safeLevel = Math.max(0, Math.min(100, Number(level) || 0));
  const baseMultiplier = TRADE_SLOT_ORDER.reduce(
    (acc, slot) => (owned.has(slot.emoji) ? acc * slot.multiplier : acc),
    1
  );
  const levelMultiplier = 1 + safeLevel * 0.001;
  return baseMultiplier * levelMultiplier;
}
