import { createClient } from '@supabase/supabase-js'
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  getRateLimitHeaders
} from '@/lib/rateLimitConfig'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const poll_id = searchParams.get('poll_id')
  const wallet = searchParams.get('wallet')?.toLowerCase()

  const ip =
    req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const endpoint = '/api/pov/has-voted'

  await supabase.from('api_requests').insert({ ip, endpoint })

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()

  const { count, error: countError } = await supabase
    .from('api_requests')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('endpoint', endpoint)
    .gte('created_at', since)

  if (countError) {
    return new Response(JSON.stringify({ error: 'Rate limit check failed' }), {
      status: 500,
      headers: getRateLimitHeaders(count ?? 0)
    })
  }

  if (count >= RATE_LIMIT_MAX) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: getRateLimitHeaders(count)
    })
  }


  if (!poll_id || !wallet) {
    return new Response(JSON.stringify({ error: 'Missing poll_id or wallet' }), {
      status: 400,
      headers: getRateLimitHeaders(count)
    })
  }

  const { data, error } = await supabase
    .from('poll_votes')
    .select('id')
    .eq('poll_id', poll_id)
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: getRateLimitHeaders(count)
    })
  }

  const hasVoted = !!data

  return new Response(JSON.stringify({ hasVoted }), {
    status: 200,
    headers: {
      ...getRateLimitHeaders(count + 1),
      'Cache-Control': 'public, max-age=30'
    }
  })
}
