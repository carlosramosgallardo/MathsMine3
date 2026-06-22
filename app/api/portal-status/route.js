export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { colorFromAddress } from '@/lib/wallet-colors';

const CACHE_MS = 120_000;
let cached = null;
let pending = null;

async function loadStatus(supabase) {
  if (cached && Date.now() - cached.ts < CACHE_MS) return cached.payload;
  if (!pending) {
    const since = new Date(Date.now() - 90_000).toISOString();
    pending = Promise.all([
      supabase.from('mm3_macro_state').select('war_percent, nature_percent').eq('id', 1).maybeSingle(),
      supabase.from('leaderboard_data').select('wallet').order('total_eth', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('mm3_wallet_presence').select('wallet', { count: 'exact', head: true }).gte('last_seen', since),
      supabase.from('player_progress').select('wallet', { count: 'exact', head: true }),
    ]).then(([macro, top, active, total]) => {
      const payload = {
        macro: macro.data || null,
        accent: top.data?.wallet ? colorFromAddress(top.data.wallet) : '#cbd5e1',
        activeWalletCount: active.count || 0,
        totalWallets: total.count || 0,
      };
      cached = { ts: Date.now(), payload };
      return payload;
    }).finally(() => { pending = null; });
  }
  return pending;
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  try {
    return Response.json({ ok: true, ...(await loadStatus(supabase)) }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'status failed' }, { status: 500 });
  }
}
