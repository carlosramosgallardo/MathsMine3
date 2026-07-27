/** Shared training math — mirrors Board.jsx / Android TrainingRules. */
import { clampRankLevel } from '@/lib/ranks';

export const DAILY_MINE_BASE = 100;
export const TRAINING_PRICE = Number(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE) || 0.00001;

export function getDiff(level) {
  if (level >= 70) return 5;
  if (level >= 40) return 4;
  if (level >= 20) return 3;
  if (level >= 8) return 2;
  return 1;
}

export function getTimeLimitMs(level) {
  return Math.max(1500, 6000 - level * 55);
}

export function clampTrainingLevel(level) {
  return clampRankLevel(level);
}

export function failPenalty(level) {
  if (level >= 70) return 5;
  if (level >= 40) return 3;
  if (level >= 15) return 2;
  return 1;
}

export function successDelta(level) {
  return level >= 80 ? 2 : 1;
}

export function miningReward(elapsedMs, level) {
  const timeLimit = getTimeLimitMs(level);
  const rewardMult = 1 + Math.floor(level / 10) * 0.5;
  const base = timeLimit * 0.5;
  const raw = elapsedMs <= base
    ? TRAINING_PRICE * ((base - elapsedMs) / base)
    : -TRAINING_PRICE * 0.05 * Math.min((elapsedMs - base) / base, 1);
  return raw * rewardMult;
}

export function answersMatch(userAnswer, expected) {
  return String(userAnswer ?? '').trim().toLowerCase() === String(expected ?? '').trim().toLowerCase();
}
