// Sensitive strings that should never appear in rendered page HTML
const LEAK_PATTERNS = [
  { re: /at Object\.\s/i,                 label: 'Node.js stack trace',         severity: 'HIGH'   },
  { re: /at async \w/i,                   label: 'async stack trace',            severity: 'HIGH'   },
  { re: /ECONNREFUSED/i,                  label: 'DB connection error exposed',  severity: 'HIGH'   },
  { re: /PGRST\d{3}/i,                    label: 'PostgREST error code exposed', severity: 'HIGH'   },
  { re: /supabase\.co\/rest\/v1/i,        label: 'Supabase REST URL in HTML',    severity: 'MEDIUM' },
  { re: /pg_\w+/i,                        label: 'PostgreSQL internal keyword',  severity: 'MEDIUM' },
  { re: /Cannot find module/i,            label: 'Node.js module error',         severity: 'MEDIUM' },
  { re: /SyntaxError:/i,                  label: 'SyntaxError in HTML',          severity: 'MEDIUM' },
  { re: /TypeError:/i,                    label: 'TypeError in HTML',            severity: 'MEDIUM' },
  { re: /SUPABASE_SERVICE_ROLE_KEY/,      label: 'Service role key variable name exposed', severity: 'CRITICAL' },
  { re: /NEXTAUTH_SECRET/,               label: 'NextAuth secret variable exposed', severity: 'CRITICAL' },
  { re: /\b0x[0-9a-fA-F]{64}\b/,         label: 'Ethereum private key in HTML', severity: 'CRITICAL' },
]

const PAGES = [
  { path: '/',             label: 'Home',         section: 'Home' },
  { path: '/training',     label: 'Training',     section: 'Training' },
  { path: '/trading',      label: 'Trading',      section: 'Trading' },
  { path: '/mining',       label: 'Mining',       section: 'Mining' },
  { path: '/chain3d',      label: 'Chain 3D',     section: 'Mining' },
  { path: '/relaying',     label: 'Relaying',     section: 'Relaying' },
  { path: '/squeezing',    label: 'Squeezing',    section: 'Squeezing' },
  { path: '/daily-tasks',  label: 'Daily Tasks',  section: 'Daily Tasks' },
  { path: '/ranking',      label: 'Ranking',      section: 'Ranking' },
  { path: '/mm3-value',    label: 'MM3 Value',    section: 'Economy' },
  { path: '/ai-team',      label: 'AI Team',      section: 'System' },
  { path: '/api',          label: 'API Docs',     section: 'System' },
  { path: '/manifesto',    label: 'Manifesto',    section: 'Static' },
  { path: '/privacy',      label: 'Privacy',      section: 'Static' },
  { path: '/terms',        label: 'Terms',        section: 'Static' },
  { path: '/security',     label: 'Security',     section: 'System' },
]

