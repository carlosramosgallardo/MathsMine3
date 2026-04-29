import { getWalletTradeMultiplier } from '@/lib/wallet-decorations';
import { getMacroCommissionMultiplier } from '@/lib/mm3-macro';

export const SELL_TIERS = [
  { min: 0, max: 19, label: 'NOVICE', rateCny: 80 },
  { min: 20, max: 39, label: 'MINER', rateCny: 260 },
  { min: 40, max: 59, label: 'HACKER', rateCny: 780 },
  { min: 60, max: 79, label: 'WIZARD', rateCny: 2400 },
  { min: 80, max: 100, label: 'LEGEND', rateCny: 8000 },
];

export const CNY_TO_EUR = 0.128;
export const CNY_TO_USD = 0.139;
export const BUY_RATE_PREMIUM = 1.18;

export function clampLevel(level = 0) {
  return Math.max(0, Math.min(100, Number(level) || 0));
}

export function getSellTier(level = 0) {
  const safeLevel = clampLevel(level);
  return SELL_TIERS.find((tier) => safeLevel >= tier.min && safeLevel <= tier.max) ?? SELL_TIERS[0];
}

export function getSellRateCny(level = 0) {
  const safeLevel = clampLevel(level);
  const tier = getSellTier(safeLevel);
  const intraTierLevel = safeLevel - tier.min;
  return tier.rateCny + intraTierLevel * Math.max(5, Math.round(tier.rateCny * 0.08));
}

export function getRateByCurrency(level = 0, currency = 'EUR') {
  const rateCny = getSellRateCny(level);
  if (currency === 'USD') return rateCny * CNY_TO_USD;
  if (currency === 'CNY') return rateCny;
  return rateCny * CNY_TO_EUR;
}

export function getCommissionRate(amountMm3 = 0) {
  const safeMm3 = Math.max(0, Number(amountMm3) || 0);
  if (safeMm3 < 0.0001) return 0.01;
  if (safeMm3 < 0.001) return 0.018;
  if (safeMm3 < 0.01) return 0.032;
  if (safeMm3 < 0.1) return 0.055;
  if (safeMm3 < 1) return 0.085;
  return 0.12;
}

export function applyMacroCommissionRate(rate = 0, macroState = {}) {
  return Math.max(0, Number(rate) || 0) * getMacroCommissionMultiplier(macroState);
}

export function getBuyCommissionRate(amountMm3 = 0) {
  const safeMm3 = Math.max(0, Number(amountMm3) || 0);
  if (safeMm3 < 0.0001) return 0.03;
  if (safeMm3 < 0.001) return 0.045;
  if (safeMm3 < 0.01) return 0.07;
  if (safeMm3 < 0.1) return 0.1;
  if (safeMm3 < 1) return 0.14;
  return 0.18;
}

export function getSellQuote(level = 0, totalMm3 = 0, walletDecorations = [], macroState = {}, diceModifier = 0) {
  const safeLevel = clampLevel(level);
  const safeTotal = Math.max(0, Number(totalMm3) || 0);
  const rateCny = getSellRateCny(safeLevel);
  const tradeMultiplier = getWalletTradeMultiplier(walletDecorations, safeLevel);
  const commissionRate = applyMacroCommissionRate(getCommissionRate(safeTotal), macroState) * (1 + diceModifier);
  const commissionMm3 = safeTotal * commissionRate;
  const netMm3 = Math.max(0, safeTotal - commissionMm3);
  const grossCny = safeTotal * rateCny;
  const commissionCny = grossCny * commissionRate;
  const netCny = Math.max(0, grossCny - commissionCny);

  const grossEur = grossCny * CNY_TO_EUR;
  const grossUsd = grossCny * CNY_TO_USD;
  const commissionEur = commissionCny * CNY_TO_EUR;
  const commissionUsd = commissionCny * CNY_TO_USD;
  const netEur = netCny * CNY_TO_EUR;
  const netUsd = netCny * CNY_TO_USD;
  const boostedNetCny = netCny * tradeMultiplier;
  const boostedNetEur = netEur * tradeMultiplier;
  const boostedNetUsd = netUsd * tradeMultiplier;

  return {
    level: safeLevel,
    totalMm3: safeTotal,
    rateCny,
    tradeMultiplier,
    commissionMm3,
    netMm3,
    grossCny,
    grossEur,
    grossUsd,
    commissionRate,
    commissionCny,
    commissionEur,
    commissionUsd,
    netCny: boostedNetCny,
    netEur: boostedNetEur,
    netUsd: boostedNetUsd,
    tier: getSellTier(safeLevel),
  };
}

export function getBuyQuote(level = 0, funds = 0, currency = 'EUR', walletDecorations = [], macroState = {}, diceModifier = 0) {
  const safeLevel = clampLevel(level);
  const safeFunds = Math.max(0, Number(funds) || 0);
  const baseRateCny = getSellRateCny(safeLevel);
  const tradeMultiplier = getWalletTradeMultiplier(walletDecorations, safeLevel);
  const rateCny = baseRateCny * BUY_RATE_PREMIUM;
  const rateCurrency =
    currency === 'USD'
      ? rateCny * CNY_TO_USD
      : currency === 'CNY'
        ? rateCny
        : rateCny * CNY_TO_EUR;
  const grossMm3 = rateCurrency > 0 ? safeFunds / rateCurrency : 0;
  const commissionRate = applyMacroCommissionRate(getBuyCommissionRate(grossMm3), macroState) * (1 + diceModifier);
  const commissionMm3 = grossMm3 * commissionRate;
  const netMm3 = Math.max(0, grossMm3 - commissionMm3);
  const boostedNetMm3 = netMm3 * tradeMultiplier;
  const grossCny = grossMm3 * rateCny;
  const commissionCny = commissionMm3 * rateCny;
  const netCny = Math.max(0, grossCny - commissionCny);
  const grossEur = grossCny * CNY_TO_EUR;
  const grossUsd = grossCny * CNY_TO_USD;
  const commissionEur = commissionCny * CNY_TO_EUR;
  const commissionUsd = commissionCny * CNY_TO_USD;
  const netEur = netCny * CNY_TO_EUR;
  const netUsd = netCny * CNY_TO_USD;

  return {
    level: safeLevel,
    funds: safeFunds,
    grossMm3,
    netMm3: boostedNetMm3,
    rateCny,
    rateCurrency,
    tradeMultiplier,
    commissionRate,
    commissionMm3,
    grossCny,
    grossEur,
    grossUsd,
    commissionCny,
    commissionEur,
    commissionUsd,
    netCny,
    netEur,
    netUsd,
    tier: getSellTier(safeLevel),
  };
}

export function formatCompactNum(value, decimals = 2) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `${sign}${(abs / 1_000).toFixed(1)}k`;
  return n.toFixed(decimals);
}

export function formatMoney(value, currency = 'EUR', locales = 'en-US') {
  const safeValue = Number(value) || 0;
  const absValue = Math.abs(safeValue);
  let maximumFractionDigits = 2;

  if (absValue === 0) maximumFractionDigits = 8;
  else if (absValue < 0.0001) maximumFractionDigits = 8;
  else if (absValue < 0.01) maximumFractionDigits = 6;
  else if (absValue < 1) maximumFractionDigits = 4;

  return new Intl.NumberFormat(locales, {
    style: 'currency',
    currency,
    minimumFractionDigits: Math.min(2, maximumFractionDigits),
    maximumFractionDigits,
  }).format(safeValue);
}
