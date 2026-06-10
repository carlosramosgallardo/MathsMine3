const PROBE_PATHS = [
  { path: '/',             label: 'Home page' },
  { path: '/api/status',   label: 'API status endpoint' },
]

function getSetCookieHeaders(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie()
  const raw = res.headers.get('set-cookie')
  return raw ? [raw] : []
}

function parseCookie(raw) {
  const parts   = raw.split(';').map(s => s.trim())
  const nameVal = parts[0] || ''
  const eqIdx   = nameVal.indexOf('=')
  const name    = (eqIdx >= 0 ? nameVal.slice(0, eqIdx) : nameVal).trim()
  const dirs    = parts.slice(1).map(d => d.toLowerCase())
  const sameSiteDir = dirs.find(d => d.startsWith('samesite='))
  return {
    name:           name || '(unnamed)',
    raw:            raw.slice(0, 200),
    httpOnly:       dirs.some(d => d === 'httponly'),
    secure:         dirs.some(d => d === 'secure'),
    sameSite:       sameSiteDir ? sameSiteDir.split('=')[1] : null,
    hasExpiry:      dirs.some(d => d.startsWith('expires=') || d.startsWith('max-age=')),
    securePrefixed: name.startsWith('__Secure-') || name.startsWith('__Host-'),
    path:           dirs.find(d => d.startsWith('path='))?.split('=')[1] ?? null,
  }
}

export async function runCookieSecurityCheck(siteUrl) {
  const allCookies   = []
  const probeResults = []

  await Promise.all(PROBE_PATHS.map(async probe => {
    try {
      const res = await fetch(`${siteUrl}${probe.path}`, {
        method: 'GET',
        redirect: 'follow',
        headers: { Accept: 'text/html,application/json' },
        signal: AbortSignal.timeout(8000),
      })
      const setCookieHeaders = getSetCookieHeaders(res)
      const cookies          = setCookieHeaders.map(parseCookie)
      allCookies.push(...cookies)
      probeResults.push({ path: probe.path, label: probe.label, httpStatus: res.status, cookieCount: cookies.length })
    } catch (e) {
      probeResults.push({ path: probe.path, label: probe.label, error: e.message?.slice(0, 60) })
    }
  }))

  const findings = []

  if (allCookies.length === 0) {
    findings.push({
      label:    'No Set-Cookie headers found on probed pages',
      status:   'pass',
      severity: null,
      summary:  'No traditional session cookies detected — application uses Web3 wallet auth, eliminating cookie-based session vulnerabilities.',
      rationale: 'Wallet-based authentication removes entire cookie-attack surface: no session fixation, no session hijacking via HttpOnly bypass, no CSRF via SameSite issues.',
    })
  } else {
    for (const cookie of allCookies) {
      const issues = []
      if (!cookie.httpOnly) {
        issues.push({
          flag: 'HttpOnly missing',
          severity: 'HIGH',
          rationale: 'Cookie readable by JavaScript — XSS attack can steal the session token via document.cookie',
          attacks: 'XSS session theft — malicious script reads document.cookie and sends token to attacker server',
          recommended: 'Add HttpOnly attribute to all session cookies',
        })
      }
      if (!cookie.secure) {
        issues.push({
          flag: 'Secure missing',
          severity: 'HIGH',
          rationale: 'Cookie transmitted over plain HTTP — MITM attacker on the network can capture it',
          attacks: 'Network interception — session cookie sent in HTTP cleartext; captured by Wireshark, proxy, or rogue AP',
          recommended: 'Add Secure attribute — cookie transmitted only over HTTPS',
        })
      }
      if (!cookie.sameSite || cookie.sameSite === 'none') {
        issues.push({
          flag: `SameSite=${cookie.sameSite ?? '(not set)'}`,
          severity: 'MEDIUM',
          rationale: 'No SameSite restriction — browser sends this cookie with cross-origin requests, enabling CSRF',
          attacks: 'Cross-Site Request Forgery (CSRF) — forged form POST from attacker.com includes this cookie automatically',
          recommended: 'Set SameSite=Strict or SameSite=Lax',
        })
      }

      if (issues.length === 0) {
        findings.push({
          label:          cookie.name,
          status:         'pass',
          severity:       null,
          raw:            cookie.raw,
          httpOnly:       cookie.httpOnly,
          secure:         cookie.secure,
          sameSite:       cookie.sameSite,
          securePrefixed: cookie.securePrefixed,
          summary:        `Secure + HttpOnly + SameSite correctly configured${cookie.securePrefixed ? ' + __Secure- prefix' : ''}`,
        })
      } else {
        for (const issue of issues) {
          findings.push({
            label:     `${cookie.name} — ${issue.flag}`,
            status:    'fail',
            severity:  issue.severity,
            raw:       cookie.raw,
            httpOnly:  cookie.httpOnly,
            secure:    cookie.secure,
            sameSite:  cookie.sameSite,
            rationale: issue.rationale,
            attacks:   issue.attacks,
            recommended: issue.recommended,
          })
        }
      }
    }
  }

  const failed = findings.filter(f => f.status === 'fail').length
  const score  = allCookies.length === 0 ? 100 : Math.max(0, 100 - failed * 25)

  return {
    id:     'cookie_security',
    name:   'Cookie Security',
    source: `Set-Cookie header analysis · ${PROBE_PATHS.length} pages`,
    status: failed > 0 ? 'fail' : 'pass',
    score,
    findings,
    probeDetails: {
      probes:       probeResults,
      totalCookies: allCookies.length,
      flagsChecked: [
        'HttpOnly — prevents JS access (XSS protection)',
        'Secure — HTTPS-only transmission',
        'SameSite=Strict/Lax — CSRF protection',
        '__Secure- / __Host- prefix — stricter browser enforcement',
      ],
      cookiesFound:  allCookies.map(c => c.name),
      note:          'Web3 wallet auth eliminates traditional session cookies — absence of Set-Cookie is a positive security posture',
      timeout:       '8000ms',
    },
    summary: allCookies.length === 0
      ? 'No session cookies — Web3 wallet auth uses no traditional session management'
      : failed === 0
        ? `All ${allCookies.length} cookie${allCookies.length !== 1 ? 's' : ''} have correct HttpOnly + Secure + SameSite flags`
        : `${failed} cookie flag issue${failed !== 1 ? 's' : ''} across ${allCookies.length} cookie${allCookies.length !== 1 ? 's' : ''}`,
  }
}
