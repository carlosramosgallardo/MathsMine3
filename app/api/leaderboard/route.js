export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  getRateLimitHeaders
} from '@/lib/rateLimitConfig'

function clampLevel(level = 0) {
  return Math.max(0, Math.min(100, Number(level) || 0))
}

function maskWallet(wallet) {
  if (!wallet || wallet.length <= 10) return wallet || ''
  return wallet.slice(0, 6) + '...' + wallet.slice(-4)
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

  const [{ data: leaderboardRows, error: leaderboardError }, progressResponse] = await Promise.all([
    supabase
      .from('leaderboard_data')
      .select('wallet, total_eth, total_correct, total_games, highest_streak'),
    supabase
      .from('player_progress')
      .select('wallet, level, mm3_sold, cny_earned, eur_earned, usd_earned, wallet_emojis'),
  ])

  if (leaderboardError) {
    return new Response(JSON.stringify({ error: leaderboardError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getRateLimitHeaders((count ?? 0) + 1) }
    })
  }

  let progressRows = progressResponse?.data || []
  if (progressResponse?.error) {
    const fallback = await supabase
      .from('player_progress')
      .select('wallet, level, mm3_sold, cny_earned, eur_earned, usd_earned')
    progressRows = fallback?.data || []
  }

  const progressByWallet = new Map(
    (progressRows || []).map((entry) => [
      String(entry.wallet || '').toLowerCase(),
      {
        level:       clampLevel(entry.level),
        mm3Sold:     Number(entry.mm3_sold)   || 0,
        cny:         Number(entry.cny_earned) || 0,
        eur:         Number(entry.eur_earned) || 0,
        usd:         Number(entry.usd_earned) || 0,
        walletEmojis: Array.isArray(entry.wallet_emojis) ? entry.wallet_emojis : [],
      },
    ])
  )

  const merged = (leaderboardRows || [])
    .map((entry) => {
      const progress = progressByWallet.get(String(entry.wallet || '').toLowerCase()) || {
        level: 0, mm3Sold: 0, cny: 0, eur: 0, usd: 0, walletEmojis: [],
      }
      const totalMm3 = Number(entry.total_eth) || 0
      return {
        wallet:        entry.wallet,
        level:         progress.level,
        available_mm3: totalMm3 - progress.mm3Sold,
        total_correct: Number(entry.total_correct) || 0,
        total_games:   Number(entry.total_games)   || 0,
        best_streak:   Number(entry.highest_streak) || 0,
        cny_balance:   progress.cny,
        eur_balance:   progress.eur,
        usd_balance:   progress.usd,
        nftjis:      progress.walletEmojis,
      }
    })
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level
      if (b.available_mm3 !== a.available_mm3) return b.available_mm3 - a.available_mm3
      return String(a.wallet).localeCompare(String(b.wallet))
    })

  const pageItems = merged.slice(offset, offset + limit).map((entry, index) => ({
    rank:          offset + index + 1,
    wallet:        maskWallet(entry.wallet),
    level:         entry.level,
    available_mm3: Number(entry.available_mm3 || 0),
    total_correct: entry.total_correct,
    total_games:   entry.total_games,
    best_streak:   entry.best_streak,
    cny_balance:   entry.cny_balance,
    eur_balance:   entry.eur_balance,
    usd_balance:   entry.usd_balance,
    nftjis:      entry.nftjis,
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
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      ...getRateLimitHeaders((count ?? 0) + 1)
    }
  })
}
