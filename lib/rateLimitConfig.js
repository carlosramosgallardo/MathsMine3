export const RATE_LIMIT_MAX = 10
export const RATE_LIMIT_WINDOW_SECONDS = 60
export const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_SECONDS * 1000

export function getRateLimitHeaders(countUsed) {
  return {
    'X-RateLimit-Limit': RATE_LIMIT_MAX,
    'X-RateLimit-Remaining': Math.max(RATE_LIMIT_MAX - countUsed, 0),
    'X-RateLimit-Reset': RATE_LIMIT_WINDOW_SECONDS
  }
}
