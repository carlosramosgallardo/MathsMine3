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
        ch_nftji_count, ch_market_nftji_count, ch_penalty_count, ch_exec_count, ch_score,
        df_wallet_count, df_level_sum, df_mm3_sum, df_eur_sum,
        df_nftji_count, df_market_nftji_count, df_penalty_count, df_exec_count, df_score,
        winner, result_summary
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
        .select('dispute_id, wallet, pool_code, side, registered_at, level_snap, mm3_snap, eur_snap, exec_snap, nftji_snap, market_nftji_snap, has_penalty, eur_stake, mm3_stake, delta_eur, delta_mm3')
        .in('dispute_id', allIds);
      walletRows = wData || [];
    }

    const walletsByDispute = {};
    for (const w of walletRows) {
      if (!walletsByDispute[w.dispute_id]) walletsByDispute[w.dispute_id] = [];
      walletsByDispute[w.dispute_id].push(w);
    }

    const disputes = (data || []).map((d) => ({
      ...d,
      wallets: walletsByDispute[d.id] || [],
    }));

    return Response.json({ ok: true, disputes });
  } catch (error) {
    console.error('disputes list error:', error);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}
