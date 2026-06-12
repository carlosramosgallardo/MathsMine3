export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { CNY_TO_EUR, CNY_TO_USD, getSellRateCny, getSellQuote } from '@/lib/sell-offer';
import { normalizeWalletDecorations } from '@/lib/wallet-decorations';
import { getMarketCommandForKey, marketCommandFromBlock } from '@/lib/mining-commands';
import {
  blockHexToGrid, gridToBlockHex, normalizeBlockHex,
  MM3_BLOCK_GRID_ROWS, MM3_BLOCK_GRID_COLS,
} from '@/lib/mm3-block-chain';
import { getDiceState } from '@/lib/dice';

function normalizeWallet(v) {
  return String(v || '').trim().toLowerCase();
}
function toCnyFromEur(v) { return Number(v || 0) / CNY_TO_EUR; }
function toUsdFromEur(v) { return Number(v || 0) * (CNY_TO_USD / CNY_TO_EUR); }

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet   = normalizeWallet(body.wallet);
  const blockHex = normalizeBlockHex(body.blockHex);
  if (!wallet || !blockHex) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const grid = blockHexToGrid(blockHex);
  if (!grid) {
    return Response.json({ ok: false, error: 'block_not_found' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const [{ data: reservedBlock }, { data: progress }, { data: tokenValue }, { data: walletMinedRows }, { data: allMarketBlocks }] = await Promise.all([
      supabase
        .from('mm3_mining_blocks')
        .select('block_key, emoji, price_eur, market_command')
        .eq('grid_row', grid.row)
        .eq('grid_col', grid.col)
        .maybeSingle(),
      supabase
        .from('player_progress')
        .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, mining_nftji_key, mining_nftji_price, mining_nftji_levels')
        .eq('wallet', wallet)
        .maybeSingle(),
      supabase.from('token_value').select('total_eth').maybeSingle(),
      supabase.from('mm3_mined_blocks').select('block_hex').eq('wallet', wallet),
      supabase.from('mm3_mining_blocks').select('block_key, grid_row, grid_col').not('grid_row', 'is', null),
    ]);

    if (!reservedBlock) {
      return Response.json({ ok: false, error: 'block_not_nftji' }, { status: 404 });
    }
    if (!progress?.mining_nftji_key || progress.mining_nftji_key !== reservedBlock.block_key) {
      return Response.json({ ok: false, error: 'not_owned' }, { status: 403 });
    }

    const level    = Math.max(0, Math.min(100, Number(progress.level) || 0));
    const soldMm3  = Number(progress.mm3_sold) || 0;
    const totalMm3 = Number(tokenValue?.total_eth) || 0;
    const decorations = normalizeWalletDecorations(progress.wallet_emojis);

    const oldPrice = Number(progress.mining_nftji_price) || 0;
    const diceState = getDiceState();
    const diceModifier = diceState.active ? diceState.modifier : 0;
    const returnEur = oldPrice * 0.5 * (1 + diceModifier);
    const returnUsd = toUsdFromEur(returnEur);
    const returnCny = toCnyFromEur(returnEur);

    const commandEntry = marketCommandFromBlock(reservedBlock) || getMarketCommandForKey(reservedBlock.block_key);
    const paysWithMm3  = commandEntry?.payment === 'mm3';

    const fundsEur = Number(progress.eur_earned) || 0;
    const fundsUsd = Number(progress.usd_earned) || 0;
    const fundsCny = Number(progress.cny_earned) || 0;

    const rateCny     = getSellRateCny(level);
    const resellDelta = paysWithMm3 ? returnEur : returnEur / (rateCny * CNY_TO_EUR);
    const liveQuote   = getSellQuote(level, Math.max(0, totalMm3 - soldMm3), decorations);
    const now = new Date().toISOString();

    // block_chain_percent: free-mined blocks / total grid
    const nftjiHxs = new Set(
      (allMarketBlocks || [])
        .filter(b => b.grid_row != null && b.grid_col != null)
        .map(b => gridToBlockHex(b.grid_row, b.grid_col))
    );
    const freeMined = (walletMinedRows || []).filter(r => !nftjiHxs.has(r.block_hex)).length;
    const blockChainPercent = Math.round(freeMined / (MM3_BLOCK_GRID_ROWS * MM3_BLOCK_GRID_COLS) * 10000) / 100;

    const { error: progressError } = await supabase
      .from('player_progress')
      .upsert({
        wallet,
        level,
        mm3_sold:   paysWithMm3 ? Math.max(0, soldMm3 - returnEur) : soldMm3,
        eur_earned: paysWithMm3 ? fundsEur : fundsEur + returnEur,
        usd_earned: paysWithMm3 ? fundsUsd : fundsUsd + returnUsd,
        cny_earned: paysWithMm3 ? fundsCny : fundsCny + returnCny,
        wallet_emojis:       decorations,
        life_used:           Boolean(progress.life_used),
        lucky_50_claimed:    Boolean(progress.lucky_50_claimed),
        lucky_100_claimed:   Boolean(progress.lucky_100_claimed),
        lucky_500_claimed:   Boolean(progress.lucky_500_claimed),
        lucky_1000_claimed:  Boolean(progress.lucky_1000_claimed),
        sell_rate_cny:       liveQuote.rateCny,
        sell_quote_cny:      liveQuote.netCny,
        sell_quote_eur:      liveQuote.netEur,
        sell_quote_usd:      liveQuote.netUsd,
        mining_nftji_key:    null,
        mining_nftji_price:  0,
        mining_nftji_since:  null,
        mining_nftji_levels: progress.mining_nftji_levels || {},
        block_chain_percent: blockChainPercent,
        updated_at:          now,
      }, { onConflict: 'wallet', ignoreDuplicates: false });
    if (progressError) throw progressError;

    // Cancel active IRC command and pending penalties
    const resoldKey = progress.mining_nftji_key;
    await supabase
      .from('mm3_mining_commands')
      .update({ reset_at: new Date(Date.now() - 1000).toISOString() })
      .eq('wallet', wallet)
      .eq('nftji_key', resoldKey)
      .gt('reset_at', now);
    await supabase
      .from('mm3_command_penalties')
      .update({ redeemed_at: now })
      .eq('nftji_key', resoldKey)
      .is('redeemed_at', null);

    // Mining event
    await supabase.from('mm3_mining_events').insert({
      wallet,
      event_type: 'mining_resell',
      delta_mm3:  resellDelta,
      emoji:      String(reservedBlock.emoji || resoldKey),
    });

    // Remove from mm3_mined_blocks if nobody owns it anymore
    const { count: remainingOwners } = await supabase
      .from('player_progress')
      .select('wallet', { count: 'exact', head: true })
      .eq('mining_nftji_key', resoldKey);
    if ((remainingOwners || 0) === 0) {
      const nftjiBlockHex = gridToBlockHex(grid.row, grid.col);
      await supabase.from('mm3_mined_blocks').delete().eq('block_hex', nftjiBlockHex);
    }

    const diceTag    = diceState.active ? ` 🎲${diceState.modifier >= 0 ? '+' : ''}${Math.round(diceState.modifier * 100)}%` : '';
    const returnFmt  = paysWithMm3
      ? `${returnEur.toFixed(8).replace(/\.?0+$/, '') || '0'} MM3`
      : `${returnEur.toFixed(2)} EUR`;
    const trace = `resell ${reservedBlock.emoji || '⬡'} ${blockHex} :: +${returnFmt}${diceTag} :: ${wallet.slice(0, 6)}…${wallet.slice(-4)}`;

    return Response.json({ ok: true, trace, ts: Date.now() });
  } catch (err) {
    console.error('resell nftji:', err);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
