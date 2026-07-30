export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  getRateLimitHeaders
} from '@/lib/rateLimitConfig'
import { formatWalletLabel } from '@/lib/wallet-format'
import { isAnonymousWallet } from '@/lib/is-anonymous-wallet'
import { mergeLeaderboardEntries } from '@/lib/leaderboard-merge'

function maskWallet(wallet) {
  return formatWalletLabel(wallet)
}

export async function GET(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { searchParams } = new URL(req.url)
  const page  = Math.max(parseInt(searchParams.get('page')  || '1',   10), 1)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50',  10), 1), 200)
  const offset = (page - 1) * limit

  const ip =
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  const endpoint = '/api/leaderboard'

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count, error: countError } = await supabase
    .from('api_requests')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('endpoint', endpoint)
    .gte('created_at', since)

  if (countError) {
    return new Response(JSON.stringify({ error: 'Rate check failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getRateLimitHeaders(count ?? 0) }
    })
  }

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...getRateLimitHeaders(count ?? 0) }
    })
  }

  await supabase.from('api_requests').insert({ ip, endpoint })

  const [
    leaderboardResponse,
    progressResponse,
    minedBlocksResponse,
    poolMembersResponse,
    squeezeNftjiResponse,
    nftjiOwnersResponse,
  ] = await Promise.all([
    supabase
      .from('leaderboard_data')
      .select('wallet, total_eth, total_correct, total_games, highest_streak'),
    supabase
      .from('player_progress')
      .select('wallet, level, block_chain_percent, mm3_sold, cny_earned, eur_earned, usd_earned, wallet_emojis, is_bot'),
    supabase
      .from('mm3_mined_blocks')
      .select('wallet'),
    supabase
      .from('mm3_wallet_pool_members')
      .select('wallet, pool_code'),
    supabase
      .from('mm3_squeezing_nftji')
      .select('wallet'),
    supabase
      .from('player_progress')
      .select('wallet')
      .not('mining_nftji_key', 'is', null),
  ])

  if (leaderboardResponse.error) {
    return new Response(JSON.stringify({ error: leaderboardResponse.error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getRateLimitHeaders((count ?? 0) + 1) }
    })
  }

  let progressRows = progressResponse?.data || []
  if (progressResponse?.error) {
    const fallback = await supabase
      .from('player_progress')
      .select('wallet, level, mm3_sold, cny_earned, eur_earned, usd_earned, is_bot')
    progressRows = fallback?.data || []
  }

  const merged = mergeLeaderboardEntries({
    leaderboardRows: leaderboardResponse.data || [],
    progressRows,
    minedBlocks: minedBlocksResponse?.error ? [] : minedBlocksResponse?.data || [],
    poolMembers: poolMembersResponse?.error ? [] : poolMembersResponse?.data || [],
    squeezeWallets: squeezeNftjiResponse?.error ? [] : squeezeNftjiResponse?.data || [],
    nftjiOwners: (nftjiOwnersResponse?.data || []).map((entry) => entry.wallet),
  })

  const pageItems = merged.slice(offset, offset + limit).map((entry, index) => ({
    rank: offset + index + 1,
    wallet: maskWallet(entry.wallet),
    level: entry.level,
    block_chain_percent: Number(entry.block_chain_percent || 0),
    mined_block_count: Number(entry.mined_block_count || 0),
    available_mm3: Number(entry.available_mm3 || 0),
    total_correct: entry.total_correct,
    total_games: entry.total_games,
    best_streak: entry.best_streak,
    cny_balance: entry.cny_balance,
    eur_balance: entry.eur_balance,
    usd_balance: entry.usd_balance,
    nftjis: entry.nftjis,
    is_bot: entry.is_bot,
  }))

  return new Response(JSON.stringify({
    page,
    limit,
    total: merged.length,
    items: pageItems,
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      ...getRateLimitHeaders((count ?? 0) + 1)
    }
  })
}
