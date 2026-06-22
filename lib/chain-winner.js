import { gridToBlockHex, MM3_MINE_BLOCK_TOTAL } from '@/lib/mm3-block-chain';
import { formatWalletLabel } from '@/lib/wallet-format';

export const TOTAL_BOARD_CELLS = MM3_MINE_BLOCK_TOTAL; // 719 (excludes 64 obstacles + 1 chain node)

// Called after every block mine — checks if chain is 100% complete and activates demine
export async function checkAndAwardChainWinner(supabase) {
  const [
    { data: allMinedRows },
    { data: nftjiOwners },
    { data: macroRow },
    { data: nftjiPositions, count: totalNftjiCells },
  ] = await Promise.all([
    supabase.from('mm3_mined_blocks').select('block_hex, wallet, mm3_value'),
    supabase.from('player_progress').select('wallet, mining_nftji_key').not('mining_nftji_key', 'is', null),
    supabase.from('mm3_macro_state').select('chain_demine_active').eq('id', 1).maybeSingle(),
    supabase.from('mm3_mining_blocks').select('grid_row, grid_col', { count: 'exact' }),
  ]);

  if (macroRow?.chain_demine_active) return { complete: false, alreadyActive: true };

  const nftjiHexes = new Set(
    (nftjiPositions || []).filter(b => b.grid_row != null && b.grid_col != null)
      .map(b => gridToBlockHex(b.grid_row, b.grid_col))
  );
  const freeMinedCount = (allMinedRows || []).filter(r => !nftjiHexes.has(r.block_hex)).length;
  const freeBlocksTarget = TOTAL_BOARD_CELLS - (Number(totalNftjiCells) || 0);
  const ownedNftjiCount = new Set((nftjiOwners || []).map(r => r.mining_nftji_key)).size;

  if (freeMinedCount < freeBlocksTarget || ownedNftjiCount < (Number(totalNftjiCells) || 0)) {
    return { complete: false };
  }

  // Find the top wallet by block count to record as solver
  const stats = {};
  for (const row of allMinedRows || []) {
    const w = String(row.wallet || '').toLowerCase();
    if (!w) continue;
    stats[w] = (stats[w] || 0) + 1;
  }
  const topWallet = Object.entries(stats).sort(([, a], [, b]) => b - a)[0]?.[0];
  if (!topWallet) return { complete: false };

  return await activateDemineMode(supabase, topWallet, allMinedRows || [], false);
}

// Activates demine mode: records solver, compensates block owners, awards MM3, updates macro state
export async function activateDemineMode(supabase, solverWallet, allMinedRows, formulaSolved) {
  const now = new Date().toISOString();

  // Record solver (UPSERT — ignore if wallet already solved before)
  const { error: solverError } = await supabase
    .from('mm3_chain_solvers')
    .insert({ wallet: solverWallet, solved_at: now, formula_solved: formulaSolved });

  if (solverError && solverError.code !== '23505') {
    console.error('[chain-winner] solver insert error:', solverError);
  }

  // Award 1000 MM3 to solver by reducing mm3_sold (effectively increasing available balance)
  const { data: solverProgress } = await supabase
    .from('player_progress')
    .select('mm3_sold')
    .eq('wallet', solverWallet)
    .maybeSingle();

  const currentSold = Number(solverProgress?.mm3_sold) || 0;
  await supabase.from('player_progress').upsert({
    wallet: solverWallet,
    mm3_sold: Math.max(0, currentSold - 1000),
    updated_at: now,
  }, { onConflict: 'wallet', ignoreDuplicates: false });

  await supabase.from('mm3_mining_events').insert({
    wallet: solverWallet,
    event_type: 'chain_solved_reward',
    delta_mm3: 1000,
  });

  // Compensate all existing block owners (award mm3_value per block they'll lose in demine)
  const byWallet = {};
  for (const { wallet: blockOwner, mm3_value } of allMinedRows) {
    const w = String(blockOwner || '').toLowerCase();
    if (!w) continue;
    byWallet[w] = (byWallet[w] || 0) + (Number(mm3_value) || 0);
  }
  const compensationEvents = Object.entries(byWallet).map(([w, total]) => ({
    wallet: w,
    event_type: 'chain_demine_compensation',
    delta_mm3: Number(total.toFixed(6)),
  }));
  for (let i = 0; i < compensationEvents.length; i += 100) {
    await supabase.from('mm3_mining_events').insert(compensationEvents.slice(i, i + 100));
  }

  const solverLabel = formatWalletLabel(solverWallet, true);
  const msgEn = `⬡ MM3 CHAIN 100% COMPLETE ⬡ ${solverLabel} sealed the chain. DEMINE MODE ACTIVE — hit the chain node for 1 MM3 per hit · 100 hits total ⬡`;
  const msgEs = `⬡ CADENA MM3 100% COMPLETADA ⬡ ${solverLabel} completó la cadena. MODO DEMINE ACTIVO — golpea el nodo para 1 MM3 por golpe · 100 golpes en total ⬡`;

  await Promise.all([
    supabase.from('mm3_macro_state').update({
      chain_demine_active: true,
      chain_demine_hits_remaining: 100,
      ticker_message: msgEs,
      ticker_message_en: msgEn,
      ticker_message_es: msgEs,
      updated_at: now,
    }).eq('id', 1),
    supabase.from('mm3_relaying_messages').insert({
      wallet: 'system',
      text: msgEn,
      ts: Date.now(),
      kind: 'system',
      tone: 'market',
    }),
  ]);

  return { complete: true, solver: solverWallet, now };
}
