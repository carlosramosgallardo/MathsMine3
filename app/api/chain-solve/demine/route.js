export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { formatWalletLabel } from '@/lib/wallet-format';
import { MM3_MINE_BLOCK_TOTAL } from '@/lib/mm3-block-chain';

function normalizeWallet(value) {
  return String(value || '').trim().toLowerCase();
}

export async function POST(req) {
  try {
    return await handleDemine(req);
  } catch (err) {
    console.error('[chain-solve/demine]', err);
    return Response.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

async function handleDemine(req) {
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = normalizeWallet(body.wallet);
  if (!wallet) {
    return Response.json({ ok: false, error: 'wallet_required' }, { status: 400 });
  }
  if (wallet.startsWith('anon-')) {
    return Response.json({ ok: false, error: 'anon_no_reward' }, { status: 403 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Fetch demine state
  const { data: macroRow } = await supabase
    .from('mm3_macro_state')
    .select('chain_demine_active, chain_demine_hits_remaining, formula_chain_index_start')
    .eq('id', 1)
    .maybeSingle();

  if (!macroRow?.chain_demine_active) {
    return Response.json({ ok: false, error: 'demine_not_active' }, { status: 409 });
  }

  const hitsRemaining = Number(macroRow.chain_demine_hits_remaining) || 0;
  const formulaChainIndexStart = macroRow.formula_chain_index_start != null
    ? Number(macroRow.formula_chain_index_start)
    : null;

  if (hitsRemaining <= 0) {
    return Response.json({ ok: false, error: 'demine_complete' }, { status: 409 });
  }

  // Get mined blocks — include chain_index so we can filter formula-auto-mined blocks
  const { data: allMined } = await supabase
    .from('mm3_mined_blocks')
    .select('id, block_hex, wallet, chain_index');

  // If formula solve: only demine blocks auto-mined by the solver (chain_index >= start)
  // Pre-formula blocks are preserved through the demine cycle
  const deminePool = formulaChainIndexStart != null
    ? (allMined || []).filter(r => (r.chain_index ?? 0) >= formulaChainIndexStart)
    : (allMined || []);

  const total = deminePool.length;

  if (total === 0) {
    // Edge case: no formula blocks left — finalize reset immediately
    await finalizeDemine(supabase, null, formulaChainIndexStart);
    return Response.json({ ok: true, mm3Awarded: 0, blocksRemoved: [], hitsRemaining: 0, chainReset: true });
  }

  // Calculate blocks to remove: spread evenly over remaining hits
  const toRemoveCount = Math.max(1, Math.ceil(total / hitsRemaining));

  // Fisher-Yates shuffle, take first N
  const shuffled = [...deminePool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const removing = shuffled.slice(0, toRemoveCount);
  const removingIds = removing.map(r => r.id);
  const removingHexes = removing.map(r => r.block_hex);

  // Delete the selected blocks
  await supabase.from('mm3_mined_blocks').delete().in('id', removingIds);

  const newHitsRemaining = hitsRemaining - 1;

  // Award 1 MM3: reduce mm3_sold by 1 (allows negative — negative mm3_sold = pre-earned MM3 credit)
  // available_mm3 = leaderboard_data.total_eth - player_progress.mm3_sold
  // so mm3_sold going below 0 correctly adds to available balance
  const { data: hitterProgress } = await supabase
    .from('player_progress')
    .select('mm3_sold')
    .eq('wallet', wallet)
    .maybeSingle();

  const currentSold = Number(hitterProgress?.mm3_sold) || 0;
  await supabase.from('player_progress').upsert({
    wallet,
    mm3_sold: currentSold - 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'wallet', ignoreDuplicates: false });

  if (newHitsRemaining <= 0 || total - toRemoveCount <= 0) {
    // All done — reset to normal mining mode
    await finalizeDemine(supabase, wallet, formulaChainIndexStart);
    return Response.json({
      ok: true,
      mm3Awarded: 1,
      blocksRemoved: removingHexes,
      hitsRemaining: 0,
      chainReset: true,
    });
  }

  // Decrement hits remaining
  await supabase.from('mm3_macro_state').update({
    chain_demine_hits_remaining: newHitsRemaining,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  return Response.json({
    ok: true,
    mm3Awarded: 1,
    blocksRemoved: removingHexes,
    hitsRemaining: newHitsRemaining,
    chainReset: false,
  });
}

async function finalizeDemine(supabase, lastHitter, formulaChainIndexStart) {
  const now = new Date().toISOString();

  // Safety delete: only remove formula-auto-mined blocks (chain_index >= start).
  // If formulaChainIndexStart is null (organic completion), delete all.
  if (formulaChainIndexStart != null) {
    await supabase.from('mm3_mined_blocks').delete().gte('chain_index', formulaChainIndexStart);
  } else {
    await supabase.from('mm3_mined_blocks').delete().neq('id', 0);
  }

  // Count blocks remaining after delete to compute actual post-demine %
  let postPct = 0;
  if (formulaChainIndexStart != null) {
    const [{ count: remainingMined }, { data: nftjiOwners }] = await Promise.all([
      supabase.from('mm3_mined_blocks').select('id', { count: 'exact', head: true }),
      supabase.from('player_progress').select('mining_nftji_key').not('mining_nftji_key', 'is', null),
    ]);
    const nftjiOwned = new Set((nftjiOwners || []).map(r => r.mining_nftji_key)).size;
    postPct = ((Number(remainingMined) || 0) + nftjiOwned) / MM3_MINE_BLOCK_TOTAL * 100;
  }
  const pctStr = postPct.toFixed(4);

  // Ticker expires after 15 minutes so welcome message resumes automatically
  const tickerExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // Reset demine state
  const msgEn = formulaChainIndexStart != null
    ? `⬡ DEMINE COMPLETE ⬡ Chain reset to pre-formula state — chain is at ${pctStr}%. Mining is now ACTIVE again. ⬡`
    : `⬡ DEMINE COMPLETE ⬡ All blocks removed — chain is at ${pctStr}%. Mining is now ACTIVE again. ⬡`;
  const msgEs = formulaChainIndexStart != null
    ? `⬡ DEMINE COMPLETADO ⬡ Chain al ${pctStr}% (estado pre-fórmula). El minado está ACTIVO de nuevo. ⬡`
    : `⬡ DEMINE COMPLETADO ⬡ Todos los bloques eliminados — chain al ${pctStr}%. El minado está ACTIVO de nuevo. ⬡`;

  await Promise.all([
    supabase.from('mm3_macro_state').update({
      chain_demine_active: false,
      chain_demine_hits_remaining: 100,
      formula_chain_index_start: null,
      ticker_message: msgEs,
      ticker_message_en: msgEn,
      ticker_message_es: msgEs,
      ticker_message_expires_at: tickerExpiresAt,
      updated_at: now,
    }).eq('id', 1),
    // Reset all player block_chain_percent
    supabase.from('player_progress').update({
      block_chain_percent: 0,
      updated_at: now,
    }).not('wallet', 'is', null),
    supabase.from('mm3_relaying_messages').insert({
      wallet: 'system',
      text: msgEn,
      ts: Date.now(),
      kind: 'system',
      tone: 'market',
    }),
  ]);
}
