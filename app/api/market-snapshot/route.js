export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { normalizeWalletDecorations } from '@/lib/wallet-decorations';

function clampLevel(level = 0) {
  return Math.max(0, Math.min(100, Number(level) || 0));
}

function normalizeWallet(value) {
  return String(value || '').toLowerCase().trim();
}

export async function GET(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { searchParams } = new URL(req.url);
  const wallet = normalizeWallet(searchParams.get('wallet'));
  const blockKey = String(searchParams.get('blockKey') || '').trim();
  const nowIso = new Date().toISOString();

  const [
    blocksResponse,
    ownersResponse,
    progressResponse,
    statsResponse,
    commandResponse,
    penaltyResponse,
  ] = await Promise.all([
    supabase
      .from('mm3_market_blocks')
      .select('block_key, grid_row, grid_col, emoji, title_en, title_es, price_eur, short_url, is_active, first_purchased_at, market_command, hidden_cmd_min_level')
      .order('block_key', { ascending: true }),
    supabase
      .from('player_progress')
      .select('wallet, market_nftji_key')
      .not('market_nftji_key', 'is', null),
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
    blockKey
      ? supabase
          .from('mm3_market_commands')
          .select('id, wallet, formula_x, reset_at')
          .eq('nftji_key', blockKey)
          .gt('reset_at', nowIso)
          .order('executed_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    wallet && blockKey
      ? supabase
          .from('mm3_command_penalties')
          .select('id, nftji_key, penalty_code, penalty_value, penalty_eur, penalty_effect, attempted_at, redeemed_at, reset_at, created_at')
          .eq('wallet', wallet)
          .eq('nftji_key', blockKey)
          .is('redeemed_at', null)
          .gt('reset_at', nowIso)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (blocksResponse.error) {
    return Response.json({ ok: false, error: blocksResponse.error.message }, { status: 500 });
  }

  const selectedBlock = (blocksResponse.data || []).find((entry) => entry.block_key === blockKey);
  const selectedEmoji = String(selectedBlock?.emoji || '');
  const [buyCountResponse, resellCountResponse] = selectedEmoji
    ? await Promise.all([
        supabase
          .from('mm3_market_events')
          .select('id', { count: 'exact', head: true })
          .eq('emoji', selectedEmoji)
          .eq('event_type', 'market_buy'),
        supabase
          .from('mm3_market_events')
          .select('id', { count: 'exact', head: true })
          .eq('emoji', selectedEmoji)
          .eq('event_type', 'market_resell'),
      ])
    : [{ count: 0 }, { count: 0 }];

  const progress = progressResponse.data;
  const stats = statsResponse.data;

  return Response.json({
    ok: true,
    blocks: blocksResponse.data || [],
    owners: ownersResponse.data || [],
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
    activeBlockCommand: commandResponse.data || null,
    activePenalty: penaltyResponse.data || null,
    selectedEventCounts: {
      emoji: selectedEmoji,
      buys: buyCountResponse.count || 0,
      resells: resellCountResponse.count || 0,
    },
  }, {
    headers: {
      'Cache-Control': 'private, no-store',
    },
  });
}
