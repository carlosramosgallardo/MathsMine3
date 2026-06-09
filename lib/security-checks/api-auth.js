const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/bot/tick',
    expect: [401],
    label: 'Bot tick — GET without auth',
    rationale: 'Bot tick must require authorization. Unauthorized access lets anyone trigger bot actions and abuse the game economy.',
    body: null,
  },
  {
    method: 'POST',
    path: '/api/daily-tasks/claim',
    expect: [400, 401, 403],
    label: 'Daily tasks claim — POST empty body',
    rationale: 'Claim endpoint must validate wallet identity. An empty body should be rejected before reaching DB write.',
    body: '{}',
  },
  {
    method: 'POST',
    path: '/api/relay/exec',
    expect: [400, 401, 403],
    label: 'Relay exec — POST empty body',
    rationale: 'Relay execution is a privileged game action. Must reject unauthenticated or structurally invalid requests.',
    body: '{}',
  },
  {
    method: 'POST',
    path: '/api/create-account',
    expect: [400, 401, 403],
    label: 'Create account — POST empty body',
    rationale: 'Account creation with no body must fail at validation layer, not silently write partial DB records.',
    body: '{}',
  },
  {
    method: 'GET',
    path: '/api/status',
    expect: [200],
    label: 'Status endpoint — public read access',
    rationale: 'Public health check endpoint. Must return 200. Validates basic API routing is functional.',
    body: null,
  },
]

const REQUEST_HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json' }

export async function runApiAuthCheck(siteUrl) {
  const findings = []

  for (const ep of ENDPOINTS) {
    let status = 0
    let responseMs = 0
    let responsePreview = null
    try {
      const t0 = Date.now()
      const res = await fetch(`${siteUrl}${ep.path}`, {
        method: ep.method,
        headers: REQUEST_HEADERS,
        body: ep.body ?? undefined,
        signal: AbortSignal.timeout(8000),
      })
      responseMs = Date.now() - t0
      status = res.status
      try {
        const text = await res.text()
        responsePreview = text.slice(0, 100)
      } catch {}
    } catch (e) {
      responsePreview = e.message?.slice(0, 80)
    }

    const pass = ep.expect.includes(status)
    findings.push({
      label:           ep.label,
      endpoint:        `${ep.method} ${ep.path}`,
      expected:        ep.expect,
      actual:          status,
      status:          pass ? 'pass' : 'fail',
      severity:        pass ? null : 'HIGH',
      rationale:       ep.rationale,
      requestBody:     ep.body,
      responseMs,
      responsePreview,
    })
  }

  const failed = findings.filter(f => f.status === 'fail').length
  const score  = Math.round(((findings.length - failed) / findings.length) * 100)

  const probeDetails = {
    targetBase: siteUrl,
    endpointsTested: ENDPOINTS.length,
    strategy: 'Unauthenticated HTTP requests — no Authorization header, no session cookie, no API key',
    requestHeaders: REQUEST_HEADERS,
    endpoints: ENDPOINTS.map(ep => ({
      probe: `${ep.method} ${siteUrl}${ep.path}`,
      body: ep.body || '(none)',
      expect: ep.expect.join(' or '),
    })),
    timeout: '8000ms per endpoint',
  }

  return {
    id: 'api_auth',
    name: 'API Authentication',
    source: 'Direct API calls (unauthenticated)',
    status: failed === 0 ? 'pass' : failed >= findings.length / 2 ? 'fail' : 'warn',
    score,
    findings,
    probeDetails,
    summary: failed === 0
      ? `All ${findings.length} endpoints respond correctly to unauthenticated requests`
      : `${failed} endpoint${failed > 1 ? 's' : ''} may be unprotected or misconfigured`,
  }
}
