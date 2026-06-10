// Host header injection / web cache poisoning probe.
//
// Sends requests with forged Host-override headers and checks whether the
// attacker-controlled hostname is reflected back in the response body, Location
// header, or Set-Cookie domain.  If reflected, an attacker can poison a shared
// CDN/proxy cache so that legitimate users receive a response with attacker
// content (e.g. a redirect to a phishing domain or JS payload).
//
// Also tests X-Forwarded-Proto: http to detect HTTPS downgrade via header.

const EVIL_HOST = 'evil-attacker.example.com'

const INJECT_HEADERS = [
  'X-Forwarded-Host',
  'X-Host',
  'X-Forwarded-Server',
  'X-HTTP-Host-Override',
  'Forwarded',           // Forwarded: host=evil-attacker.example.com
]

const PROBE_PATHS = ['/', '/api/status', '/api/token-value']

function buildForwardedValue(host) {
  return `host=${host}`
}

export async function runHostInjectionCheck(siteUrl) {
  const findings = []

  // 1. Host-override header reflection
  const allProbes = INJECT_HEADERS.flatMap(header =>
    PROBE_PATHS.map(path => ({ header, path }))
  )

  const results = await Promise.allSettled(
    allProbes.map(async ({ header, path }) => {
      const value = header === 'Forwarded' ? buildForwardedValue(EVIL_HOST) : EVIL_HOST
      const res = await fetch(`${siteUrl}${path}`, {
        headers: {
          [header]: value,
          Accept: 'text/html,application/json',
          'User-Agent': 'MathsMine3-SecurityScanner/1.0',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      })
      const body     = (await res.text().catch(() => '')).slice(0, 500)
      const location = res.headers.get('location') || ''
      const cookie   = (res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? '']).join('; ')
      const reflected = [body, location, cookie].some(s => s.includes(EVIL_HOST))
      return { header, path, status: res.status, reflected, location, bodyPreview: body.slice(0, 150) }
    })
  )

  let reflected = false
  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value.reflected) continue
    reflected = true
    const v = r.value
    findings.push({
      label:    `Host injection reflected: ${v.header} on ${v.path}`,
      status:   'fail',
      severity: 'HIGH',
      detail:   `${v.header}: ${EVIL_HOST} reflected in HTTP ${v.status} response`,
      rationale: `The server echoes the ${v.header} header value into its response. An attacker can inject this header via a cached proxy request, poisoning the CDN cache so all subsequent requests to ${v.path} receive attacker-controlled content.`,
      attacks:  'Web cache poisoning — all users hitting the cached URL receive attacker HTML/JS; also exploitable for password-reset link hijacking (if link is built from Host header)',
      header:   v.header,
      path:     v.path,
      location: v.location,
      bodyPreview: v.bodyPreview,
    })
  }

  if (!reflected) {
    findings.push({
      label:    `Host injection headers not reflected (${INJECT_HEADERS.length} headers × ${PROBE_PATHS.length} paths)`,
      status:   'pass',
      severity: null,
      detail:   `None of ${INJECT_HEADERS.join(', ')} were reflected in body, Location, or Set-Cookie`,
    })
  }

  // 2. X-Forwarded-Proto: http → HTTPS downgrade probe
  try {
    const res = await fetch(`${siteUrl}/`, {
      headers: { 'X-Forwarded-Proto': 'http', Accept: 'text/html', 'User-Agent': 'MathsMine3-SecurityScanner/1.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    })
    const body     = (await res.text().catch(() => '')).slice(0, 400)
    const location = res.headers.get('location') || ''

    const downgrades = location.startsWith('http://') || body.includes('http://mathsmine3.xyz')
    if (downgrades) {
      findings.push({
        label:    'X-Forwarded-Proto: http causes HTTP-scheme response',
        status:   'fail',
        severity: 'MEDIUM',
        detail:   `Location: ${location.slice(0, 80) || '(see body preview)'} — server downgrades to http://`,
        rationale: 'If the app builds redirect or link URLs from X-Forwarded-Proto, an attacker can force HTTP scheme in cached responses, breaking HSTS and enabling SSL-strip-style attacks without MITM.',
        attacks:  'HTTPS downgrade via cache-poisoned redirect, bypasses HSTS in cached responses',
      })
    } else {
      findings.push({ label: 'X-Forwarded-Proto: http — no HTTPS downgrade observed', status: 'pass', severity: null, detail: `HTTP ${res.status} — response does not downgrade to http:// scheme` })
    }
  } catch {}

  // 3. Cache-Control on responses with injected headers
  try {
    const res = await fetch(`${siteUrl}/`, {
      headers: { 'X-Forwarded-Host': EVIL_HOST, 'User-Agent': 'MathsMine3-SecurityScanner/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    const cc   = res.headers.get('cache-control') || ''
    const vary = res.headers.get('vary') || ''

    const hostVaried = /host/i.test(vary) || /x-forwarded-host/i.test(vary)
    const isCacheable = !/(no-store|no-cache|private)/i.test(cc)

    if (isCacheable && !hostVaried) {
      findings.push({
        label:    'Response cacheable without Vary: X-Forwarded-Host',
        status:   'warn',
        severity: 'MEDIUM',
        detail:   `Cache-Control: ${cc || 'none'} · Vary: ${vary || 'none'} — if reflected, poisoned response would be cached`,
        rationale: 'A cacheable response that does not Vary on X-Forwarded-Host means a poisoned variant could be served to all users from the CDN cache.',
        attacks:  'Cache deception amplification — single poisoned request serves malicious content to unlimited subsequent users',
      })
    }
  } catch {}

  const failed = findings.filter(f => f.status === 'fail').length
  const warns  = findings.filter(f => f.status === 'warn').length
  const score  = Math.max(0, 100 - failed * 25 - warns * 8)

  return {
    id:     'host_injection',
    name:   'Host Header Injection',
    source: `${INJECT_HEADERS.length} headers × ${PROBE_PATHS.length} paths · X-Forwarded-Proto · Cache-Control`,
    status: failed > 0 ? 'fail' : warns > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      injectedHeaders: INJECT_HEADERS,
      injectedValue:   EVIL_HOST,
      pathsTested:     PROBE_PATHS,
      detectMethod:    'Check response body, Location header, and Set-Cookie domain for reflected evil hostname',
      additionalTests: ['X-Forwarded-Proto: http → HTTPS downgrade', 'Cache-Control without Vary on host headers'],
      background:      'Web cache poisoning (James Kettle, PortSwigger 2018) — if host headers are reflected into cached responses, a single attacker request poisons the CDN for all users of that URL.',
    },
    summary: failed === 0 && warns === 0
      ? `No host header injection detected — ${INJECT_HEADERS.length} headers × ${PROBE_PATHS.length} paths`
      : `${failed} injection vector${failed !== 1 ? 's' : ''} (${warns} cache warnings) — web cache poisoning risk`,
  }
}
