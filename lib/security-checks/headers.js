const HEADER_DEFINITIONS = [
  {
    header: 'strict-transport-security',
    label: 'HSTS',
    weight: 15,
    severity: 'HIGH',
    rationale: 'Forces HTTPS for all connections. Without it, attackers can downgrade sessions to plain HTTP.',
    recommended: 'max-age=31536000; includeSubDomains; preload',
    attacks: 'SSL stripping, MITM downgrade attack, traffic interception, cookie theft over HTTP',
  },
  {
    header: 'content-security-policy',
    label: 'CSP',
    weight: 20,
    severity: 'HIGH',
    rationale: 'Allowlist of trusted script/resource origins. Primary browser-level defense against XSS.',
    recommended: "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'",
    attacks: 'Cross-Site Scripting (XSS), data injection, malicious script execution, exfiltration',
  },
  {
    header: 'x-frame-options',
    label: 'X-Frame-Options',
    weight: 10,
    severity: 'MEDIUM',
    rationale: 'Prevents site from being embedded in iframes by other origins. Superseded by CSP frame-ancestors but still widely needed.',
    recommended: 'DENY',
    attacks: 'Clickjacking, UI redressing, invisible overlay attacks',
  },
  {
    header: 'x-content-type-options',
    label: 'X-Content-Type-Options',
    weight: 10,
    severity: 'MEDIUM',
    rationale: 'Disables MIME type sniffing. Prevents browsers from reinterpreting response content type.',
    recommended: 'nosniff',
    attacks: 'MIME confusion attacks, polyglot file execution, drive-by downloads',
  },
  {
    header: 'referrer-policy',
    label: 'Referrer-Policy',
    weight: 10,
    severity: 'LOW',
    rationale: 'Controls how much of the URL is sent as Referer header on cross-origin requests.',
    recommended: 'strict-origin-when-cross-origin',
    attacks: 'Token/credential leakage via Referer header, session info exposure to third parties',
  },
  {
    header: 'permissions-policy',
    label: 'Permissions-Policy',
    weight: 15,
    severity: 'MEDIUM',
    rationale: 'Restricts browser feature APIs (camera, microphone, geolocation, payment) per origin.',
    recommended: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    attacks: 'Unauthorized browser feature access by embedded third-party scripts, sensor/API abuse',
  },
]

export async function runHeadersCheck(siteUrl) {
  const t0 = Date.now()
  const res = await fetch(siteUrl, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  })
  const responseMs = Date.now() - t0

  const findings = []
  let score = 100

  for (const { header, label, weight, severity, rationale, recommended, attacks } of HEADER_DEFINITIONS) {
    const value = res.headers.get(header)
    if (!value) {
      score -= weight
      findings.push({
        label,
        status: 'missing',
        severity,
        value: null,
        recommended,
        rationale,
        attacks,
        scoreImpact: `-${weight}pts`,
      })
    } else {
      findings.push({
        label,
        status: 'present',
        severity: null,
        value: value.slice(0, 200),
        rationale,
        recommended,
      })
    }
  }

  const missing = findings.filter(f => f.status === 'missing').length

  const probeDetails = {
    method: 'GET',
    url: siteUrl,
    redirect: 'follow',
    finalStatus: res.status,
    finalUrl: res.url || siteUrl,
    responseTimeMs: responseMs,
    headersChecked: HEADER_DEFINITIONS.length,
    headersPresent: HEADER_DEFINITIONS.length - missing,
    headersMissing: missing,
    serverHeader: res.headers.get('server') || '(not exposed)',
    poweredByHeader: res.headers.get('x-powered-by') || '(not exposed)',
    timeout: '10000ms',
  }

  return {
    id: 'security_headers',
    name: 'Security Headers',
    source: 'Direct fetch · ' + siteUrl,
    status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
    score: Math.max(0, score),
    findings,
    probeDetails,
    summary: missing === 0
      ? `All ${HEADER_DEFINITIONS.length} headers present — HTTP ${res.status} in ${responseMs}ms`
      : `${missing} missing header${missing > 1 ? 's' : ''} (${HEADER_DEFINITIONS.length - missing}/${HEADER_DEFINITIONS.length} present) — HTTP ${res.status} in ${responseMs}ms`,
  }
}
