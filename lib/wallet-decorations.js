export const WALLET_DECORATIONS = {
  revive: '❤️',
  lucky50: '🔮',
  lucky100: '🍀',
  lucky500: '🎰',
  lucky1000: '🧿',
  marketGenesis: '🛰',
  relay: '🔁',
};

/** Training / Life Toll heart — blue so it never reads as mining HP. */
export const LIFE_NFTJI_ACCENT = '#38bdf8';
/** Squeeze attack crit skill accent in mining HUD. */
export const CRIT_NFTJI_ACCENT = '#ef4444';
/** Pool HP recharge VFX — matches mining health bar green. */
export const MINING_HEAL_GREEN = '#4ade80';
/** Canvas/CSS filter to render the Life Toll ❤️ emoji in training blue. */
export const LIFE_NFTJI_EMOJI_FILTER = 'hue-rotate(195deg) saturate(1.45) brightness(1.06)';

export function isLifeNftjiEmoji(emoji) {
  return emoji === WALLET_DECORATIONS.revive;
}

export function lifeNftjiEmojiFilterStyle(emoji) {
  if (!isLifeNftjiEmoji(emoji)) return undefined;
  return { filter: LIFE_NFTJI_EMOJI_FILTER, display: 'inline-block' };
}

/** Short 2-line mining HUD labels — fit narrow skill slots without clipping. */
export function miningSkillAbilityLines(emoji, blockKey, source) {
  if (isLifeNftjiEmoji(emoji)) return ['+10%', 'SPD'];
  if (emoji === '⚔️' || blockKey === 'sq-atk') return ['+5%', 'CRT'];
  if (emoji === '🔰' || blockKey === 'sq-def') return ['10%', 'DGE'];
  if (emoji === '👾' || blockKey === 'zero-day') return ['10%', 'HCK'];
  if (source === 'mining') return ['+10%', 'AIR'];
  return null;
}

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
    title: 'Life Toll — Survival token · zero commission on all trades · -25% MM3 global value deflation',
  },
  [WALLET_DECORATIONS.marketGenesis]: {
    name: 'Genesis Uplink',
    title: 'Genesis Uplink — Market nftji claimed · uplink synced to this wallet',
  },
  [WALLET_DECORATIONS.relay]: {
    name: 'Relay Link',
    title: 'Relay Link — Relaying nftji · level = ⌊log₂(exec_A + exec_B + 1)⌋ · modifies MM3 global on each /exec',
  },
};

/**
 * Trading NFTJI — Zero-Day 👾. Drops with 5% probability on every trading
 * EXEC (players and ai_team bots alike); re-drops level it up like the
 * training luckies. In mining it grants the HACKING skill: 10% per staff hit
 * to knock the target (players, bots, bosses) OFFLINE for 5 seconds, during
 * which it still takes damage. Sits between the training NFTJIs and the
 * mining NFTJI in the wallet's global roster.
 */
export const TRADING_NFTJI = Object.freeze({
  key: 'zeroDay',
  emoji: '👾',
  levelField: 'zero_day_level',
  dropChance: 0.05,
});

export const TRADING_NFTJI_LABELS = {
  [TRADING_NFTJI.emoji]: {
    name: 'Zero-Day',
    title: 'Zero-Day — Trading NFTJI · 5% drop per EXEC · Mining skill HACKING: 10% per hit knocks the target OFFLINE for 5s',
  },
};

/** Mining HACKING skill numbers (Zero-Day 👾). */
export const HACKING_CHANCE = 0.10;
export const HACKING_OFFLINE_MS = 5000;

export function hasZeroDayNftji(value) {
  return normalizeWalletDecorations(value).includes(TRADING_NFTJI.emoji);
}

export const SQUEEZE_NFTJIS = {
  shield: '🔰',
  sword: '⚔️',
};

export const SQUEEZE_NFTJI_KEYS = {
  'sq-def': '🔰',
  'sq-atk': '⚔️',
};

export const SQUEEZE_NFTJI_LABELS = {
  [SQUEEZE_NFTJIS.shield]: {
    name: 'Void Ward',
    title: 'Void Ward — Defense · IRC penalties received −50% · Squeeze defeat losses −50%',
  },
  [SQUEEZE_NFTJIS.sword]: {
    name: 'Chaos Blade',
    title: 'Chaos Blade — Attack · IRC penalties dealt +50% · Squeeze victory gains +50%',
  },
};

export const SQUEEZE_SLOT_ORDER = [
  { key: 'sq-def', emoji: SQUEEZE_NFTJIS.shield },
  { key: 'sq-atk', emoji: SQUEEZE_NFTJIS.sword },
];

export function getSqueezeEmojiForKey(key) {
  return SQUEEZE_NFTJI_KEYS[key] || null;
}

export function getEmojiTitle(emoji) {
  return WALLET_DECORATION_LABELS[emoji]?.title || SQUEEZE_NFTJI_LABELS[emoji]?.title || TRADING_NFTJI_LABELS[emoji]?.title || emoji;
}

export function computeRelayLevel(execA, execB) {
  const sum = Math.max(0, Number(execA) || 0) + Math.max(0, Number(execB) || 0);
  return Math.floor(Math.log2(sum + 1));
}

export const TRADE_SLOT_ORDER = [
  { key: 'lucky50', emoji: WALLET_DECORATIONS.lucky50, probability: '1/50', multiplier: 1.005 },
  { key: 'lucky100', emoji: WALLET_DECORATIONS.lucky100, probability: '1/100', multiplier: 1.01 },
  { key: 'lucky500', emoji: WALLET_DECORATIONS.lucky500, probability: '1/500', multiplier: 1.05 },
  { key: 'lucky1000', emoji: WALLET_DECORATIONS.lucky1000, probability: '1/1000', multiplier: 1.5 },
  { key: 'revive', emoji: WALLET_DECORATIONS.revive, probability: 'life', multiplier: 0.2 },
];

export const MARKET_EVENT_TYPE_LIFE = 'life_continue';
export const MARKET_EVENT_TYPE_NFTJI = 'nftji_claim';

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

export function hasReviveNftji(value) {
  return normalizeWalletDecorations(value).includes(WALLET_DECORATIONS.revive);
}

// nftjiLevels: { lucky50: 2, lucky100: 0, lucky500: -1, lucky1000: -1 }
// Each level adds 5% on top of the base multiplier for that slot.
// Life Toll (revive) never levels up — keeps flat 0.2 penalty.
export function getWalletTradeMultiplier(value, level = 0, nftjiLevels = {}) {
  const owned = new Set(normalizeWalletDecorations(value));
  const safeLevel = Math.max(0, Math.min(100, Number(level) || 0));
  let mult = 1;
  for (const slot of TRADE_SLOT_ORDER) {
    if (!owned.has(slot.emoji)) continue;
    if (slot.key === 'revive') {
      mult *= slot.multiplier;
    } else {
      const lvl = Math.max(0, Number(nftjiLevels[slot.key] ?? 0));
      mult *= slot.multiplier * (1 + lvl * 0.05);
    }
  }
  return mult * (1 + safeLevel * 0.001);
}
