const ENDPOINTS = [
  { method: 'GET',  path: '/api/bot/tick',            expect: [401],            label: 'Bot tick sin auth' },
  { method: 'POST', path: '/api/daily-tasks/claim',   expect: [400, 401, 403],  label: 'Daily claim sin auth' },
  { method: 'POST', path: '/api/relay/exec',          expect: [400, 401, 403],  label: 'Relay exec sin auth' },
  { method: 'POST', path: '/api/create-account',      expect: [400, 401, 403],  label: 'Create account sin body' },
  { method: 'GET',  path: '/api/status',              expect: [200],            label: 'Status público accesible' },
]

export async function runApiAuthCheck(siteUrl) {
  const findings = []

  for (const ep of ENDPOINTS) {
    let status
    try {
      const res = await fetch(`${siteUrl}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: ep.method !== 'GET' ? '{}' : undefined,
        signal: AbortSignal.timeout(8000),
      })
      status = res.status
    } catch {
      status = 0
    }

    const pass = ep.expect.includes(status)
    findings.push({
      label:    ep.label,
      endpoint: `${ep.method} ${ep.path}`,
      expected: ep.expect,
      actual:   status,
      status:   pass ? 'pass' : 'fail',
      severity: pass ? null : 'HIGH',
    })
  }

  const failed = findings.filter(f => f.status === 'fail').length
  const score  = Math.round(((findings.length - failed) / findings.length) * 100)

  return {
    id: 'api_auth',
    name: 'API Authentication',
    source: 'Direct API calls (unauthenticated)',
    status: failed === 0 ? 'pass' : failed >= findings.length / 2 ? 'fail' : 'warn',
    score,
    findings,
    summary: failed === 0
      ? 'All tested endpoints respond correctly'
      : `${failed} endpoint${failed > 1 ? 's' : ''} may be unprotected`,
  }
}
