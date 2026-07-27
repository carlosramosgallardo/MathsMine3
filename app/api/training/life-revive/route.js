export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { walletFromRequest } from '@/lib/wallet-session';
import { getSellQuote } from '@/lib/sell-offer';
import {
  appendWalletDecoration,
  MARKET_EVENT_TYPE_LIFE,
  WALLET_DECORATIONS,
} from '@/lib/wallet-decorations';
import { clampTrainingLevel } from '@/lib/training-game';

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

  const originalLevel = clampTrainingLevel(Number(body.original_level ?? body.originalLevel ?? 0));
  const reviveCost = body.revive_cost || body.reviveCost;
  if (!reviveCost?.field || !reviveCost?.amount) {
    return Response.json({ ok: false, error: 'invalid_revive_cost' }, { status: 400 });
  }

  const supabase = serviceClient();
  const [{ data: progressRow }, { data: tokenValueRow }, { data: leaderboardRow }] = await Promise.all([
    supabase
      .from('player_progress')
      .select('eur_earned, usd_earned, cny_earned, mm3_sold, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level')
      .eq('wallet', wallet)
      .maybeSingle(),
    supabase.from('token_value').select('total_eth').limit(1).maybeSingle(),
    supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
  ]);

  const currentDecorations = Array.isArray(progressRow?.wallet_emojis) ? progressRow.wallet_emojis : [];
  if (Boolean(progressRow?.life_used) || currentDecorations.includes(WALLET_DECORATIONS.revive)) {
    return Response.json({ ok: false, error: 'REVIVE_ALREADY_USED' }, { status: 409 });
  }

  const nextFunds = {
    eur_earned: Number(progressRow?.eur_earned) || 0,
    usd_earned: Number(progressRow?.usd_earned) || 0,
    cny_earned: Number(progressRow?.cny_earned) || 0,
  };
  const field = String(reviveCost.field);
  const amount = Number(reviveCost.amount);
  if (!field || !Number.isFinite(amount) || nextFunds[field] < amount) {
    return Response.json({ ok: false, error: 'REVIVE_INSUFFICIENT_FUNDS' }, { status: 400 });
  }
  nextFunds[field] = Math.max(0, nextFunds[field] - amount);

  const soldMm3 = Number(progressRow?.mm3_sold) || 0;
  const totalMined = Number(leaderboardRow?.total_eth) || 0;
  const liveSellQuote = getSellQuote(originalLevel, Math.max(0, totalMined - soldMm3));
  const nextDecorations = appendWalletDecoration(currentDecorations, WALLET_DECORATIONS.revive);

  const { error: progressError } = await supabase.from('player_progress').update({
    level: originalLevel,
    wallet_emojis: nextDecorations,
    life_used: true,
    lucky_50_claimed: Boolean(progressRow?.lucky_50_claimed),
    lucky_100_claimed: Boolean(progressRow?.lucky_100_claimed),
    lucky_500_claimed: Boolean(progressRow?.lucky_500_claimed),
    lucky_1000_claimed: Boolean(progressRow?.lucky_1000_claimed),
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
  }).eq('wallet', wallet);
  if (progressError) {
    return Response.json({ ok: false, error: progressError.message }, { status: 500 });
  }

  const totalMm3 = Number(tokenValueRow?.total_eth) || 0;
  const deltaMm3 = -Math.abs(totalMm3 * 0.25);
  await supabase.from('mm3_mining_events').insert({
    wallet,
    event_type: MARKET_EVENT_TYPE_LIFE,
    delta_mm3: deltaMm3,
    emoji: WALLET_DECORATIONS.revive,
  }).then(null, () => {});

  return Response.json({ ok: true, level: originalLevel, funds: nextFunds });
}
