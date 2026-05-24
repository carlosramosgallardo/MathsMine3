export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data, error } = await supabase
    .from('token_value_timeseries')
    .select('hour, cumulative_reward')
    .order('hour', { ascending: false }) // Más recientes primero
    .limit(2000) // Suficiente para cubrir 30d+ (83 días)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Volvemos a ordenar ascendente para el gráfico
  const sorted = data.sort((a, b) => new Date(a.hour) - new Date(b.hour))
  // Cap detail queries to last 30 days — older data is already aggregated in timeseries
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const rawStart = sorted[0]?.hour
  const windowStart = rawStart && rawStart > thirtyDaysAgo ? rawStart : thirtyDaysAgo
  const breakdownByHour = {}
  const sourceByWallet = new Map()

  const hourKey = createdAt => {
    const d = new Date(createdAt)
    d.setUTCMinutes(0, 0, 0)
    return d.toISOString()
  }
  const ensure = key => {
    if (!breakdownByHour[key]) {
      breakdownByHour[key] = {
        mined_delta: 0,
        trade_delta: 0,
        trade_wallet_count: 0,
        trade_google_count: 0,
        _trade_wallets: new Set(),
        _trade_google: new Set(),
        nftji_delta: 0,
        market_delta: 0,
      }
    }
    return breakdownByHour[key]
  }
  const add = (createdAt, amount, field) => {
    const bucket = ensure(hourKey(createdAt))
    bucket[field] += parseFloat(amount || 0)
  }

  if (windowStart) {
    const [
      { data: gamesData },
      { data: sellData },
      { data: marketData },
      { data: presenceData },
    ] = await Promise.all([
      supabase.from('games')
        .select('created_at, mining_reward')
        .eq('is_correct', true)
        .gte('created_at', windowStart)
        .order('created_at')
        .limit(100000),
      supabase.from('mm3_sell_transactions')
        .select('wallet, source, created_at, mm3_commission')
        .gte('created_at', windowStart)
        .order('created_at')
        .limit(50000),
      supabase.from('mm3_mining_events')
        .select('created_at, event_type, delta_mm3')
        .gte('created_at', windowStart)
        .order('created_at')
        .limit(100000),
      supabase.from('mm3_wallet_presence')
        .select('wallet, source'),
    ])

    presenceData?.forEach(row => {
      sourceByWallet.set(String(row.wallet || '').toLowerCase(), row.source === 'google' ? 'google' : 'wallet')
    })
    gamesData?.forEach(e => add(e.created_at, e.mining_reward, 'mined_delta'))
    sellData?.forEach(e => {
      add(e.created_at, e.mm3_commission, 'trade_delta')
      const bucket = ensure(hourKey(e.created_at))
      const walletKey = String(e.wallet || '').toLowerCase()
      const source = e.source === 'google' || sourceByWallet.get(walletKey) === 'google' ? 'google' : 'wallet'
      if (source === 'google') bucket._trade_google.add(walletKey)
      else bucket._trade_wallets.add(walletKey)
    })
    marketData?.forEach(e => add(
      e.created_at,
      e.delta_mm3,
      (e.event_type === 'nftji_claim' || e.event_type === 'nftji_level_up') ? 'nftji_delta' : 'market_delta'
    ))
  }

  const enriched = sorted.map((entry, idx, arr) => {
    const key = hourKey(entry.hour)
    const breakdown = breakdownByHour[key] ?? { mined_delta: 0, trade_delta: 0, trade_wallet_count: 0, trade_google_count: 0, nftji_delta: 0, market_delta: 0 }
    breakdown.trade_wallet_count = breakdown._trade_wallets?.size ?? breakdown.trade_wallet_count ?? 0
    breakdown.trade_google_count = breakdown._trade_google?.size ?? breakdown.trade_google_count ?? 0
    const { _trade_wallets, _trade_google, ...publicBreakdown } = breakdown
    const current = parseFloat(entry.cumulative_reward || 0)
    const previous = parseFloat(arr[idx - 1]?.cumulative_reward ?? entry.cumulative_reward ?? 0)
    return {
      ...entry,
      delta: current - previous,
      ...publicBreakdown,
    }
  })

  return new Response(JSON.stringify(enriched), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=25, stale-while-revalidate=5',
    }
  })
}
