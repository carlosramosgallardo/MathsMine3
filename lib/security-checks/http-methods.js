const OPTIONS_PROBES = [
  { path: '/',           label: 'Home — allowed methods' },
  { path: '/api/status', label: 'Status API — allowed methods' },
]

const DANGEROUS_METHODS = ['TRACE', 'TRACK', 'CONNECT', 'DELETE', 'PUT']

export async function runHttpMethodsCheck(siteUrl) {
  const findings = []

  // OPTIONS probes — inspect the Allow / Access-Control-Allow-Methods header
  for (const probe of OPTIONS_PROBES) {
    let httpStatus = 0
    let allow = null
    let responseMs = 0
    try {
      const t0 = Date.now()
      const res = await fetch(`${siteUrl}${probe.path}`, {
        method: 'OPTIONS',
        signal: AbortSignal.timeout(6000),
      })
      responseMs = Date.now() - t0
      httpStatus = res.status
      allow = res.headers.get('allow') || res.headers.get('access-control-allow-methods')
    } catch { /* timeout */ }

    const dangerousFound = allow
      ? DANGEROUS_METHODS.filter(m => allow.toUpperCase().includes(m))
      : []

    const isFail = dangerousFound.includes('TRACE') || dangerousFound.includes('TRACK')
    const isWarn = dangerousFound.length > 0 && !isFail

    findings.push({
      label:       probe.label,
      endpoint:    `OPTIONS ${probe.path}`,
      status:      isFail ? 'fail' : isWarn ? 'warn' : 'pass',
      severity:    isFail ? 'HIGH' : isWarn ? 'MEDIUM' : null,
      httpStatus,
      allowHeader: allow || '(not returned by server)',
      dangerousMethods: dangerousFound,
      responseMs,
      rationale: dangerousFound.length > 0
        ? `Dangerous methods advertised: ${dangerousFound.join(', ')}. TRACE enables XST (Cross-Site Tracing), which can bypass HttpOnly cookie protection.`
        : 'No dangerous methods detected in Allow / Access-Control-Allow-Methods header.',
      attacks: dangerousFound.length > 0
        ? 'Cross-Site Tracing (XST) — malicious script sends TRACE, server echoes full request including HttpOnly cookies'
        : null,
    })
  }

  // Direct TRACE request — definitive check regardless of OPTIONS output
  let traceStatus = 0
  let traceBody = null
  let traceMs = 0
  try {
    const t0 = Date.now()
    const res = await fetch(`${siteUrl}/`, {
      method: 'TRACE',
      headers: { 'X-Pentest-Probe': 'mathsmine3-security-scan' },
      signal: AbortSignal.timeout(6000),
    })
    traceMs = Date.now() - t0
    traceStatus = res.status
    try { traceBody = (await res.text()).slice(0, 120) } catch {}
  } catch { /* not supported or blocked */ }

  const traceEnabled = traceStatus === 200
  findings.push({
    label:           'TRACE method — direct probe',
    endpoint:        'TRACE /',
    status:          traceEnabled ? 'fail' : 'pass',
    severity:        traceEnabled ? 'HIGH' : null,
    httpStatus:      traceStatus,
    responseMs:      traceMs,
    responsePreview: traceBody,
    rationale: traceEnabled
      ? 'TRACE is active — server echoes the full request back. Any injected X-Custom-Header value including auth tokens is reflected.'
      : `TRACE correctly rejected (HTTP ${traceStatus || 'connection refused'}).`,
    attacks: traceEnabled
      ? 'Cross-Site Tracing (XST): attacker script sends TRACE via XHR/fetch, server reflects HttpOnly cookies in response body — bypasses HttpOnly protection completely'
      : null,
  })

  const failed   = findings.filter(f => f.status === 'fail').length
  const warnings = findings.filter(f => f.status === 'warn').length
  const score    = Math.max(0, 100 - failed * 35 - warnings * 10)

  return {
    id: 'http_methods',
    name: 'HTTP Method Security',
    source: `OPTIONS + TRACE probe · ${siteUrl}`,
    status: failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      requestsSent: OPTIONS_PROBES.length + 1,
      probes: [
        ...OPTIONS_PROBES.map(p => `OPTIONS ${siteUrl}${p.path} → inspect Allow header`),
        `TRACE ${siteUrl}/ → check if server echoes request (XST)`,
      ],
      dangerousFlagged: DANGEROUS_METHODS,
      xstExplained: 'Cross-Site Tracing (XST): browser sends TRACE via script, includes cookies in request, server reflects all headers including HttpOnly ones in the response body. Bypasses HttpOnly even on modern browsers if TRACE is enabled.',
      timeout: '6000ms per request',
    },
    summary: failed === 0 && warnings === 0
      ? 'No dangerous HTTP methods detected — TRACE correctly rejected'
      : `${failed} failure${failed !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''} — dangerous method configuration found`,
  }
}