export async function runPageHealthCheck(siteUrl) {
  const results = await Promise.allSettled(
    PAGES.map(async page => {
      const t0 = Date.now()
      try {
        const res = await fetch(`${siteUrl}${page.path}`, {
          method: 'GET',
          redirect: 'follow',
          headers: { Accept: 'text/html', 'User-Agent': 'MathsMine3-SecurityScanner/1.0' },
          signal: AbortSignal.timeout(12000),
        })
        const ms   = Date.now() - t0
        const html = await res.text().catch(() => '')
        const contentType = res.headers.get('content-type') || ''
        return { status: res.status, html: html.slice(0, 30000), ms, contentType, page }
      } catch (e) {
        return { status: 0, html: '', ms: Date.now() - t0, error: e.message?.slice(0, 80), page }
      }
    })
  )

  const findings = []
  let serverErrors = 0

  for (const r of results) {
    const { status, html, ms, contentType, error, page } = r.status === 'fulfilled'
      ? r.value
      : { status: 0, html: '', ms: 0, error: r.reason?.message, page: PAGES[results.indexOf(r)] }

    // ── Check 1: HTTP status ────────────────────────────────────────────────
    if (status === 0 || status >= 500) {
      serverErrors++
      findings.push({
        label:    `${page.label} (${page.path}) — HTTP ${status || 'timeout/error'}`,
        section:  page.section,
        status:   'fail',
        severity: 'HIGH',
        httpStatus: status,
        responseMs: ms,
        rationale: `Page returned a 5xx server error or timed out — unhandled exception or infrastructure issue visible to users.`,
        attacks:   'Error pages expose stack traces, internal paths, framework version, and DB query details',
        detail:    error || `Server error HTTP ${status}`,
      })
      continue
    }

    if (status >= 400 && status < 500) {
      // 4xx could be expected for authenticated-only pages — mark as warn not fail
      findings.push({
        label:    `${page.label} (${page.path}) — HTTP ${status}`,
        section:  page.section,
        status:   'warn',
        severity: 'LOW',
        httpStatus: status,
        responseMs: ms,
        rationale: `Page returned ${status} — either auth-gated (expected) or a routing issue.`,
        detail:    `HTTP ${status}`,
      })
      continue
    }

    // ── Check 2: Content type ───────────────────────────────────────────────
    const isHtml = contentType.includes('text/html')

    // ── Check 3: Scan for sensitive data leaks ───────────────────────────────
    const leaks = []
    for (const pat of LEAK_PATTERNS) {
      if (pat.re.test(html)) {
        leaks.push(pat)
      }
    }

    if (leaks.length > 0) {
      const worst = leaks.reduce((a, b) => {
        const ord = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
        return (ord[a.severity] ?? 4) <= (ord[b.severity] ?? 4) ? a : b
      })
      serverErrors++
      findings.push({
        label:    `${page.label} (${page.path}) — sensitive data in page HTML`,
        section:  page.section,
        status:   'fail',
        severity: worst.severity,
        httpStatus: status,
        responseMs: ms,
        leaksFound: leaks.map(l => l.label),
        rationale: `Page HTML contains patterns indicating server-side error or internal data leakage: ${leaks.map(l => l.label).join(', ')}`,
        attacks:   'Error detail disclosure — attacker reads stack traces, DB schema, or internal service structure from page source',
      })
    } else {
      // Page is healthy
      findings.push({
        label:    `${page.label} (${page.path})`,
        section:  page.section,
        status:   'pass',
        severity: null,
        httpStatus: status,
        responseMs: ms,
        isHtml,
        summary:  `HTTP ${status} · ${ms}ms · no sensitive patterns detected`,
      })
    }
  }

  const failed   = findings.filter(f => f.status === 'fail').length
  const warnings = findings.filter(f => f.status === 'warn').length
  const score    = Math.max(0, 100 - failed * 15 - warnings * 3)

  const sections = [...new Set(PAGES.map(p => p.section))]
  const sectionSummary = sections.map(sec => {
    const secFinds = findings.filter(f => f.section === sec)
    const secFails = secFinds.filter(f => f.status === 'fail').length
    return `${sec}: ${secFails === 0 ? '✓' : `✗ ${secFails}`}`
  }).join(' · ')

  return {
    id:     'page_health',
    name:   'Page Health & Leak Detection',
    source: `GET · ${PAGES.length} pages · ${sections.length} sections`,
    status: failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      pagesTested:     PAGES.length,
      sections,
      method:          'GET with redirect follow, User-Agent: MathsMine3-SecurityScanner/1.0',
      patternsChecked: LEAK_PATTERNS.map(p => p.label),
      failConditions:  ['HTTP 5xx (server error)', 'Timeout', 'Stack trace in HTML', 'DB error keyword in HTML', 'Private key pattern in HTML'],
      warnConditions:  ['HTTP 4xx (auth-gated or missing route)'],
      timeout:         '12000ms per page',
    },
    summary: failed === 0 && warnings === 0
      ? `All ${PAGES.length} pages healthy — no 5xx or sensitive data leaks — ${sectionSummary}`
      : `${failed} page${failed !== 1 ? 's' : ''} with errors/leaks, ${warnings} warning${warnings !== 1 ? 's' : ''} — ${sectionSummary}`,
  }
}
