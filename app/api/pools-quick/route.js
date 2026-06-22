export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

const SQUEEZE_LAUNCH_LIMIT = 5;
const SQUEEZE_WINDOW_MS = 24 * 60 * 60 * 1000;

function shortWallet(w) {
  if (!w || w.length < 10) return w || '';
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const windowStart = new Date(Date.now() - SQUEEZE_WINDOW_MS).toISOString();

    const [membersResult, progressResult, launchesResult] = await Promise.all([
      supabase.from('mm3_wallet_pool_members').select('wallet, pool_code'),
      supabase.from('player_progress').select('wallet, level, block_chain_percent'),
      supabase
        .from('mm3_squeezing_launches')
        .select('challenger_pool_code, created_at')
        .gte('created_at', windowStart)
        .order('created_at', { ascending: true }),
    ]);

    const members = membersResult.data || [];
    const progress = progressResult.data || [];
    const launches = launchesResult.data || [];

    const progressByWallet = new Map(progress.map((r) => [r.wallet, r]));

    const poolMap = new Map();
    for (const m of members) {
      const poolCode = String(m.pool_code || '').toUpperCase();
      if (!poolCode || !m.wallet) continue;
      const list = poolMap.get(poolCode) || [];
      list.push(m.wallet);
      poolMap.set(poolCode, list);
    }

    const launchMap = new Map();
    for (const l of launches) {
      const pc = String(l.challenger_pool_code || '').toUpperCase();
      if (!pc) continue;
      const arr = launchMap.get(pc) || [];
      arr.push(l.created_at);
      launchMap.set(pc, arr);
    }

    const pools = [...poolMap.entries()].map(([pool_code, wallets]) => {
      const uniqueWallets = [...new Set(wallets)];
      const entries = uniqueWallets.map((w) => progressByWallet.get(w)).filter(Boolean);
      const total_level = entries.reduce((sum, e) => sum + (Number(e.level) || 0), 0);
      const block_chain_percent = Math.min(
        100,
        entries.reduce((sum, e) => sum + (Number(e.block_chain_percent) || 0), 0)
      );

      const poolLaunches = launchMap.get(pool_code) || [];
      const squeeze_count = poolLaunches.length;
      const firstAt = poolLaunches[0] ? new Date(poolLaunches[0]).getTime() : null;
      const reset_at = firstAt ? new Date(firstAt + SQUEEZE_WINDOW_MS).toISOString() : null;

      const topWallets = uniqueWallets.slice(0, 5);

      return {
        pool_code,
        member_count: uniqueWallets.length,
        member_wallets: topWallets,
        member_wallets_short: topWallets.map(shortWallet),
        total_level,
        block_chain_percent,
        squeeze_count,
        squeeze_limit_reached: squeeze_count >= SQUEEZE_LAUNCH_LIMIT,
        reset_at,
      };
    });

    pools.sort(
      (a, b) =>
        (b.block_chain_percent - a.block_chain_percent) || (b.total_level - a.total_level)
    );

    return Response.json({ ok: true, pools });
  } catch (error) {
    console.error('pools-quick error:', error);
    return Response.json({ ok: false, pools: [] }, { status: 500 });
  }
}
