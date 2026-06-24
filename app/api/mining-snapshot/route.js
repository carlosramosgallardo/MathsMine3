export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { normalizeWalletDecorations } from '@/lib/wallet-decorations';
import { buildBlockChainCode, gridToBlockHex, MM3_BLOCK_CHAIN_REQUIREMENTS } from '@/lib/mm3-block-chain';
import { getMarketCommandForKey } from '@/lib/mining-commands';
import { TOTAL_BOARD_CELLS } from '@/lib/chain-winner';

const PUBLIC_CACHE_MS = 10_000;
const publicSnapshotCache = { full: null, map: null };
const publicSnapshotPromise = { full: null, map: null };

function clampLevel(level = 0) {
  return Math.max(0, Math.min(100, Number(level) || 0));
}

function normalizeWallet(value) {
  return String(value || '').toLowerCase().trim();
}

async function getPublicMarketSnapshot(supabase, { mapOnly = false } = {}) {
  const cacheKey = mapOnly ? 'map' : 'full';
  const now = Date.now();
  const cached = publicSnapshotCache[cacheKey];
  if (cached && now - cached.ts < PUBLIC_CACHE_MS) {
    return cached.payload;
  }

  if (!publicSnapshotPromise[cacheKey]) {
    publicSnapshotPromise[cacheKey] = Promise.all([
      supabase
        .from('mm3_mining_blocks')
        .select(
          mapOnly
            ? 'block_key, grid_row, grid_col, emoji, title_en, title_es, price_eur'
            : 'block_key, grid_row, grid_col, emoji, title_en, title_es, price_eur, short_url, is_active, first_purchased_at, market_command, hidden_cmd_min_level',
        )
        .order('block_key', { ascending: true }),
      supabase
        .from('player_progress')
        .select('wallet, mining_nftji_key')
        .not('mining_nftji_key', 'is', null),
      supabase
        .from('mm3_mined_blocks')
        .select(
          mapOnly
            ? 'block_hex, wallet'
            : 'block_hex, grid_row, grid_col, wallet, wallet_level, mm3_value, mm3_value_hex, chain_index, mined_at',
        )
        .order('chain_index', { ascending: true }),
    ])
      .then(([blocksResponse, ownersResponse, minedResponse]) => {
        if (blocksResponse.error) throw blocksResponse.error;
        if (minedResponse.error && minedResponse.error.code !== '42P01') throw minedResponse.error;
        const minedBlocks = minedResponse.data || [];
        const payload = {
          blocks: blocksResponse.data || [],
          owners: ownersResponse.data || [],
          minedBlocks,
        };
        if (!mapOnly) {
          // Compute reserved NFTJI block hexes to exclude them from free-mined coverage count
          const nftjiHexes = new Set(
            (blocksResponse.data || [])
              .filter(b => b.grid_row != null && b.grid_col != null)
              .map(b => gridToBlockHex(b.grid_row, b.grid_col))
          );
          const freeMinedBlocks = minedBlocks.filter(b => !nftjiHexes.has(b.block_hex));
          const ownedNftjiCount = new Set(
            (ownersResponse.data || []).map((o) => o.mining_nftji_key).filter(Boolean)
          ).size;
          const totalCovered = freeMinedBlocks.length + ownedNftjiCount;
          payload.blockChain = {
            title: 'MM3 BLOCK CHAIN IN PROGRESS',
            mined: totalCovered,
            total: TOTAL_BOARD_CELLS,
            percent: Math.round((totalCovered / TOTAL_BOARD_CELLS) * 10000) / 100,
            freeBlocksMined: freeMinedBlocks.length,
            nftjiCovered: ownedNftjiCount,
            code: buildBlockChainCode(minedBlocks),
          };
        }
        publicSnapshotCache[cacheKey] = { ts: Date.now(), payload };
        return payload;
      })
      .finally(() => {
        publicSnapshotPromise[cacheKey] = null;
      });
  }

  return publicSnapshotPromise[cacheKey];
}

