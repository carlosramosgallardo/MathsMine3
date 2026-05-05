export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const poolCode = searchParams.get('pool') || null;
  const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    let query = supabase
      .from('mm3_pool_disputes')
      .select(`
        id, challenger_pool_code, defender_pool_code, status,
        registered_at, battle_start_at, resolved_at,
        war_percent, nature_percent, dice_modifier,
        ch_wallet_count, ch_level_sum, ch_mm3_sum, ch_eur_sum,
        ch_nftji_count, ch_market_nftji_count, ch_penalty_count, ch_exec_count, ch_score, ch_squeeze_atk_sum,
        df_wallet_count, df_level_sum, df_mm3_sum, df_eur_sum,
        df_nftji_count, df_market_nftji_count, df_penalty_count, df_exec_count, df_score, df_squeeze_atk_sum,
        winner, result_summary, drop_type
      `)
      .order('registered_at', { ascending: false })
      .limit(limit);

    if (poolCode) {
      query = query.or(
        `challenger_pool_code.eq.${poolCode},defender_pool_code.eq.${poolCode}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    // Fetch participant wallets for all disputes
    const allIds = (data || []).map((d) => d.id);

    let walletRows = [];
    if (allIds.length > 0) {
      const { data: wData } = await supabase
        .from('mm3_pool_dispute_wallets')
        .select('dispute_id, wallet, pool_code, side, registered_at, level_snap, mm3_snap, eur_snap, exec_snap, nftji_snap, market_nftji_snap, has_penalty, eur_stake, mm3_stake, delta_eur, delta_mm3, squeeze_nftji_equipped, squeeze_nftji_level, squeeze_nftji_claimed')
        .in('dispute_id', allIds);
      walletRows = wData || [];

      // Resolve market_nftji_snap keys → actual block emojis (fetch all 20 blocks, no filter)
      const hasAnySnap = walletRows.some((w) => w.market_nftji_snap);
      if (hasAnySnap) {
        const { data: blocks, error: blocksErr } = await supabase
          .from('mm3_market_blocks')
          .select('block_key, emoji');
        if (blocksErr) console.error('disputes: market_blocks fetch error:', blocksErr);
        const emojiByKey = new Map((blocks || []).map((b) => [b.block_key, b.emoji]));
        walletRows = walletRows.map((w) => ({
          ...w,
          market_nftji_emoji: w.market_nftji_snap ? (emojiByKey.get(w.market_nftji_snap) || null) : null,
        }));
      }

      // Also enrich with current market_nftji_key from player_progress (in case snapshot is stale)
      const walletAddrs = [...new Set(walletRows.map((w) => w.wallet))];
      if (walletAddrs.length > 0) {
        const { data: progress } = await supabase
          .from('player_progress')
          .select('wallet, market_nftji_key')
          .in('wallet', walletAddrs)
          .not('market_nftji_key', 'is', null);
        if (progress && progress.length > 0) {
          const { data: allBlocks } = await supabase
            .from('mm3_market_blocks')
            .select('block_key, emoji');
          const emojiByKey = new Map((allBlocks || []).map((b) => [b.block_key, b.emoji]));
          const currentKeyByWallet = new Map(progress.map((p) => [p.wallet, p.market_nftji_key]));
          walletRows = walletRows.map((w) => {
            const currentKey = currentKeyByWallet.get(w.wallet);
            const currentEmoji = currentKey ? (emojiByKey.get(currentKey) || null) : null;
            return {
              ...w,
              market_nftji_emoji: currentEmoji || w.market_nftji_emoji || null,
            };
          });
        }
      }
    }

    // Fetch voter wallets for proposing disputes (to allow clients to filter already-voted)
    const proposingIds = (data || []).filter((d) => d.status === 'proposing').map((d) => d.id);
    let voteRows = [];
    if (proposingIds.length > 0) {
      const { data: vData } = await supabase
        .from('mm3_pool_dispute_votes')
        .select('dispute_id, wallet')
        .in('dispute_id', proposingIds);
      voteRows = vData || [];
    }

    const walletsByDispute = {};
    for (const w of walletRows) {
      if (!walletsByDispute[w.dispute_id]) walletsByDispute[w.dispute_id] = [];
      walletsByDispute[w.dispute_id].push(w);
    }

    const votesByDispute = {};
    for (const v of voteRows) {
      if (!votesByDispute[v.dispute_id]) votesByDispute[v.dispute_id] = [];
      votesByDispute[v.dispute_id].push(v.wallet);
    }

    const disputes = (data || []).map((d) => ({
      ...d,
      wallets: walletsByDispute[d.id] || [],
      votes: votesByDispute[d.id] || [],
    }));

    return Response.json({ ok: true, disputes });
  } catch (error) {
    console.error('disputes list error:', error);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}
