export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

const CACHE_MS = 300_000;
const PLAYER_CACHE_MS = 60_000;
let cached = null;
let pending = null;
let playerCache = null;
let playerPending = null;

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

async function loadPlayers(supabase) {
  if (playerCache && Date.now() - playerCache.ts < PLAYER_CACHE_MS) return playerCache.players;
  if (!playerPending) {
    const activeSince = new Date(Date.now() - 90_000).toISOString();
    playerPending = supabase
      .from('mm3_pvp_health')
      .select('wallet, last_pos_row, last_pos_col')
      .gte('pos_updated_at', activeSince)
      .not('last_pos_row', 'is', null)
      .not('last_pos_col', 'is', null)
      .then(({ data, error }) => {
        if (error) return [];
        const players = (data || []).map((row) => [row.wallet, row.last_pos_row, row.last_pos_col]);
        playerCache = { ts: Date.now(), players };
        return players;
      })
      .finally(() => { playerPending = null; });
  }
  return playerPending;
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  try {
    const [snapshot, players] = await Promise.all([loadSnapshot(supabase), loadPlayers(supabase)]);
    return Response.json({ ok: true, ...snapshot, players }, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=60' },
    });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'snapshot failed' }, { status: 500 });
  }
}