export async function GET(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { searchParams } = new URL(req.url);
  const wallet = normalizeWallet(searchParams.get('wallet'));
  const includeDetails = searchParams.get('details') === '1';
  const mapOnly = searchParams.get('map') === '1';
  const blockKey = String(searchParams.get('blockKey') || '').trim();

  let publicSnapshot;
  try {
    publicSnapshot = await getPublicMarketSnapshot(supabase, { mapOnly });
  } catch (err) {
    return Response.json({ ok: false, error: err?.message || 'market snapshot failed' }, { status: 500 });
  }

  const selectedBlock = blockKey
    ? (publicSnapshot.blocks || []).find((block) => block?.block_key === blockKey)
    : null;
  const selectedEmoji = String(selectedBlock?.emoji || '');

  const [
    progressResponse,
    statsResponse,
    activeCommandResponse,
    activePenaltyResponse,
    buyCountResponse,
    resellCountResponse,
  ] = await Promise.all([
    wallet
      ? supabase
          .from('player_progress')
          .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, mining_nftji_key, mining_nftji_price')
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
    includeDetails && blockKey
      ? supabase
          .from('mm3_mining_commands')
          .select('id, wallet, formula_x, reset_at')
          .eq('nftji_key', blockKey)
          .gt('reset_at', new Date().toISOString())
          .order('executed_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    includeDetails && wallet && blockKey
      ? supabase
          .from('mm3_command_penalties')
          .select('id, nftji_key, penalty_code, penalty_value, penalty_eur, penalty_effect, attempted_at, redeemed_at, reset_at, created_at')
          .eq('wallet', wallet)
          .eq('nftji_key', blockKey)
          .is('redeemed_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    includeDetails && selectedEmoji
      ? supabase
          .from('mm3_mining_events')
          .select('id', { count: 'exact', head: true })
          .eq('emoji', selectedEmoji)
          .eq('event_type', 'mining_buy')
      : Promise.resolve({ count: 0, error: null }),
    includeDetails && selectedEmoji
      ? supabase
          .from('mm3_mining_events')
          .select('id', { count: 'exact', head: true })
          .eq('emoji', selectedEmoji)
          .eq('event_type', 'mining_resell')
      : Promise.resolve({ count: 0, error: null }),
  ]);

  const progress = progressResponse.data;
  const stats = statsResponse.data;
  const cmdDef = blockKey ? getMarketCommandForKey(blockKey) : null
  const cmdFormulaBody = cmdDef?.solve
    ? cmdDef.solve.toString().replace(/^\s*\(\s*x\s*\)\s*=>\s*/, '').trim()
    : null
  const activeBlockCommandEnriched = activeCommandResponse.data
    ? { ...activeCommandResponse.data, formula: cmdFormulaBody, command: cmdDef?.command || null }
    : null

  const detailsPayload = includeDetails
    ? {
        activeBlockCommand: activeBlockCommandEnriched,
        activePenalty: activePenaltyResponse.data || null,
        selectedEventCounts: {
          emoji: selectedEmoji,
          buys: buyCountResponse.count || 0,
          resells: resellCountResponse.count || 0,
        },
      }
    : {};

  return Response.json({
    ok: true,
    blocks: publicSnapshot.blocks,
    owners: publicSnapshot.owners,
    minedBlocks: publicSnapshot.minedBlocks || [],
    blockChain: publicSnapshot.blockChain || null,
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
          miningNFTJIKey: progress?.mining_nftji_key || null,
          miningNFTJIPrice: Number(progress?.mining_nftji_price) || 0,
        }
      : null,
    ...detailsPayload,
  }, {
    headers: {
      'Cache-Control': wallet
        ? 'private, no-store'
        : mapOnly
          ? 'public, s-maxage=10, stale-while-revalidate=120'
          : 'public, s-maxage=10, stale-while-revalidate=60',
    },
  });
}
