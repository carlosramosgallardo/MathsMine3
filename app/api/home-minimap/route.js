export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

const CACHE_MS = 300_000;
let cached = null;
let pending = null;

async function loadSnapshot(supabase) {
  if (cached && Date.now() - cached.ts < CACHE_MS) return cached.payload;
  if (!pending) {
    pending = Promise.all([
      supabase.from('mm3_mined_blocks').select('block_hex, wallet'),
      supabase
        .from('mm3_mining_blocks')
        .select('block_key, emoji')
        .eq('is_active', true)
        .order('block_key', { ascending: true }),
    ]).then(([mined, markets]) => {
      if (mined.error) throw mined.error;
      if (markets.error) throw markets.error;
      const payload = {
        mined: (mined.data || []).map((row) => [row.block_hex, row.wallet]),
        markets: (markets.data || []).map((row) => row.emoji),
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
    const snapshot = await loadSnapshot(supabase);
    return Response.json({ ok: true, ...snapshot }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'snapshot failed' }, { status: 500 });
  }
}
