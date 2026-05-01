export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { normalizeWalletDecorations } from '@/lib/wallet-decorations';

const PUBLIC_CACHE_MS = 10_000;
let publicSnapshotCache = null;
let publicSnapshotPromise = null;

function clampLevel(level = 0) {
  return Math.max(0, Math.min(100, Number(level) || 0));
}

function normalizeWallet(value) {
  return String(value || '').toLowerCase().trim();
}

async function getPublicMarketSnapshot(supabase) {
  const now = Date.now();
  if (publicSnapshotCache && now - publicSnapshotCache.ts < PUBLIC_CACHE_MS) {
    return publicSnapshotCache.payload;
  }

  if (!publicSnapshotPromise) {
    publicSnapshotPromise = Promise.all([
      supabase
        .from('mm3_market_blocks')
        .select('block_key, grid_row, grid_col, emoji, title_en, title_es, price_eur, short_url, is_active, first_purchased_at, market_command, hidden_cmd_min_level')
        .order('block_key', { ascending: true }),
      supabase
        .from('player_progress')
        .select('wallet, market_nftji_key')
        .not('market_nftji_key', 'is', null),
    ])
      .then(([blocksResponse, ownersResponse]) => {
        if (blocksResponse.error) throw blocksResponse.error;
        const payload = {
          blocks: blocksResponse.data || [],
          owners: ownersResponse.data || [],
        };
        publicSnapshotCache = { ts: Date.now(), payload };
        return payload;
      })
      .finally(() => {
        publicSnapshotPromise = null;
      });
  }

  return publicSnapshotPromise;
}

export async function GET(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { searchParams } = new URL(req.url);
  const wallet = normalizeWallet(searchParams.get('wallet'));
  const includeDetails = searchParams.get('details') === '1';

  let publicSnapshot;
  try {
    publicSnapshot = await getPublicMarketSnapshot(supabase);
  } catch (err) {
    return Response.json({ ok: false, error: err?.message || 'market snapshot failed' }, { status: 500 });
  }

  const [progressResponse, statsResponse] = await Promise.all([
    wallet
      ? supabase
          .from('player_progress')
          .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, market_nftji_key, market_nftji_price')
          .eq('wallet', wallet)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    wallet
      ? supabase
          .from('leaderboard_data')
          .select('total_eth')
          .eq('wallet', wallet)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const progress = progressResponse.data;
  const stats = statsResponse.data;
  const detailsPayload = includeDetails
    ? {
        activeBlockCommand: null,
        activePenalty: null,
        selectedEventCounts: { emoji: '', buys: 0, resells: 0 },
      }
    : {};

  return Response.json({
    ok: true,
    blocks: publicSnapshot.blocks,
    owners: publicSnapshot.owners,
    walletState: wallet
      ? {
          funds: {
            EUR: Number(progress?.eur_earned) || 0,
            USD: Number(progress?.usd_earned) || 0,
            CNY: Number(progress?.cny_earned) || 0,
          },
          level: clampLevel(progress?.level),
          mm3Sold: Number(progress?.mm3_sold) || 0,
          totalMm3: Number(stats?.total_eth) || 0,
          emojis: normalizeWalletDecorations(progress?.wallet_emojis),
          marketNFTJIKey: progress?.market_nftji_key || null,
          marketNFTJIPrice: Number(progress?.market_nftji_price) || 0,
        }
      : null,
    ...detailsPayload,
  }, {
    headers: {
      'Cache-Control': wallet
        ? 'private, no-store'
        : 'public, s-maxage=10, stale-while-revalidate=60',
    },
  });
}
