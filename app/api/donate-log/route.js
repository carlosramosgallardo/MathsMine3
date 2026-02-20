import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  getRateLimitHeaders
} from '@/lib/rateLimitConfig'

export const runtime = 'edge'
export const dynamic = 'force-dynamic' // no cache at all for writes

function isValidWallet(w) {
  return typeof w === 'string' && /^0x[0-9a-fA-F]{40}$/.test(w)
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = (body.wallet || '').toLowerCase()

    const ip = req.headers.get('x-forwarded-for')
      ?? req.headers.get('x-real-ip')
      ?? 'unknown'
    const endpoint = '/api/donate-log'

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const expectedAmountStr = process.env.NEXT_PUBLIC_FAKE_MINING_PRICE || '0.00001'
    const expectedAmount = parseFloat(expectedAmountStr)

    if (!url || !anonKey) {
      console.error('[donate-log] Missing Supabase env')
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
    }

    if (!wallet || !isValidWallet(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet format' }, { status: 400 })
    }

    const supabase = createClient(url, anonKey)

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
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...getRateLimitHeaders(count ?? 0) }
      })
    }

    // Log only after passing the limit
    const { error: logErr } = await supabase
      .from('api_requests')
      .insert([{ ip, endpoint }])
    if (logErr) console.warn('[donate-log] api_requests insert warn:', logErr.message)

    // ---- Insert donation (RLS must allow it) ----
    const { error: insertErr } = await supabase.from('mm3_donations').insert([
      { wallet, amount_eth: expectedAmount }
    ])
    if (insertErr) {
      console.error('[donate-log] insert error:', insertErr)
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
    }

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          // Explicitly disable caches for writes
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          ...getRateLimitHeaders((count ?? 0) + 1)
        }
      }
    )
  } catch (e) {
    console.error('[donate-log] unexpected:', e)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
