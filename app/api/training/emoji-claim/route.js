export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { walletFromRequest } from '@/lib/wallet-session';
import { getSellQuote } from '@/lib/sell-offer';
import {
  appendWalletDecoration,
  getWalletMarketDelta,
  MARKET_EVENT_TYPE_NFTJI,
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

  const emoji = String(body.emoji || '');
  if (!emoji) {
    return Response.json({ ok: false, error: 'invalid_emoji' }, { status: 400 });
  }

  const progressLevel = clampTrainingLevel(Number(body.progress_level ?? body.progressLevel ?? 0));

  const supabase = serviceClient();
  const [{ data: progressRow }, { data: tokenValueRow }, { data: leaderboardRow }] = await Promise.all([
    supabase
      .from('player_progress')
      .select('level, eur_earned, usd_earned, cny_earned, mm3_sold, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level')
      .eq('wallet', wallet)
      .maybeSingle(),
    supabase.from('token_value').select('total_eth').limit(1).maybeSingle(),
    supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
  ]);

  const nextTotalMined = Number(leaderboardRow?.total_eth) || Number(tokenValueRow?.total_eth) || 0;

  const currentDecorations = Array.isArray(progressRow?.wallet_emojis) ? progressRow.wallet_emojis : [];
  const alreadyOwned = currentDecorations.includes(emoji);
  const nextDecorations = appendWalletDecoration(currentDecorations, emoji);
  const soldMm3 = Number(progressRow?.mm3_sold) || 0;
  const effectiveLevel = clampTrainingLevel(Math.max(Number(progressRow?.level) || 0, progressLevel));
  const liveSellQuote = getSellQuote(effectiveLevel, Math.max(0, nextTotalMined - soldMm3));

  const progressPayload = {
    level: effectiveLevel,
    mm3_sold: soldMm3,
    cny_earned: Number(progressRow?.cny_earned) || 0,
    eur_earned: Number(progressRow?.eur_earned) || 0,
    usd_earned: Number(progressRow?.usd_earned) || 0,
    wallet_emojis: nextDecorations,
    life_used: Boolean(progressRow?.life_used),
    lucky_50_claimed: emoji === '🔮' ? true : Boolean(progressRow?.lucky_50_claimed),
    lucky_100_claimed: emoji === '🍀' ? true : Boolean(progressRow?.lucky_100_claimed),
    lucky_500_claimed: emoji === '🎰' ? true : Boolean(progressRow?.lucky_500_claimed),
    lucky_1000_claimed: emoji === '🧿' ? true : Boolean(progressRow?.lucky_1000_claimed),
    lucky_50_level: emoji === '🔮'
      ? Number(progressRow?.lucky_50_level ?? -1) + 1 : Number(progressRow?.lucky_50_level ?? -1),
    lucky_100_level: emoji === '🍀'
      ? Number(progressRow?.lucky_100_level ?? -1) + 1 : Number(progressRow?.lucky_100_level ?? -1),
    lucky_500_level: emoji === '🎰'
      ? Number(progressRow?.lucky_500_level ?? -1) + 1 : Number(progressRow?.lucky_500_level ?? -1),
    lucky_1000_level: emoji === '🧿'
      ? Number(progressRow?.lucky_1000_level ?? -1) + 1 : Number(progressRow?.lucky_1000_level ?? -1),
    sell_rate_cny: liveSellQuote.rateCny,
    sell_quote_cny: liveSellQuote.netCny,
    sell_quote_eur: liveSellQuote.netEur,
    sell_quote_usd: liveSellQuote.netUsd,
    updated_at: new Date().toISOString(),
  };

  const { error: progressError } = await supabase
    .from('player_progress')
    .update(progressPayload)
    .eq('wallet', wallet);
  if (progressError) {
    return Response.json({ ok: false, error: progressError.message }, { status: 500 });
  }

  const marketDelta = getWalletMarketDelta(emoji);
  if (!alreadyOwned && marketDelta !== 0) {
    const totalMm3 = Number(tokenValueRow?.total_eth) || 0;
    const deltaMm3 = Math.abs(totalMm3 * marketDelta);
    await supabase.from('mm3_mining_events').insert({
      wallet,
      event_type: MARKET_EVENT_TYPE_NFTJI,
      delta_mm3: deltaMm3,
      emoji,
    }).then(null, () => {});
  }

  return Response.json({ ok: true, progress: progressPayload });
}
