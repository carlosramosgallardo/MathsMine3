export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { walletFromRequest } from '@/lib/wallet-session';
import { getBuyQuote, getSellQuote } from '@/lib/sell-offer';
import { normalizeWalletDecorations } from '@/lib/wallet-decorations';
import { normalizeMacroState } from '@/lib/mm3-macro';
import { getDiceState } from '@/lib/dice';

const MIN_TRADE_MM3 = 0.00001;
const DAILY_TX_LIMIT = 5;

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function utcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return { start, end };
}

// 2026-07-26 security audit, phase 3: this route used to trust a
// client-computed `progress` object (and the client separately wrote
// mm3_mining_state / mm3_sell_transactions / mm3_mining_events directly to
// Supabase with the anon key). A signed-in wallet could hand-craft any of
// those calls to set its own balance to anything. The server now re-derives
// the entire trade from its own DB reads using the exact same getBuyQuote /
// getSellQuote math the client uses for its live preview — the client only
// supplies *what it wants to do* (mode/currency/amount), never *what it's
// worth*.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = walletFromRequest(req);
  if (!wallet) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const mode = body.mode === 'sell' ? 'sell' : body.mode === 'buy' ? 'buy' : null;
  const currency = ['EUR', 'USD', 'CNY'].includes(body.currency) ? body.currency : 'EUR';
  const requestedRaw = Number(body.amount);
  if (!mode || !Number.isFinite(requestedRaw) || requestedRaw <= 0) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = serviceClient();
  const { start, end } = utcDayBounds();

  const [{ count: dailyCount }, { data: progress }, { data: stats }, { data: market }, { data: macroRow }] = await Promise.all([
    supabase.from('mm3_sell_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString()),
    supabase.from('player_progress')
      .select('level, mm3_sold, cny_earned, eur_earned, usd_earned, wallet_emojis, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level')
      .eq('wallet', wallet)
      .maybeSingle(),
    supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
    supabase.from('mm3_mining_state').select('id, commission_mm3, commission_cny, commission_eur, commission_usd').eq('id', 1).maybeSingle(),
    supabase.from('mm3_macro_state').select('war_percent, nature_percent').eq('id', 1).maybeSingle(),
  ]);

  if ((Number(dailyCount) || 0) >= DAILY_TX_LIMIT) {
    return Response.json({ ok: false, error: 'daily_limit_reached' }, { status: 429 });
  }

  const level = Math.max(0, Math.min(100, Number(progress?.level) || 0));
  const totalMm3 = Number(stats?.total_eth) || 0;
  const soldMm3 = Number(progress?.mm3_sold) || 0;
  const availableMm3 = totalMm3 - soldMm3;
  const funds = {
    cny: Number(progress?.cny_earned) || 0,
    eur: Number(progress?.eur_earned) || 0,
    usd: Number(progress?.usd_earned) || 0,
  };
  const decorations = normalizeWalletDecorations(progress?.wallet_emojis);
  const macroState = normalizeMacroState(macroRow);
  const nftjiLevels = {
    lucky50: Number(progress?.lucky_50_level ?? -1),
    lucky100: Number(progress?.lucky_100_level ?? -1),
    lucky500: Number(progress?.lucky_500_level ?? -1),
    lucky1000: Number(progress?.lucky_1000_level ?? -1),
  };
  const dice = getDiceState();
  const diceModifier = dice.active ? dice.modifier : 0;

  const requestedAmount = mode === 'buy'
    ? Math.min(funds[currency.toLowerCase()] || 0, requestedRaw)
    : Math.min(availableMm3, requestedRaw);

  const quote = mode === 'buy'
    ? getBuyQuote(level, requestedAmount, currency, decorations, macroState, diceModifier, nftjiLevels)
    : getSellQuote(level, requestedAmount, decorations, macroState, diceModifier, nftjiLevels);

  if (mode === 'sell' && quote.totalMm3 < MIN_TRADE_MM3) {
    return Response.json({ ok: false, error: 'amount_too_small' }, { status: 400 });
  }
  if (mode === 'buy' && quote.netMm3 < MIN_TRADE_MM3) {
    return Response.json({ ok: false, error: 'amount_too_small' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const nextProgress = mode === 'buy'
    ? {
        wallet,
        level,
        mm3_sold: soldMm3 - quote.netMm3,
        cny_earned: Math.max(0, funds.cny - quote.grossCny),
        eur_earned: Math.max(0, funds.eur - quote.grossEur),
        usd_earned: Math.max(0, funds.usd - quote.grossUsd),
        sell_rate_cny: getSellQuote(level, 0).rateCny,
        sell_quote_cny: 0,
        sell_quote_eur: 0,
        sell_quote_usd: 0,
        updated_at: now,
      }
    : {
        wallet,
        level,
        mm3_sold: soldMm3 + quote.totalMm3,
        cny_earned: funds.cny + quote.netCny,
        eur_earned: funds.eur + quote.netEur,
        usd_earned: funds.usd + quote.netUsd,
        sell_rate_cny: getSellQuote(level, 0).rateCny,
        sell_quote_cny: 0,
        sell_quote_eur: 0,
        sell_quote_usd: 0,
        updated_at: now,
      };

  const { error: progressError } = await supabase
    .from('player_progress')
    .upsert(nextProgress, { onConflict: 'wallet', ignoreDuplicates: false });
  if (progressError) {
    console.error('trade/exec progress upsert:', progressError.message);
    return Response.json({ ok: false, error: progressError.message }, { status: 500 });
  }

  const { error: marketError } = await supabase
    .from('mm3_mining_state')
    .upsert({
      id: 1,
      commission_mm3: (Number(market?.commission_mm3) || 0) + quote.commissionMm3,
      commission_cny: (Number(market?.commission_cny) || 0) + quote.commissionCny,
      commission_eur: (Number(market?.commission_eur) || 0) + quote.commissionEur,
      commission_usd: (Number(market?.commission_usd) || 0) + quote.commissionUsd,
      updated_at: now,
    }, { onConflict: 'id', ignoreDuplicates: false });
  if (marketError) console.error('trade/exec commission upsert:', marketError.message);

  const { error: txError } = await supabase.from('mm3_sell_transactions').insert({
    wallet,
    source: body.source === 'google' ? 'google' : 'wallet',
    level,
    mm3_amount: mode === 'buy' ? -quote.grossMm3 : quote.totalMm3,
    mm3_commission: quote.commissionMm3,
    rate_cny: quote.rateCny,
    gross_cny: mode === 'buy' ? -quote.grossCny : quote.grossCny,
    gross_eur: mode === 'buy' ? -quote.grossEur : quote.grossEur,
    gross_usd: mode === 'buy' ? -quote.grossUsd : quote.grossUsd,
    commission_rate: quote.commissionRate,
    commission_cny: quote.commissionCny,
    commission_eur: quote.commissionEur,
    commission_usd: quote.commissionUsd,
    net_cny: mode === 'buy' ? -quote.netCny : quote.netCny,
    net_eur: mode === 'buy' ? -quote.netEur : quote.netEur,
    net_usd: mode === 'buy' ? -quote.netUsd : quote.netUsd,
  });
  if (txError) console.error('trade/exec transaction log:', txError.message);

  const tradeDelta = mode === 'buy' ? Number(quote.grossMm3 || 0) : -Number(quote.totalMm3 || 0);
  if (tradeDelta !== 0) {
    await supabase.from('mm3_mining_events').insert({
      wallet,
      event_type: mode === 'buy' ? 'mining_buy' : 'mining_resell',
      delta_mm3: tradeDelta,
      emoji: mode === 'buy' ? '📈' : '📉',
    }).then(null, () => {});
  }

  return Response.json({ ok: true, mode, quote });
}
