import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  getRateLimitHeaders
} from '@/lib/rateLimitConfig'

const ipRequests = new Map()

function rateLimit(req) {
  const ip =
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const now = Date.now()
  const entry = ipRequests.get(ip) || { count: 0, timestamp: now }

  if (now - entry.timestamp < RATE_LIMIT_WINDOW_MS) {
    if (entry.count >= RATE_LIMIT_MAX) {
      return { limited: true, ip, count: entry.count, timestamp: entry.timestamp }
    }
    entry.count += 1
  } else {
    entry.count = 1
    entry.timestamp = now
  }

  ipRequests.set(ip, entry)

  return { limited: false, ip, count: entry.count, timestamp: entry.timestamp }
}

export async function GET(req) {
  const result = rateLimit(req)
  const status = result.limited ? 429 : 200

  return new Response(
    JSON.stringify({
      message: result.limited
        ? '🚫 Rate limit exceeded'
        : '✅ Within rate limit',
      ip: result.ip,
      remaining: Math.max(RATE_LIMIT_MAX - result.count, 0),
      timestamp: new Date(result.timestamp).toISOString()
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...getRateLimitHeaders(result.count)
      }
    }
  )
}
