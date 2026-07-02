export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { CNY_TO_EUR, CNY_TO_USD, getSellQuote, getSellRateCny } from '@/lib/sell-offer';
import { normalizeWalletDecorations } from '@/lib/wallet-decorations';
import { getMarketCommandForKey, marketCommandFromBlock } from '@/lib/mining-commands';
import {
  blockHexToGrid,
  buildBlockChainCode,
  doesGlobalValueMeetRequirement,
  formatBlockRequirement,
  gridToBlockHex,
  MM3_BLOCK_REQUIREMENT_BY_HEX,
  MM3_MINE_BLOCK_TOTAL,
  mm3ValueToHex,
  normalizeBlockHex,
} from '@/lib/mm3-block-chain';
import { formatWalletLabel } from '@/lib/wallet-format';
import { checkAndAwardChainWinner, TOTAL_BOARD_CELLS } from '@/lib/chain-winner';

function normalizeWallet(value) {
  return String(value || '').trim().toLowerCase();
}

function toCnyFromEur(value) {
  return Number(value || 0) / CNY_TO_EUR;
}

function toUsdFromEur(value) {
  return Number(value || 0) * (CNY_TO_USD / CNY_TO_EUR);
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = normalizeWallet(body.wallet);
  const blockHex = normalizeBlockHex(body.blockHex);
  const requirement = MM3_BLOCK_REQUIREMENT_BY_HEX.get(blockHex);

  if (!wallet || !blockHex) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }
  if (!requirement) {
    return Response.json({ ok: false, error: 'block_not_mineable', blockHex }, { status: 400 });
  }

  const grid = blockHexToGrid(blockHex);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const [{ data: reservedBlock }, { data: nftjiBlocks, count: reservedCount }, { data: existing }, { data: progress }, { data: tokenValue }, { data: macroRow }] = await Promise.all([
      supabase
        .from('mm3_mining_blocks')
        .select('block_key, emoji, price_eur, is_active, first_purchased_at, market_command')
        .eq('grid_row', grid.row)
        .eq('grid_col', grid.col)
        .maybeSingle(),
      supabase
        .from('mm3_mining_blocks')
        .select('grid_row, grid_col', { count: 'exact' }),
      supabase
        .from('mm3_mined_blocks')
        .select('block_hex, wallet')
        .eq('block_hex', blockHex)
        .maybeSingle(),
      supabase
        .from('player_progress')
        .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, mining_nftji_key, mining_nftji_price, mining_nftji_levels')
        .eq('wallet', wallet)
        .maybeSingle(),
      supabase
        .from('token_value')
        .select('total_eth')
        .maybeSingle(),
      supabase
        .from('mm3_macro_state')
        .select('chain_demine_active')
        .eq('id', 1)
        .maybeSingle(),
    ]);

    if (macroRow?.chain_demine_active) {
      return Response.json({ ok: false, error: 'chain_demine_active' }, { status: 423 });
    }
    if (existing) {
      return Response.json({ ok: false, error: 'already_mined', blockHex, owner: existing.wallet }, { status: 409 });
    }
    if (reservedBlock && !reservedBlock.is_active) {
      return Response.json({ ok: false, error: 'nftji_offline', blockHex }, { status: 409 });
    }
    if (reservedBlock && progress?.mining_nftji_key && progress.mining_nftji_key !== reservedBlock.block_key) {
      return Response.json({ ok: false, error: 'already_owns_nftji', blockHex }, { status: 409 });
    }

    const walletLevel = Number(progress?.level) || 0;
    const globalMm3 = Number(tokenValue?.total_eth) || 0;
    const hasLevel = walletLevel >= requirement.minLevel;
    const hasValue = doesGlobalValueMeetRequirement(globalMm3, requirement.requiredMm3);
    if (!hasLevel || !hasValue) {
      return Response.json({
        ok: false,
        error: 'requirements_not_met',
        blockHex,
        requirement: formatBlockRequirement(requirement),
        walletLevel,
        globalMm3,
      }, { status: 403 });
    }

    const nftjiPurchase = reservedBlock ? (() => {
      const priceEur = Number(reservedBlock.price_eur) || 0;
      const priceUsd = toUsdFromEur(priceEur);
      const priceCny = toCnyFromEur(priceEur);
      const soldMm3 = Number(progress?.mm3_sold) || 0;
      const fundsEur = Number(progress?.eur_earned) || 0;
      const fundsUsd = Number(progress?.usd_earned) || 0;
      const fundsCny = Number(progress?.cny_earned) || 0;
      const decorations = normalizeWalletDecorations(progress?.wallet_emojis);
      const commandEntry = marketCommandFromBlock(reservedBlock) || getMarketCommandForKey(reservedBlock.block_key);
      const paysWithMm3 = commandEntry?.payment === 'mm3';
      const availableMm3 = Math.max(0, globalMm3 - soldMm3);

      return {
        priceEur,
        priceUsd,
        priceCny,
        soldMm3,
        fundsEur,
        fundsUsd,
        fundsCny,
        decorations,
        paysWithMm3,
        availableMm3,
      };
    })() : null;

    if (nftjiPurchase?.paysWithMm3) {
      if (nftjiPurchase.availableMm3 < nftjiPurchase.priceEur) {
        return Response.json({ ok: false, error: 'insufficient_funds', blockHex }, { status: 403 });
      }
    } else if (
      nftjiPurchase &&
      (nftjiPurchase.fundsEur < nftjiPurchase.priceEur ||
        nftjiPurchase.fundsUsd < nftjiPurchase.priceUsd ||
        nftjiPurchase.fundsCny < nftjiPurchase.priceCny)
    ) {
      return Response.json({ ok: false, error: 'insufficient_funds', blockHex }, { status: 403 });
    }

    const { data: last } = await supabase
      .from('mm3_mined_blocks')
      .select('chain_index')
      .order('chain_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    const chainIndex = (Number(last?.chain_index) || 0) + 1;
    const { data: mined, error: insertError } = await supabase
      .from('mm3_mined_blocks')
      .insert({
        block_hex: blockHex,
        grid_row: grid.row,
        grid_col: grid.col,
        wallet,
        wallet_level: walletLevel,
        mm3_value: globalMm3,
        mm3_value_hex: mm3ValueToHex(globalMm3),
        chain_index: chainIndex,
      })
      .select('*')
      .single();

    if (insertError?.code === '23505') {
      return Response.json({ ok: false, error: 'already_mined', blockHex }, { status: 409 });
    }
    if (insertError) throw insertError;

    let nftjiClaimed = null;
    if (reservedBlock) {
      const priceEur = nftjiPurchase.priceEur;
      const priceUsd = nftjiPurchase.priceUsd;
      const priceCny = nftjiPurchase.priceCny;
      const level = walletLevel;
      const soldMm3 = nftjiPurchase.soldMm3;
      const fundsEur = nftjiPurchase.fundsEur;
      const fundsUsd = nftjiPurchase.fundsUsd;
      const fundsCny = nftjiPurchase.fundsCny;
      const decorations = nftjiPurchase.decorations;
      const paysWithMm3 = nftjiPurchase.paysWithMm3;

      const rateCny = getSellRateCny(level);
      const buyDelta = paysWithMm3 ? priceEur : priceEur / (rateCny * CNY_TO_EUR);
      const quote = getSellQuote(level, Math.max(0, globalMm3 - soldMm3), decorations);
      const now = new Date().toISOString();
      const levels = progress?.mining_nftji_levels || {};

      const { error: progressError } = await supabase
        .from('player_progress')
        .upsert({
          wallet,
          level,
          mm3_sold: paysWithMm3 ? soldMm3 + priceEur : soldMm3,
          eur_earned: paysWithMm3 ? fundsEur : fundsEur - priceEur,
          usd_earned: paysWithMm3 ? fundsUsd : fundsUsd - priceUsd,
          cny_earned: paysWithMm3 ? fundsCny : fundsCny - priceCny,
          wallet_emojis: decorations,
          life_used: Boolean(progress?.life_used),
          lucky_50_claimed: Boolean(progress?.lucky_50_claimed),
          lucky_100_claimed: Boolean(progress?.lucky_100_claimed),
          lucky_500_claimed: Boolean(progress?.lucky_500_claimed),
          lucky_1000_claimed: Boolean(progress?.lucky_1000_claimed),
          sell_rate_cny: quote.rateCny,
          sell_quote_cny: quote.netCny,
          sell_quote_eur: quote.netEur,
          sell_quote_usd: quote.netUsd,
          mining_nftji_key: reservedBlock.block_key,
          mining_nftji_price: priceEur,
          mining_nftji_since: now,
          mining_nftji_levels: {
            ...levels,
            [reservedBlock.block_key]: Number(levels[reservedBlock.block_key] ?? -1) + 1,
          },
          updated_at: now,
        }, { onConflict: 'wallet', ignoreDuplicates: false });
      if (progressError) throw progressError;

      await supabase.from('mm3_mining_events').insert({
        wallet,
        event_type: 'mining_buy',
        delta_mm3: buyDelta,
        emoji: String(reservedBlock.emoji || reservedBlock.block_key),
      });

      if (!reservedBlock.first_purchased_at) {
        await supabase
          .from('mm3_mining_blocks')
          .update({ first_purchased_at: now })
          .eq('block_key', reservedBlock.block_key);
      }

      nftjiClaimed = {
        key: reservedBlock.block_key,
        emoji: reservedBlock.emoji,
        payment: paysWithMm3 ? 'mm3' : 'money',
      };
    }

    const { data: chainRows } = await supabase
      .from('mm3_mined_blocks')
      .select('block_hex, wallet, mm3_value_hex, chain_index')
      .order('chain_index', { ascending: true });
    const chain = chainRows || [mined];
    const nftjiHexes = new Set(
      (nftjiBlocks || []).filter(b => b.grid_row != null && b.grid_col != null)
        .map(b => gridToBlockHex(b.grid_row, b.grid_col))
    );
    const freeChain = chain.filter(r => !nftjiHexes.has(r.block_hex));
    const freeBlocksTotal = Math.max(1, MM3_MINE_BLOCK_TOTAL - (Number(reservedCount) || 0)); // 1000 - nftji = 980
    const freePercent = Math.round((freeChain.length / freeBlocksTotal) * 10000) / 100;
    const walletMinedCount = freeChain.filter((row) => normalizeWallet(row.wallet) === wallet).length;
    const walletNftjiCount = progress?.mining_nftji_key || nftjiClaimed ? 1 : 0;
    const walletPercent = Math.round(
      ((walletMinedCount + walletNftjiCount) / TOTAL_BOARD_CELLS) * 10000
    ) / 100;
    const code = buildBlockChainCode(chain);
    const ts = Date.now();
    const trace = `MM3 BLOCK CHAIN IN PROGRESS >> mined ${blockHex}${nftjiClaimed ? ` NFTJI ${nftjiClaimed.emoji || nftjiClaimed.key}` : ''} by ${formatWalletLabel(wallet)} >> ${freeChain.length}/${freeBlocksTotal} ${freePercent.toFixed(2)}% >> ${code}`;

    await supabase
      .from('player_progress')
      .upsert({ wallet, block_chain_percent: walletPercent, updated_at: new Date().toISOString() }, { onConflict: 'wallet', ignoreDuplicates: false });

    await supabase.from('mm3_relaying_messages').insert({
      wallet: 'system',
      text: trace,
      ts,
      kind: 'system',
      tone: 'market',
    });

    if (freeChain.length >= freeBlocksTotal) {
      await checkAndAwardChainWinner(supabase);
    }

    return Response.json({ ok: true, mined, trace, percent: freePercent, code, ts, nftjiClaimed });
  } catch (error) {
    console.error('mine block error:', error);
    const missingTable = error?.code === '42P01';
    return Response.json({ ok: false, error: missingTable ? 'block_chain_not_installed' : 'db_error' }, { status: missingTable ? 501 : 500 });
  }
}
