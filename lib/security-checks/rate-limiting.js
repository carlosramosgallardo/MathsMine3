const BURST = 6

const TARGETS = [
  {
    path: '/api/daily-tasks/claim',
    method: 'POST',
    body: '{}',
    label: 'Daily tasks claim',
    rationale: 'High-value reward endpoint — automated burst should trigger 429 to prevent economy abuse.',
    attacks: 'Automated reward farming, burst-request bypass of task completion logic',
  },
  {
    path: '/api/chain-solve/attempt',
    method: 'POST',
    body: '{}',
    label: 'Chain solve attempt',
    rationale: 'Puzzle solver — without throttling, bots can enumerate answer candidates at machine speed.',
    attacks: 'Automated answer brute-force, game-winner manipulation via rapid submissions',
  },
  {
    path: '/api/relay/exec',
    method: 'POST',
    body: '{}',
    label: 'Relay exec',
    rationale: 'Economic action with 24h cooldown — should throttle parallel attempts to prevent race-based cooldown bypass.',
    attacks: 'Cooldown bypass via parallel submissions, relay economy spam',
  },
  {
    path: '/api/mine-block',
    method: 'POST',
    body: '{}',
    label: 'Mine block',
    rationale: 'Block-chain mining action — rate limiting prevents block-squatting bots from monopolizing the chain.',
    attacks: 'Mass-mining automation, single-actor chain monopolization',
  },
]

async function burstFetch(url, method, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(10000),
  }
  return Promise.all(
    Array.from({ length: BURST }, () =>
      fetch(url, opts)
        .then(r => ({
          status:             r.status,
          rateLimitLimit:     r.headers.get('x-ratelimit-limit')     || r.headers.get('ratelimit-limit'),
          rateLimitRemaining: r.headers.get('x-ratelimit-remaining') || r.headers.get('ratelimit-remaining'),
          rateLimitReset:     r.headers.get('x-ratelimit-reset')     || r.headers.get('ratelimit-reset'),
          retryAfter:         r.headers.get('retry-after'),
        }))
        .catch(() => ({ status: 0 }))
    )
  )
}

export async function runRateLimitingCheck(siteUrl) {
  const allResults = await Promise.all(TARGETS.map(t => burstFetch(`${siteUrl}${t.path}`, t.method, t.body)))

  const findings = TARGETS.map((target, idx) => {
    const responses    = allResults[idx]
    const statuses     = responses.map(r => r.status)
    const hasThrottle  = statuses.some(s => s === 429 || s === 503)
    const first        = responses.find(r => r.status > 0) ?? {}
    const hasRlHeaders = !!(first.rateLimitLimit || first.rateLimitRemaining)
    const limited      = hasThrottle || hasRlHeaders
    const retryAfter   = responses.find(r => r.retryAfter)?.retryAfter ?? null

    return {
      label:              target.label,
      endpoint:           `${target.method} ${target.path}`,
      status:             limited ? 'pass' : 'warn',
      severity:           limited ? null : 'MEDIUM',
      requestsSent:       BURST,
      statusCodes:        [...new Set(statuses)].join(', '),
      throttleDetected:   hasThrottle,
      rateLimitHeaders:   hasRlHeaders,
      rateLimitLimit:     first.rateLimitLimit     ?? '(not set)',
      rateLimitRemaining: first.rateLimitRemaining ?? '(not set)',
      retryAfter,
      rationale:          target.rationale,
      attacks:            limited ? null : target.attacks,
      summary: hasThrottle
        ? `429/503 received after burst — rate limiting active`
        : hasRlHeaders
          ? `X-RateLimit-* headers present — throttle limits advertised`
          : `${BURST} parallel requests completed without 429 — no rate limiting detected`,
    }
  })

  const notLimited = findings.filter(f => f.status === 'warn').length
  const score      = Math.max(0, 100 - notLimited * 22)

  return {
    id:     'rate_limiting',
    name:   'Rate Limiting',
    source: `Burst probe · ${BURST} req × ${TARGETS.length} endpoints`,
    status: notLimited === 0 ? 'pass' : 'warn',
    score,
    findings,
    probeDetails: {
      strategy:        `Send ${BURST} concurrent requests per endpoint — detect HTTP 429/503 or X-RateLimit-* response headers`,
      burstSize:       BURST,
      endpointsTested: TARGETS.length,
      totalRequests:   BURST * TARGETS.length,
      requestBody:     'Empty {} — returns 400 immediately, no DB side-effects, minimal server load',
      detectMethods:   ['HTTP 429 Too Many Requests', 'HTTP 503 Service Unavailable', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
      note:            'Vercel provides platform-level DDoS protection. Per-route rate limiting provides defence-in-depth for game economy endpoints with real monetary value.',
      timeout:         '10000ms',
    },
    summary: notLimited === 0
      ? `Rate limiting detected on all ${TARGETS.length} tested endpoints`
      : `${notLimited}/${TARGETS.length} endpoint${notLimited !== 1 ? 's' : ''} lack detectable rate limiting (${BURST}-request burst — no 429/503 or X-RateLimit-* headers)`,
  }
}
