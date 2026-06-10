// Checks that all external <script> and <link rel="stylesheet"> tags loaded by
// the app carry an integrity= (SRI) attribute. Without SRI, a compromised CDN
// can silently serve malicious JavaScript or CSS to every visitor.

const PAGES = ['/', '/training', '/trading', '/relaying', '/mining']
const SELF_ORIGINS = ['mathsmine3.xyz', '_next', 'localhost']

function isExternal(url) {
  if (!url) return false
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return false
  return !SELF_ORIGINS.some(o => url.includes(o))
}

export async function runSubresourceIntegrityCheck(siteUrl) {
  const pageResults = await Promise.allSettled(
    PAGES.map(async path => {
      const res = await fetch(`${siteUrl}${path}`, {
        headers: { Accept: 'text/html', 'User-Agent': 'MathsMine3-SecurityScanner/1.0' },
        signal: AbortSignal.timeout(10000),
      })
      return { path, html: (await res.text().catch(() => '')).slice(0, 100_000) }
    })
  )

  const findings = []
  const seen = new Set()

  for (const r of pageResults) {
    if (r.status !== 'fulfilled') continue
    const { path, html } = r.value

    // External <script src="..."> without integrity=
    for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
      const [tag, src] = [m[0], m[1]]
      if (!isExternal(src) || seen.has(src)) continue
      seen.add(src)

      if (!tag.includes('integrity=')) {
        findings.push({
          label:    `External script without SRI — ${src.slice(0, 80)}`,
          page:     path,
          status:   'fail',
          severity: 'HIGH',
          detail:   `<script src="${src.slice(0, 100)}"> lacks integrity= attribute`,
          rationale: 'External scripts without SRI allow the remote host/CDN to serve arbitrary JavaScript. A single compromise of that CDN delivers malicious code to all visitors silently.',
          attacks:  'Supply chain attack — CDN compromise injects keyloggers, credential harvesters, crypto miners, or exfiltrates wallet addresses from every page load',
          tag:      tag.slice(0, 250),
        })
      }
    }

    // External <link rel="stylesheet" href="..."> without integrity=
    for (const m of html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
      const [tag, href] = [m[0], m[1]]
      if (!isExternal(href) || seen.has(href)) continue
      if (!/stylesheet/i.test(tag)) continue
      seen.add(href)

      if (!tag.includes('integrity=')) {
        findings.push({
          label:    `External stylesheet without SRI — ${href.slice(0, 80)}`,
          page:     path,
          status:   'warn',
          severity: 'MEDIUM',
          detail:   `<link href="${href.slice(0, 100)}"> lacks integrity= attribute`,
          rationale: 'CSS can exfiltrate data via attribute selectors (input[value^="a"] { background: url(leak?v=a) }) and inject overlay phishing forms. Without SRI, CDN compromise affects all users.',
          attacks:  'CSS-based data exfiltration, UI overlay phishing, CSS keylogging of form inputs',
          tag:      tag.slice(0, 250),
        })
      }
    }
  }

  if (findings.length === 0) {
    findings.push({
      label:    `No external resources without SRI detected`,
      status:   'pass',
      severity: null,
      detail:   `Checked ${PAGES.length} pages — all resources are self-hosted or carry integrity= attributes`,
    })
  }

  const failed = findings.filter(f => f.status === 'fail').length
  const warns  = findings.filter(f => f.status === 'warn').length
  const score  = Math.max(0, 100 - failed * 25 - warns * 10)

  return {
    id:     'subresource_integrity',
    name:   'Subresource Integrity (SRI)',
    source: `HTML parse · ${PAGES.length} pages · <script> + <link stylesheet> tags`,
    status: failed > 0 ? 'fail' : warns > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      pagesChecked:  PAGES,
      method:        'GET page HTML, regex-match all external <script src> and <link stylesheet href> tags, verify integrity= (SHA-256/384/512 hash) attribute is present',
      selfOrigins:   SELF_ORIGINS,
      passCondition: 'All external resources carry integrity= attribute or no external resources are loaded',
      failCondition: 'External <script> without integrity= — CDN compromise → arbitrary code on all visitors',
      warnCondition: 'External <link stylesheet> without integrity= — CSS exfiltration / phishing overlay',
      background:    'SRI (W3C spec) allows browsers to verify that fetched resources match an expected cryptographic hash, blocking tampered responses even if the CDN is compromised.',
    },
    summary: failed === 0 && warns === 0
      ? `All resources across ${PAGES.length} pages use SRI or are self-hosted — supply chain safe`
      : `${failed} external script${failed !== 1 ? 's' : ''} without SRI, ${warns} stylesheet${warns !== 1 ? 's' : ''} without SRI — supply chain risk`,
  }
}
