const CHECKS = [
  { header: 'strict-transport-security', label: 'HSTS',               weight: 15, severity: 'HIGH'   },
  { header: 'content-security-policy',   label: 'CSP',                weight: 20, severity: 'HIGH'   },
  { header: 'x-frame-options',           label: 'X-Frame-Options',    weight: 10, severity: 'MEDIUM' },
  { header: 'x-content-type-options',    label: 'X-Content-Type-Options', weight: 10, severity: 'MEDIUM' },
  { header: 'referrer-policy',           label: 'Referrer-Policy',    weight: 10, severity: 'LOW'    },
  { header: 'permissions-policy',        label: 'Permissions-Policy', weight: 15, severity: 'MEDIUM' },
]

export async function runHeadersCheck(siteUrl) {
  const res = await fetch(siteUrl, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  })

  const findings = []
  let score = 100

  for (const { header, label, weight, severity } of CHECKS) {
    const value = res.headers.get(header)
    if (!value) {
      score -= weight
      findings.push({ label, status: 'missing', severity, value: null })
    } else {
      findings.push({ label, status: 'present', severity: null, value: value.slice(0, 100) })
    }
  }

  const missing = findings.filter(f => f.status === 'missing').length

  return {
    id: 'security_headers',
    name: 'Security Headers',
    source: 'Direct fetch · ' + siteUrl,
    status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
    score: Math.max(0, score),
    findings,
    summary: missing === 0
      ? 'All headers present'
      : `${missing} missing header${missing > 1 ? 's' : ''} (${CHECKS.length - missing}/${CHECKS.length} present)`,
  }
}
