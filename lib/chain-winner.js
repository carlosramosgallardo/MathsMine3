import { MM3_BLOCK_CHAIN_REQUIREMENTS } from '@/lib/mm3-block-chain';
import { formatWalletLabel } from '@/lib/wallet-format';

export const TOTAL_BOARD_CELLS = MM3_BLOCK_CHAIN_REQUIREMENTS.length; // 784

export async function checkAndAwardChainWinner(supabase) {
  const [{ count: freeMinedCount }, { data: nftjiOwners }, { data: existingWinner }] = await Promise.all([
    supabase.from('mm3_mined_blocks').select('id', { count: 'exact', head: true }),
    supabase.from('player_progress').select('mining_nftji_key').not('mining_nftji_key', 'is', null),
    supabase.from('mm3_game_winner').select('wallet').eq('id', 1).maybeSingle(),
  ]);

  if (existingWinner) return { complete: false, alreadyWon: true };

  const { count: totalNftjiCells } = await supabase
    .from('mm3_mining_blocks').select('block_key', { count: 'exact', head: true });
  const freeBlocksTarget = TOTAL_BOARD_CELLS - (Number(totalNftjiCells) || 0);
  const ownedNftjiCount = new Set((nftjiOwners || []).map((r) => r.mining_nftji_key)).size;

  if ((freeMinedCount || 0) < freeBlocksTarget || ownedNftjiCount < (Number(totalNftjiCells) || 0)) {
    return { complete: false };
  }

  const { data: allMined } = await supabase
    .from('mm3_mined_blocks').select('wallet, chain_index');
  const stats = {};
  for (const row of allMined || []) {
    const w = String(row.wallet || '').toLowerCase();
    if (!stats[w]) stats[w] = { count: 0, lastIndex: 0 };
    stats[w].count++;
    stats[w].lastIndex = Math.max(stats[w].lastIndex, row.chain_index || 0);
  }
  const topWallet = Object.entries(stats)
    .sort(([, a], [, b]) => b.count - a.count || a.lastIndex - b.lastIndex)[0]?.[0];
  if (!topWallet) return { complete: false };

  const wonAt = new Date().toISOString();
  const { error } = await supabase.from('mm3_game_winner')
    .insert({ id: 1, wallet: topWallet, won_at: wonAt });
  if (error?.code === '23505') return { complete: false, alreadyWon: true };
  if (error) throw error;

  const winnerLabel = formatWalletLabel(topWallet);
  await Promise.all([
    supabase.from('mm3_relaying_messages').insert({
      wallet: 'system',
      text: `⬡ MM3 BLOCK CHAIN COMPLETE ⬡ ${winnerLabel} sealed the chain with the most blocks mined. Game over. Congratulations.`,
      ts: Date.now(), kind: 'system', tone: 'market',
    }),
    supabase.from('mm3_macro_state').update({
      ticker_message: `⬡ CHAIN COMPLETE · WINNER: ${topWallet.toUpperCase()} ⬡ MM3 BLOCK CHAIN SEALED ⬡`,
      ticker_message_en: `⬡ CHAIN COMPLETE · WINNER: ${winnerLabel.toUpperCase()} ⬡ MM3 BLOCK CHAIN SEALED ⬡`,
      ticker_message_es: `⬡ CADENA SELLADA · GANADOR: ${winnerLabel.toUpperCase()} ⬡ MM3 BLOCK CHAIN COMPLETA ⬡`,
      updated_at: wonAt,
    }).eq('id', 1),
  ]);

  return { complete: true, winner: topWallet, wonAt };
}
