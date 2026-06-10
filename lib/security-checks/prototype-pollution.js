// Prototype pollution probe.
//
// JavaScript prototype pollution occurs when attacker-controlled keys like
// "__proto__", "constructor", or "prototype" are merged into a plain object,
// causing properties to propagate to Object.prototype and affect all objects
// in the process.  This can lead to authentication bypass (admin=true on all
// objects), DoS (property shadowing crashes code), or RCE in deserializer chains.
//
// Two attack surfaces tested:
//   1. Query string:  ?__proto__[admin]=true  (affects qs-based parsers)
//   2. JSON body:     {"__proto__":{"admin":true}}  (affects JSON.parse + merge)

const BASE_PATH     = '/api/leaderboard'
const POST_PATH     = '/api/chain-solve/attempt'

const QS_PAYLOADS = [
  '__proto__[admin]=true',
  '__proto__[isAdmin]=1',
  'constructor[prototype][admin]=true',
  'a[__proto__][admin]=true',
  '__proto__[toString]=polluted',
]

const JSON_PAYLOADS = [
  { '__proto__': { admin: true, isAdmin: 1 } },
  { constructor: { prototype: { admin: true } } },
  { '__proto__': { toString: 'polluted', valueOf: 'polluted' } },
]

async function getBaseline(url, opts = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000), ...opts })
    const body = await res.text().catch(() => '')
    return { status: res.status, body: body.slice(0, 300) }
  } catch { return { status: 0, body: '' } }
}

export async function runPrototypePollutionCheck(siteUrl) {
  const findings = []

  // Baseline: clean GET /api/leaderboard
  const baseGet = await getBaseline(`${siteUrl}${BASE_PATH}`)

  // 1. Query string pollution (GET)
  const qsResults = await Promise.allSettled(
    QS_PAYLOADS.map(async qs => {
      const url = `${siteUrl}${BASE_PATH}?${qs}`
      const res = await fetch(url, { signal: AbortSignal.timeout(7000) })
      const body = (await res.text().catch(() => '')).slice(0, 300)
      return { qs, status: res.status, body, statusDiff: res.status !== baseGet.status, bodyDiff: body !== baseGet.body }
    })
  )

  for (const r of qsResults) {
    if (r.status !== 'fulfilled') continue
    const v = r.value
    if (v.statusDiff || v.bodyDiff) {
      findings.push({
        label:    `Query string prototype pollution: ?${v.qs.slice(0, 60)}`,
        status:   'fail',
        severity: 'HIGH',
        detail:   `Behavior changed — status ${baseGet.status} → ${v.status}, body differs: ${v.bodyDiff}`,
        rationale: 'A behavioral change caused by a __proto__ or constructor query param indicates the server processes prototype-polluting keys — likely passed through a vulnerable qs/querystring parser.',
        attacks:  'Authentication bypass (admin=true injected onto Object.prototype), privilege escalation, DoS via property shadowing, potential RCE in deserializer chains (Lodash merge, deep-assign)',
        payload: `?${v.qs}`,
        baseStatus: baseGet.status,
        pollutedStatus: v.status,
      })
    }
  }

  // Baseline: clean POST /api/chain-solve/attempt with minimal valid-shape body
  const basePost = await getBaseline(`${siteUrl}${POST_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })

  // 2. JSON body pollution (POST)
  const jsonResults = await Promise.allSettled(
    JSON_PAYLOADS.map(async payload => {
      const res = await fetch(`${siteUrl}${POST_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(7000),
      })
      const body = (await res.text().catch(() => '')).slice(0, 300)
      return {
        payload: JSON.stringify(payload).slice(0, 80),
        status: res.status,
        body,
        statusDiff: res.status !== basePost.status,
        bodyDiff: body !== basePost.body,
      }
    })
  )

  for (const r of jsonResults) {
    if (r.status !== 'fulfilled') continue
    const v = r.value
    if (v.statusDiff || v.bodyDiff) {
      findings.push({
        label:    `JSON body prototype pollution: ${v.payload}`,
        status:   'fail',
        severity: 'HIGH',
        detail:   `Behavior changed — status ${basePost.status} → ${v.status}, body differs: ${v.bodyDiff}`,
        rationale: 'Server processes __proto__ or constructor keys from a JSON body — vulnerable to prototype chain manipulation via deep merge or Object.assign patterns.',
        attacks:  'Property injection into global Object.prototype — authentication bypass, config override, NoSQL operator injection via property name collision',
        payload: v.payload,
      })
    }
  }

  if (findings.filter(f => f.status === 'fail').length === 0) {
    findings.push({
      label:    `No prototype pollution behavior change detected`,
      status:   'pass',
      severity: null,
      detail:   `${QS_PAYLOADS.length} query string payloads + ${JSON_PAYLOADS.length} JSON body payloads — all responses identical to baseline`,
    })
  }

  const failed = findings.filter(f => f.status === 'fail').length
  const warns  = findings.filter(f => f.status === 'warn').length
  const score  = Math.max(0, 100 - failed * 30 - warns * 10)

  return {
    id:     'prototype_pollution',
    name:   'Prototype Pollution',
    source: `Query string × ${QS_PAYLOADS.length} payloads · JSON body × ${JSON_PAYLOADS.length} payloads`,
    status: failed > 0 ? 'fail' : warns > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      queryStringPayloads: QS_PAYLOADS.map(q => `?${q}`),
      jsonBodyPayloads:    JSON_PAYLOADS.map(p => JSON.stringify(p)),
      baselineEndpoints:   [BASE_PATH, POST_PATH],
      detectMethod:        'Compare HTTP status code and response body between clean baseline and prototype-polluted request — any behavioral delta indicates server-side processing of polluting keys',
      passCondition:       'Response identical to baseline — polluting keys stripped, ignored, or rejected',
      failCondition:       'Status or body differs from baseline — server processes __proto__/constructor keys',
      background:          'Prototype pollution CVEs include lodash (CVE-2019-10744), jQuery (CVE-2019-11358), qs (CVE-2017-7529). Node.js apps using qs, querystring, or deep-merge libraries are commonly affected.',
    },
    summary: failed === 0 && warns === 0
      ? `No prototype pollution vectors detected — ${QS_PAYLOADS.length + JSON_PAYLOADS.length} payloads tested`
      : `${failed} prototype pollution vector${failed !== 1 ? 's' : ''} — server processes __proto__ / constructor keys`,
  }
}
