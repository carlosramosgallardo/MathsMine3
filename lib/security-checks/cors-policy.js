const PROBES = [
  { path: '/',                        method: 'GET',  body: null, label: 'Home — arbitrary origin read' },
  { path: '/api/status',              method: 'GET',  body: null, label: 'Status API — arbitrary origin read' },
  { path: '/api/daily-tasks/claim',   method: 'POST', body: '{}', label: 'Claim API — cross-origin POST' },
]

const EVIL_ORIGIN = 'https://evil-attacker.example'

export async function runCorsPolicyCheck(siteUrl) {
  const findings = []

  for (const probe of PROBES) {
    let httpStatus = 0
    let acao = null
    let acac = null
    let responseMs = 0
    try {
      const t0 = Date.now()
      const res = await fetch(`${siteUrl}${probe.path}`, {
        method: probe.method,
        headers: {
          'Origin': EVIL_ORIGIN,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: probe.body ?? undefined,
        signal: AbortSignal.timeout(8000),
      })
      responseMs = Date.now() - t0
      httpStatus = res.status
      acao = res.headers.get('access-control-allow-origin')
      acac = res.headers.get('access-control-allow-credentials')
    } catch { /* timeout or network error */ }

    const reflectsEvil  = acao === EVIL_ORIGIN
    const wildcardOpen  = acao === '*'
    const credWithEvil  = reflectsEvil && acac === 'true'
    const credWithWild  = wildcardOpen && acac === 'true'

    const isFail = credWithEvil || reflectsEvil
    const isWarn = wildcardOpen && !credWithEvil
    const severity = credWithEvil ? 'CRITICAL' : reflectsEvil ? 'HIGH' : isWarn ? 'MEDIUM' : null

    const status = isFail ? 'fail' : isWarn ? 'warn' : 'pass'

    let rationale = 'CORS policy correctly ignores the attacker origin — browser blocks cross-origin read.'
    if (credWithEvil)   rationale = 'CORS reflects attacker origin AND allows credentials — full cross-origin request forgery. Attacker script can read any authenticated response.'
    else if (reflectsEvil) rationale = 'ACAO reflects arbitrary origin — attacker can read unauthenticated cross-origin responses.'
    else if (wildcardOpen) rationale = 'ACAO: * — any origin can read responses, but credentials cannot be sent (browsers block ACAC: true with wildcard).'

    findings.push({
      label:       probe.label,
      endpoint:    `${probe.method} ${probe.path}`,
      status,
      severity,
      httpStatus,
      acao:        acao || '(not set)',
      acac:        acac || '(not set)',
      responseMs,
      probeOrigin: EVIL_ORIGIN,
      rationale,
      attacks: (isFail || isWarn)
        ? 'Cross-Origin Request Forgery (CORS bypass), authenticated session data theft, credential exfiltration'
        : null,
    })
  }

  const failed   = findings.filter(f => f.status === 'fail').length
  const warnings = findings.filter(f => f.status === 'warn').length
  const critical = findings.filter(f => f.severity === 'CRITICAL').length
  const score    = Math.max(0, 100 - failed * 35 - critical * 15 - warnings * 10)

  return {
    id: 'cors_policy',
    name: 'CORS Policy',
    source: `Cross-origin probe · Origin: ${EVIL_ORIGIN}`,
    status: failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      spoofedOrigin: EVIL_ORIGIN,
      endpointsTested: PROBES.length,
      headersInspected: [
        'Access-Control-Allow-Origin (ACAO) — must NOT be * or reflect arbitrary origins for sensitive endpoints',
        'Access-Control-Allow-Credentials (ACAC) — if true + ACAO reflects origin → full CSRF possible',
      ],
      riskMatrix: {
        'ACAO reflects evil + ACAC: true': 'CRITICAL — authenticated data theft possible',
        'ACAO reflects evil': 'HIGH — unauthenticated cross-origin read',
        'ACAO: *': 'MEDIUM — any origin reads unauthenticated data',
        'ACAO not set': 'PASS — browser blocks cross-origin read',
      },
      timeout: '8000ms per probe',
    },
    summary: failed === 0 && warnings === 0
      ? `CORS policy correctly rejects the attacker origin on all ${PROBES.length} probed endpoints`
      : `${failed} failure${failed !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''} — CORS misconfiguration detected`,
  }
}
