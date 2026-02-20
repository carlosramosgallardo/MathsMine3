import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  getRateLimitHeaders
} from '@/lib/rateLimitConfig'

export const runtime = 'edge'
export const revalidate = 10

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(req) {
  const ip = req.headers.get('x-forwarded-for')
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  const endpoint = '/api/donations-total'

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
    .from('donation_total')
    .select('total_eth')
    .maybeSingle()

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Donations total not available.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getRateLimitHeaders((count ?? 0) + 1) }
    })
  }

  return new Response(JSON.stringify({ total: parseFloat(data.total_eth) }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=120',
      ...getRateLimitHeaders((count ?? 0) + 1)
    }
  })
}
