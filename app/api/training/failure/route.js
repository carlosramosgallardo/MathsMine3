export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { walletFromRequest } from '@/lib/wallet-session';
import { getSellQuote } from '@/lib/sell-offer';
import {
  appendWalletDecoration,
  MARKET_EVENT_TYPE_LIFE,
  WALLET_DECORATIONS,
} from '@/lib/wallet-decorations';
import { clampTrainingLevel, failPenalty, getDiff } from '@/lib/training-game';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = walletFromRequest(req);
  if (!wallet) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const problem = body.problem || {};
  const choice = String(body.choice ?? body.user_answer ?? '');
  const timeMs = Math.max(0, Number(body.time_ms) || 0);
  const emoji = body.emoji ? String(body.emoji) : null;
  const marketDelta = Number(body.market_delta ?? body.marketDelta ?? 0);
  const consumeLife = Boolean(body.consume_life ?? body.consumeLife);
  const reviveCost = body.revive_cost || body.reviveCost || null;

  const supabase = serviceClient();
  const [{ data: progressRow }, { data: tokenValueRow }, { data: leaderboardRow }] = await Promise.all([
    supabase
      .from('player_progress')
      .select('eur_earned, usd_earned, cny_earned, mm3_sold, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level, level')
      .eq('wallet', wallet)
      .maybeSingle(),
    marketDelta !== 0
      ? supabase.from('token_value').select('total_eth').limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
  ]);

  const levelBefore = clampTrainingLevel(Number(progressRow?.level) ?? 0);
  const progressLevel = clampTrainingLevel(levelBefore - failPenalty(levelBefore));
  const totalMined = Number(leaderboardRow?.total_eth) || 0;

  const currentDecorations = Array.isArray(progressRow?.wallet_emojis) ? progressRow.wallet_emojis : [];
  const nextDecorations = emoji ? appendWalletDecoration(currentDecorations, emoji) : currentDecorations;
  const nextFunds = {
    eur_earned: Number(progressRow?.eur_earned) || 0,
    usd_earned: Number(progressRow?.usd_earned) || 0,
    cny_earned: Number(progressRow?.cny_earned) || 0,
  };
  const soldMm3 = Number(progressRow?.mm3_sold) || 0;

  if (reviveCost?.field && reviveCost?.amount) {
    const field = String(reviveCost.field);
    if (field in nextFunds) {
      nextFunds[field] = Math.max(0, nextFunds[field] - Number(reviveCost.amount));
    }
  }

  const liveSellQuote = getSellQuote(progressLevel, Math.max(0, totalMined - soldMm3));

  const { error: gameError } = await supabase.from('games').insert({
    wallet,
    problem: String(problem.masked ?? ''),
    user_answer: choice,
    is_correct: false,
    time_ms: timeMs,
    mining_reward: 0,
    problem_id: problem.id || null,
    difficulty: Number(problem.difficulty) || getDiff(progressLevel),
    problem_type: String(problem.problem_type || 'arithmetic'),
  });
  if (gameError) {
    return Response.json({ ok: false, error: gameError.message }, { status: 500 });
  }

  const progressPayload = {
    wallet,
    level: progressLevel,
    wallet_emojis: nextDecorations,
    life_used: consumeLife || Boolean(progressRow?.life_used),
    lucky_50_claimed: emoji === WALLET_DECORATIONS.lucky50 ? true : Boolean(progressRow?.lucky_50_claimed),
    lucky_100_claimed: emoji === WALLET_DECORATIONS.lucky100 ? true : Boolean(progressRow?.lucky_100_claimed),
    lucky_500_claimed: emoji === WALLET_DECORATIONS.lucky500 ? true : Boolean(progressRow?.lucky_500_claimed),
    lucky_1000_claimed: emoji === WALLET_DECORATIONS.lucky1000 ? true : Boolean(progressRow?.lucky_1000_claimed),
    lucky_50_level: Number(progressRow?.lucky_50_level ?? -1),
    lucky_100_level: Number(progressRow?.lucky_100_level ?? -1),
    lucky_500_level: Number(progressRow?.lucky_500_level ?? -1),
    lucky_1000_level: Number(progressRow?.lucky_1000_level ?? -1),
    sell_rate_cny: liveSellQuote.rateCny,
    sell_quote_cny: liveSellQuote.netCny,
    sell_quote_eur: liveSellQuote.netEur,
    sell_quote_usd: liveSellQuote.netUsd,
    updated_at: new Date().toISOString(),
    ...nextFunds,
  };

  const { error: progressError } = await supabase
    .from('player_progress')
    .update(progressPayload)
    .eq('wallet', wallet);
  if (progressError) {
    return Response.json({ ok: false, error: progressError.message }, { status: 500 });
  }

  if (marketDelta !== 0) {
    const totalMm3 = Number(tokenValueRow?.total_eth) || 0;
    const deltaMm3 = -Math.abs(totalMm3 * marketDelta);
    await supabase.from('mm3_mining_events').insert({
      wallet,
      event_type: MARKET_EVENT_TYPE_LIFE,
      delta_mm3: deltaMm3,
      emoji: emoji ?? WALLET_DECORATIONS.revive,
    }).then(null, () => {});
  }

  return Response.json({ ok: true, level: progressLevel, funds: nextFunds });
}
