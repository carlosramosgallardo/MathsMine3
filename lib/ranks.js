export const RANK_TIERS = [
  { min: 0, max: 19, label: 'NOVICE', emoji: '🧪', color: '#22d3ee', glow: 'rgba(34,211,238,0.35)', bg: 'rgba(34,211,238,0.08)' },
  { min: 20, max: 39, label: 'MINER', emoji: '⛏️', color: '#4ade80', glow: 'rgba(74,222,128,0.35)', bg: 'rgba(74,222,128,0.08)' },
  { min: 40, max: 59, label: 'HACKER', emoji: '🧠', color: '#facc15', glow: 'rgba(250,204,21,0.35)', bg: 'rgba(250,204,21,0.08)' },
  { min: 60, max: 79, label: 'WIZARD', emoji: '🪄', color: '#f97316', glow: 'rgba(249,115,22,0.35)', bg: 'rgba(249,115,22,0.08)' },
  { min: 80, max: 100, label: 'LEGEND', emoji: '👑', color: '#e879f9', glow: 'rgba(232,121,249,0.35)', bg: 'rgba(232,121,249,0.08)' },
];

export function clampRankLevel(level = 0) {
  return Math.max(0, Math.min(100, Number(level) || 0));
}

export function getRankTier(level = 0) {
  const safeLevel = clampRankLevel(level);
  return RANK_TIERS.find((tier) => safeLevel >= tier.min && safeLevel <= tier.max) ?? RANK_TIERS[0];
}

export function getRankLabel(level = 0) {
  const tier = getRankTier(level);
  return `${tier.emoji} ${tier.label}`;
}
