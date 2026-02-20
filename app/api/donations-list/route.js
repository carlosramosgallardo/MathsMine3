import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  getRateLimitHeaders
} from '@/lib/rateLimitConfig'

export const runtime = 'edge'
// Revalidate hint for Next.js (ISR-like semantics in Route Handlers)
export const revalidate = 10

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const mask = (w) => (!w || w.length <= 10 ? (w || '') : w.slice(0, 5) + '...' + w.slice(-5))

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10), 1), 2000)

  const ip = req.headers.get('x-forwarded-for')
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  const endpoint = '/api/donations-list'

  // ---- Rate limit (CHECK FIRST, then log) ----
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

  // Log only after passing the limit
  await supabase.from('api_requests').insert({ ip, endpoint })

  const { data, error } = await supabase
    .from('mm3_donations')
    .select('wallet, amount_eth, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getRateLimitHeaders((count ?? 0) + 1) }
    })
  }

  const shaped = (data || []).map((r) => {
    const d = new Date(r.created_at)
    const hourIso = new Date(Date.UTC(
      d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0
    )).toISOString()
    return {
      wallet: mask(r.wallet),
      hour: hourIso,
      amount_eth: parseFloat(r.amount_eth)
    }
  })

  return new Response(JSON.stringify(shaped), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // 10s fresh; serve stale up to 2 min while revalida en background
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=120',
      ...getRateLimitHeaders((count ?? 0) + 1)
    }
  })
}
