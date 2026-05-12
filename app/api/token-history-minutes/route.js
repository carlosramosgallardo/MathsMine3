export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

// Returns minute-level MM3 value for the last ~75 minutes.
// Builds the same cumulative logic as token_value_timeseries but at 1-minute granularity.
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const windowStart = new Date(Date.now() - 90 * 60 * 1000).toISOString()

  const [
    { data: gamesData,  error: e1 },
    { data: sellData,   error: e2 },
    { data: marketData, error: e3 },
    { data: baseData,   error: e4 },
    { data: presenceData, error: e5 },
  ] = await Promise.all([
    // Correct answers mining rewards
    supabase.from('games')
      .select('created_at, mining_reward')
      .eq('is_correct', true)
      .gte('created_at', windowStart)
      .order('created_at'),
    // Sell transaction commissions (added to global MM3 pool)
    supabase.from('mm3_sell_transactions')
      .select('wallet, source, created_at, mm3_commission')
      .gte('created_at', windowStart)
      .order('created_at'),
    // Market events (nftji / life events)
    supabase.from('mm3_market_events')
      .select('created_at, event_type, delta_mm3')
      .gte('created_at', windowStart)
      .order('created_at'),
    // Last known hourly value before the window — used as base
    supabase.from('token_value_timeseries')
      .select('hour, cumulative_reward')
      .lte('hour', windowStart)
      .order('hour', { ascending: false })
      .limit(1),
    supabase.from('mm3_wallet_presence')
      .select('wallet, source'),
  ])

  if (e1 || e2 || e3 || e4 || e5) {
    const msg = [e1, e2, e3, e4, e5].find(Boolean)?.message
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Group deltas by UTC minute key "HH:MM"
  const sourceByWallet = new Map(
    (presenceData ?? []).map(row => [String(row.wallet || '').toLowerCase(), row.source === 'google' ? 'google' : 'wallet'])
  )
  const minuteDeltas = {}
  const ensure = key => {
    if (!minuteDeltas[key]) {
      minuteDeltas[key] = {
        delta: 0,
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
    return minuteDeltas[key]
  }
  const add = (created_at, amount, field) => {
    const d   = new Date(created_at)
    const key = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
    const bucket = ensure(key)
    const value = parseFloat(amount || 0)
    bucket.delta += value
    bucket[field] += value
  }

  gamesData?.forEach(e  => add(e.created_at, e.mining_reward, 'mined_delta'))
  sellData?.forEach(e => {
    add(e.created_at, e.mm3_commission, 'trade_delta')
    const d = new Date(e.created_at)
    const key = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
    const bucket = ensure(key)
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

  const baseValue = parseFloat(baseData?.[0]?.cumulative_reward ?? 0)

  // Fill every minute in the window so the line is continuous
  const now  = new Date()
  const from = new Date(Date.now() - 60 * 60 * 1000)  // exactly 60 min ago
  const grid = []
  for (let t = new Date(from); t <= now; t = new Date(t.getTime() + 60000)) {
    const key = `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`
    grid.push(key)
  }

  // Build cumulative series over the full minute grid
  let cumulative = baseValue
  const result = grid.map(key => {
    const deltas = minuteDeltas[key] ?? { delta: 0, mined_delta: 0, trade_delta: 0, trade_wallet_count: 0, trade_google_count: 0, nftji_delta: 0, market_delta: 0 }
    deltas.trade_wallet_count = deltas._trade_wallets?.size ?? deltas.trade_wallet_count ?? 0
    deltas.trade_google_count = deltas._trade_google?.size ?? deltas.trade_google_count ?? 0
    cumulative += deltas.delta
    const { _trade_wallets, _trade_google, ...publicDeltas } = deltas
    return { minute: key, value: cumulative, ...publicDeltas }
  })

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
