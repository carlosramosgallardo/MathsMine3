import { gridToBlockHex, MM3_MINE_BLOCK_TOTAL } from '@/lib/mm3-block-chain';
import { formatWalletLabel } from '@/lib/wallet-format';

export const TOTAL_BOARD_CELLS = MM3_MINE_BLOCK_TOTAL; // 1000 (980 regular + 20 NFTJI)

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
// formulaChainIndexStart: first chain_index auto-mined by solver (null = organic completion, delete all on demine)
export async function activateDemineMode(supabase, solverWallet, allMinedRows, formulaSolved, formulaChainIndexStart = null) {
  const now = new Date().toISOString();

  // Record solver (UPSERT — ignore if wallet already solved before)
  const { error: solverError } = await supabase
    .from('mm3_chain_solvers')
    .insert({ wallet: solverWallet, solved_at: now, formula_solved: formulaSolved });

  if (solverError && solverError.code !== '23505') {
    console.error('[chain-winner] solver insert error:', solverError);
  }

  // Award 1000 MM3 to solver by reducing mm3_sold (allows negative = pre-earned credit)
  // available_mm3 = leaderboard_data.total_eth - player_progress.mm3_sold
  const { data: solverProgress } = await supabase
    .from('player_progress')
    .select('mm3_sold')
    .eq('wallet', solverWallet)
    .maybeSingle();

  const currentSold = Number(solverProgress?.mm3_sold) || 0;
  await supabase.from('player_progress').upsert({
    wallet: solverWallet,
    mm3_sold: currentSold - 1000,
    updated_at: now,
  }, { onConflict: 'wallet', ignoreDuplicates: false });

  // Compensate existing block owners: reduce their mm3_sold by their blocks' mm3_value
  const byWallet = {};
  for (const { wallet: blockOwner, mm3_value } of allMinedRows) {
    const w = String(blockOwner || '').toLowerCase();
    if (!w) continue;
    byWallet[w] = (byWallet[w] || 0) + (Number(mm3_value) || 0);
  }
  // Bulk fetch current mm3_sold for all affected wallets
  const affectedWallets = Object.keys(byWallet);
  if (affectedWallets.length > 0) {
    const { data: progressRows } = await supabase
      .from('player_progress')
      .select('wallet, mm3_sold')
      .in('wallet', affectedWallets);
    const soldByWallet = new Map((progressRows || []).map(r => [String(r.wallet).toLowerCase(), Number(r.mm3_sold) || 0]));
    const compensationUpserts = affectedWallets.map(w => ({
      wallet: w,
      mm3_sold: (soldByWallet.get(w) || 0) - byWallet[w],
      updated_at: now,
    }));
    for (let i = 0; i < compensationUpserts.length; i += 100) {
      await supabase.from('player_progress').upsert(
        compensationUpserts.slice(i, i + 100),
        { onConflict: 'wallet', ignoreDuplicates: false }
      );
    }
  }

  const solverLabel = formatWalletLabel(solverWallet, true);
  const msgEn = `⬡ MM3 CHAIN 100% COMPLETE ⬡ ${solverLabel} sealed the chain. DEMINE MODE ACTIVE — hit the chain node for 1 MM3 per hit · 100 hits total ⬡`;
  const msgEs = `⬡ CADENA MM3 100% COMPLETADA ⬡ ${solverLabel} completó la cadena. MODO DEMINE ACTIVO — golpea el nodo para 1 MM3 por golpe · 100 golpes en total ⬡`;

  await Promise.all([
    supabase.from('mm3_macro_state').update({
      chain_demine_active: true,
      chain_demine_hits_remaining: 100,
      formula_chain_index_start: formulaChainIndexStart,
      ticker_message: msgEs,
      ticker_message_en: msgEn,
      ticker_message_es: msgEs,
      ticker_message_expires_at: null,
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
