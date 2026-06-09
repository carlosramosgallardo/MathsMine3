export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

// Ratio thresholds — fallback for old events that don't have emoji stored.
// ratio = |delta_mm3| / MM3_value_at_that_hour ≈ original marketDelta
function emojiFromRatio(ratio) {
  if (ratio >= 0.175) return '❤️'  // life ~25%
  if (ratio >= 0.070) return '🧿'  // lucky1000 ~10%
  if (ratio >= 0.025) return '🎰'  // lucky500 ~5%
  if (ratio >= 0.005) return '🍀'  // lucky100 ~1%
  if (ratio >= 0.002) return '🔮'  // lucky50 ~0.5%
  return null
}

function nearestValue(createdAt, timeseries) {
  const evMs = new Date(createdAt).getTime()
  let best = 0, minDiff = Infinity
  for (const { hour, cumulative_reward } of timeseries) {
    const diff = Math.abs(new Date(hour).getTime() - evMs)
    if (diff < minDiff) { minDiff = diff; best = parseFloat(cumulative_reward) }
  }
  return best
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const [
    { data: rawEvents,  error: e1 },
    { data: relayEvents, error: e3 },
    { data: timeseries, error: e2 },
  ] = await Promise.all([
    supabase
      .from('mm3_mining_events')
      .select('wallet, event_type, delta_mm3, created_at, emoji')
      .neq('event_type', 'relaying')
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('mm3_mining_events')
      .select('wallet, event_type, delta_mm3, created_at, emoji')
      .eq('event_type', 'relaying')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('token_value_timeseries')
      .select('hour, cumulative_reward')
      .order('hour', { ascending: true })
      .limit(2000),
  ])

  if (e1 || e2 || e3) {
    return new Response(JSON.stringify({ error: (e1 || e2 || e3).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Sort ascending so positional emoji assignment works chronologically
  const events = [...(rawEvents ?? []), ...(relayEvents ?? [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  // Collect wallets whose old events need fallback from wallet_emojis
  const needsFallback = new Set()
  const withEmoji = events.map(ev => {
    // ── Primary: emoji stored directly in the row (new events) ──
    if (ev.emoji) return ev

    // ── Secondary: ratio against nearest hourly MM3 value ──
    const mm3   = nearestValue(ev.created_at, timeseries)
    const ratio = mm3 > 0 ? Math.abs(parseFloat(ev.delta_mm3)) / mm3 : 0
    const guessed = emojiFromRatio(ratio)
    if (guessed) return { ...ev, emoji: guessed }

    // ── Tertiary: positional from wallet_emojis (delta ≈ 0 at game start) ──
    needsFallback.add(ev.wallet)
    return ev  // emoji still null, resolved in second pass
  })

  // Fetch wallet_emojis for events that couldn't be resolved above
  let emojiMap = {}
  if (needsFallback.size) {
    const { data: progress } = await supabase
      .from('player_progress')
      .select('wallet, wallet_emojis')
      .in('wallet', [...needsFallback])

    progress?.forEach(p => {
      // wallet_emojis is ordered by claim time; exclude ❤️ (resolved by event_type)
      emojiMap[p.wallet] = (Array.isArray(p.wallet_emojis) ? p.wallet_emojis : [])
        .filter(e => e !== '❤️')
    })
  }

  // Second pass: assign positional emoji for unresolved events
  const walletIdx = {}
  const enriched = withEmoji.map(ev => {
    if (ev.emoji) return { wallet: ev.wallet, event_type: ev.event_type, delta_mm3: ev.delta_mm3, created_at: ev.created_at, emoji: ev.emoji }

    if (ev.event_type === 'nftji_claim') {
      const k = ev.wallet
      if (walletIdx[k] == null) walletIdx[k] = 0
      const emojis = emojiMap[k] || []
      const emoji  = emojis[walletIdx[k]++] ?? '🔮'
      return { wallet: ev.wallet, event_type: ev.event_type, delta_mm3: ev.delta_mm3, created_at: ev.created_at, emoji }
    }

    return { wallet: ev.wallet, event_type: ev.event_type, delta_mm3: ev.delta_mm3, created_at: ev.created_at, emoji: '❤️' }
  })

  return new Response(JSON.stringify(enriched), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
