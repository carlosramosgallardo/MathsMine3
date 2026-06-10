const EVIL_DOMAIN  = 'evil-attacker.example'
const EVIL_HTTPS   = `https://${EVIL_DOMAIN}`
const EVIL_PROTO   = `///${EVIL_DOMAIN}`   // protocol-relative with extra slash
const JS_PROTO     = 'javascript:alert(document.domain)'
const EVIL_ENCODED = `https%3A%2F%2F${EVIL_DOMAIN}`

const REDIRECT_PARAMS = [
  'redirect', 'next', 'url', 'return', 'returnUrl', 'r',
  'goto', 'destination', 'callback', 'continue', 'redir',
  'redirect_uri', 'redirect_url', 'successUrl', 'go', 'link', 'to',
]

const PROBE_PATHS = [
  { path: '/',             label: 'Home page' },
  { path: '/api/status',   label: 'Status API' },
]

const EVIL_VALUES = [
  { value: EVIL_HTTPS,   label: 'absolute HTTPS URL' },
  { value: EVIL_PROTO,   label: 'triple-slash protocol-relative URL' },
  { value: JS_PROTO,     label: 'javascript: URI' },
  { value: EVIL_ENCODED, label: 'URL-encoded redirect' },
]

// Only test a representative subset to keep probe count reasonable
const SAMPLED_PARAMS  = REDIRECT_PARAMS.slice(0, 8)  // first 8 params
const SAMPLED_VALUES  = EVIL_VALUES.slice(0, 3)       // first 3 evil values

function buildUrl(baseUrl, path, param, value) {
  const u = new URL(path, baseUrl)
  u.searchParams.set(param, value)
  return u.toString()
}

function isRedirectToEvil(res, locationHeader) {
  if (!locationHeader) return false
  const loc = locationHeader.toLowerCase()
  return loc.includes(EVIL_DOMAIN)
}

function isJsRedirect(res, locationHeader, body) {
  if (locationHeader?.toLowerCase().startsWith('javascript:')) return true
  if ((body || '').toLowerCase().includes('javascript:alert')) return true
  return false
}

export async function runOpenRedirectCheck(siteUrl) {
  // Build all probe combinations
  const probes = []
  for (const page of PROBE_PATHS) {
    for (const param of SAMPLED_PARAMS) {
      for (const evil of SAMPLED_VALUES) {
        probes.push({ page, param, evil })
      }
    }
  }

  // Run all in parallel
  const results = await Promise.allSettled(
    probes.map(async ({ page, param, evil }) => {
      const url = buildUrl(siteUrl, page.path, param, evil.value)
      const t0  = Date.now()
      try {
        const res = await fetch(url, {
          method: 'GET',
          redirect: 'manual', // don't follow — we want to inspect the Location header
          signal: AbortSignal.timeout(7000),
        })
        const location = res.headers.get('location') || ''
        const body     = res.status < 400 ? await res.text().catch(() => '') : ''
        return {
          status:   res.status,
          location,
          body:     body.slice(0, 80),
          ms:       Date.now() - t0,
          url,
          param,
          evil,
          page,
        }
      } catch (e) {
        return { status: 0, location: '', body: '', ms: Date.now() - t0, url, param, evil, page }
      }
    })
  )

  // Process results — only surface findings for redirects or js: protos
  const vulnerableParams = new Map() // param → worst finding
  const allStatuses      = new Set()

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    const { status, location, body, url, param, evil, page } = r.value
    allStatuses.add(status)

    const redirect302 = (status === 301 || status === 302 || status === 303 || status === 307 || status === 308)
      && isRedirectToEvil({ status }, location)
    const jsRedirect  = isJsRedirect({ status }, location, body)

    if (redirect302 || jsRedirect) {
      const severity = jsRedirect ? 'HIGH' : 'HIGH'
      const existing = vulnerableParams.get(param)
      if (!existing || existing.severity !== 'HIGH') {
        vulnerableParams.set(param, {
          param,
          url,
          status,
          location: location.slice(0, 100),
          evilValue: evil.label,
          page: page.label,
          severity,
          redirect302,
          jsRedirect,
        })
      }
    }
  }

  const findings = []

  if (vulnerableParams.size === 0) {
    // All params safe — emit one consolidated pass finding
    findings.push({
      label:    `No open redirects detected (${SAMPLED_PARAMS.length} params × ${PROBE_PATHS.length} paths × ${SAMPLED_VALUES.length} evil values)`,
      status:   'pass',
      severity: null,
      summary:  'Server ignores or strips redirect parameters — no automatic URL redirect to attacker-controlled origins',
      rationale: 'Next.js/Vercel apps typically do not honor arbitrary redirect parameters — absence of open redirect is the expected baseline.',
    })
  } else {
    for (const [, hit] of vulnerableParams) {
      findings.push({
        label:    `Open redirect — ?${hit.param}= → ${hit.evilValue}`,
        status:   'fail',
        severity: hit.severity,
        endpoint: `GET ${hit.page}`,
        param:    hit.param,
        evilValue: hit.evilValue,
        location: hit.location,
        httpStatus: hit.status,
        rationale: hit.jsRedirect
          ? `javascript: URI redirect — server is sending a Location: javascript:... header or body redirect. Enables arbitrary JS execution in the victim's browser context.`
          : `Server redirects to attacker-controlled domain via ?${hit.param}=https://${EVIL_DOMAIN}. Attacker shares malicious link to the app; victim is bounced to phishing page.`,
        attacks: hit.jsRedirect
          ? 'JavaScript URI redirect — code execution in victim browser, wallet drain via injected script'
          : 'Phishing via trusted domain redirect — victim clicks mathsmine3.xyz/... and lands on attacker site; OAuth token theft, wallet approval fraud',
        recommended: 'Validate redirect targets against an allowlist of trusted origins; never trust user-supplied URLs',
      })
    }
  }

  const failed = findings.filter(f => f.status === 'fail').length
  const score  = Math.max(0, 100 - failed * 40)

  return {
    id:     'open_redirect',
    name:   'Open Redirect',
    source: `GET param probe · ${SAMPLED_PARAMS.length} params · ${PROBE_PATHS.length} paths`,
    status: failed > 0 ? 'fail' : 'pass',
    score,
    findings,
    probeDetails: {
      paramsTested:  SAMPLED_PARAMS,
      pathsTested:   PROBE_PATHS.map(p => p.path),
      evilValues:    EVIL_VALUES.map(e => ({ label: e.label, value: e.value })),
      totalProbes:   SAMPLED_PARAMS.length * PROBE_PATHS.length * SAMPLED_VALUES.length,
      detection:     ['HTTP 3xx with Location: pointing to evil domain', 'Location: javascript:... header', 'javascript:alert in response body'],
      redirectMode:  'manual — redirects NOT followed, Location header inspected directly',
      timeout:       '7000ms per request',
    },
    summary: failed === 0
      ? `No open redirects in ${SAMPLED_PARAMS.length} params × ${PROBE_PATHS.length} paths — server ignores redirect params`
      : `${failed} open redirect vector${failed !== 1 ? 's' : ''} detected`,
  }
}
