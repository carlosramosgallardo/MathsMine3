const PATHS = [
  // ── Secrets / credentials ──────────────────────────────────────────────────
  { path: '/.env',               label: '.env file',               severity: 'CRITICAL', rationale: 'Plain-text dump of all API keys, DB credentials and secrets used by the app.' },
  { path: '/.env.local',         label: '.env.local file',         severity: 'CRITICAL', rationale: 'Local overrides often contain dev credentials or production keys used during testing.' },
  { path: '/.env.production',    label: '.env.production file',    severity: 'CRITICAL', rationale: 'Production secrets directly accessible without authentication.' },
  { path: '/.env.development',   label: '.env.development file',   severity: 'CRITICAL', rationale: 'Development environment variables may contain staging API keys or debug secrets.' },
  { path: '/.env.staging',       label: '.env.staging file',       severity: 'CRITICAL', rationale: 'Staging secrets often mirror production credentials.' },
  { path: '/.env.backup',        label: '.env.backup file',        severity: 'CRITICAL', rationale: 'Backup env files often left behind during migrations, contain real credentials.' },
  { path: '/.npmrc',             label: '.npmrc (npm auth tokens)', severity: 'HIGH',     rationale: 'npm config with auth tokens for private registries — enables package supply chain access.' },
  { path: '/.yarnrc.yml',        label: '.yarnrc.yml',             severity: 'HIGH',     rationale: 'Yarn config may contain private registry tokens embedded as npmAuthToken.' },

  // ── Source control ────────────────────────────────────────────────────────
  { path: '/.git/config',        label: '.git/config',             severity: 'HIGH',     rationale: 'Reveals remote repository URLs and git user config. Enables full source code reconstruction.' },
  { path: '/.git/HEAD',          label: '.git/HEAD',               severity: 'HIGH',     rationale: 'Confirms .git directory is public — attacker can reconstruct the full git repository.' },
  { path: '/.git/COMMIT_EDITMSG', label: '.git/COMMIT_EDITMSG',   severity: 'MEDIUM',   rationale: 'Last commit message may contain sensitive context (API key names, internal system references).' },
  { path: '/.git/logs/HEAD',     label: '.git/logs/HEAD',          severity: 'HIGH',     rationale: 'Commit history with timestamps and author info — part of full repo reconstruction.' },
  { path: '/.svn/entries',       label: '.svn/entries (SVN)',      severity: 'HIGH',     rationale: 'SVN metadata — enables full working copy reconstruction like .git/.' },

  // ── Database / backup files ───────────────────────────────────────────────
  { path: '/backup.sql',         label: 'backup.sql',              severity: 'CRITICAL', rationale: 'Database backup with full table dumps including user data, hashed passwords, and API keys.' },
  { path: '/dump.sql',           label: 'dump.sql',                severity: 'CRITICAL', rationale: 'Database dump — complete data exposure including PII and financial records.' },
  { path: '/database.sql',       label: 'database.sql',            severity: 'CRITICAL', rationale: 'Database schema + data file accidentally left in web root.' },

  // ── Debug / admin endpoints ───────────────────────────────────────────────
  { path: '/api/debug',          label: '/api/debug endpoint',     severity: 'HIGH',     rationale: 'Debug endpoints often expose internal state, environment variables, or admin-level operations.' },
  { path: '/admin',              label: '/admin route',            severity: 'MEDIUM',   rationale: 'Admin panels must not be publicly routable. Even a login page leaks the existence of the interface.' },
  { path: '/console',            label: '/console (debug UI)',      severity: 'HIGH',     rationale: 'Debug console interface — may allow arbitrary code execution or DB inspection.' },
  { path: '/_debug',             label: '/_debug endpoint',        severity: 'HIGH',     rationale: 'Internal debug endpoint — common in Node.js/Next.js apps accidentally left deployed.' },

  // ── Server config / framework files ──────────────────────────────────────
  { path: '/web.config',         label: 'web.config (IIS)',        severity: 'MEDIUM',   rationale: 'IIS config with connection strings, app settings, and server-side include rules.' },
  { path: '/.htaccess',          label: '.htaccess (Apache)',      severity: 'LOW',      rationale: 'Apache config — reveals URL rewriting rules, auth directives, and server path layout.' },
  { path: '/Dockerfile',         label: 'Dockerfile',              severity: 'MEDIUM',   rationale: 'Reveals build process, base images, environment variable names, and installed packages.' },
  { path: '/docker-compose.yml', label: 'docker-compose.yml',     severity: 'HIGH',     rationale: 'Docker Compose config often includes service passwords, network topology, and volume mounts.' },
  { path: '/phpinfo.php',        label: 'phpinfo.php',             severity: 'LOW',      rationale: 'Exposes PHP version, loaded modules, server path layout and all ini values.' },
  { path: '/wp-config.php',      label: 'wp-config.php',          severity: 'CRITICAL', rationale: 'WordPress DB credentials, auth keys, and secret salts in plain text.' },
  { path: '/wp-admin',           label: '/wp-admin (WordPress)',   severity: 'LOW',      rationale: 'WordPress admin panel — presence confirms CMS and version fingerprinting surface.' },

  // ── API documentation ─────────────────────────────────────────────────────
  { path: '/swagger.json',       label: 'swagger.json (API spec)',  severity: 'MEDIUM',   rationale: 'Full API specification including internal endpoint names, parameter types, and auth schemes.' },
  { path: '/openapi.json',       label: 'openapi.json (API spec)',  severity: 'MEDIUM',   rationale: 'OpenAPI spec exposes full internal API surface to reconnaissance.' },
  { path: '/api-docs',           label: '/api-docs (Swagger UI)',   severity: 'MEDIUM',   rationale: 'Interactive API browser — allows exploring and testing all endpoints without auth.' },
  { path: '/graphql',            label: '/graphql endpoint',        severity: 'MEDIUM',   rationale: 'GraphQL endpoint — introspection queries reveal full schema; mutations may be unauthenticated.' },
  { path: '/api/graphql',        label: '/api/graphql endpoint',    severity: 'MEDIUM',   rationale: 'Next.js GraphQL route — same introspection risk, often with disabled auth in dev.' },

  // ── Log files ─────────────────────────────────────────────────────────────
  { path: '/debug.log',          label: 'debug.log',               severity: 'HIGH',     rationale: 'Debug log with stack traces, internal paths, credentials passed in error messages.' },
  { path: '/error.log',          label: 'error.log',               severity: 'HIGH',     rationale: 'Error log exposing exception details, DB query errors, and internal service names.' },
  { path: '/access.log',         label: 'access.log',              severity: 'MEDIUM',   rationale: 'HTTP access log — reveals internal URL patterns, authenticated sessions, and client IPs.' },

  // ── Misc public security ──────────────────────────────────────────────────
  { path: '/.well-known/security.txt', label: 'security.txt (RFC 9116)', severity: null, infoOnly: true, rationale: 'RFC 9116 security disclosure policy — its absence is a hygiene concern, not a vulnerability.' },
  { path: '/package.json',       label: 'package.json (dep list)',  severity: 'LOW',      rationale: 'Exposes all dependency names and versions — enables targeted CVE lookup against known-vulnerable packages.' },
  { path: '/config.json',        label: 'config.json',             severity: 'HIGH',     rationale: 'App config file often contains API endpoints, feature flags, or embedded credentials.' },
]

export async function runSensitivePathsCheck(siteUrl) {
  // Run all HEAD requests in parallel
  const results = await Promise.allSettled(
    PATHS.map(async ({ path, label, severity, rationale, infoOnly }) => {
      let httpStatus  = 0
      let responseMs  = 0
      let contentType = null
      try {
        const t0  = Date.now()
        const res = await fetch(`${siteUrl}${path}`, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(6000),
        })
        responseMs  = Date.now() - t0
        httpStatus  = res.status
        contentType = res.headers.get('content-type')
      } catch { /* timeout / connection error = not exposed */ }

      // security.txt: 200 is GOOD (RFC 9116), absence is informational
      if (infoOnly) {
        const present = httpStatus === 200 || httpStatus === 206
        return {
          label,
          path,
          status:      present ? 'pass' : 'warn',
          severity:    present ? null : 'LOW',
          httpStatus,
          contentType: contentType || '(none)',
          rationale,
          responseMs,
          detail: present
            ? 'HTTP 200 — security.txt policy published (RFC 9116 ✓)'
            : `HTTP ${httpStatus || 'timeout'} — security.txt absent (RFC 9116 best practice)`,
          scoreImpact: present ? null : '-1pt (hygiene)',
        }
      }

      const exposed = httpStatus === 200 || httpStatus === 206
      return {
        label,
        path,
        status:      exposed ? 'fail' : 'pass',
        severity:    exposed ? severity : null,
        httpStatus,
        contentType: contentType || '(none)',
        rationale,
        responseMs,
        detail: exposed
          ? `HTTP ${httpStatus} — resource accessible`
          : httpStatus === 0
            ? 'connection error / timeout'
            : `HTTP ${httpStatus} — not exposed`,
      }
    })
  )

  const findings = results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : {
      label:     PATHS[i].label,
      path:      PATHS[i].path,
      status:    'warn',
      severity:  null,
      httpStatus: 0,
      detail:    `Check failed: ${r.reason?.message?.slice(0, 60) || 'unknown'}`,
    }
  )

  const failCount  = findings.filter(f => f.status === 'fail').length
  const critical   = findings.filter(f => f.status === 'fail' && f.severity === 'CRITICAL').length
  const high       = findings.filter(f => f.status === 'fail' && f.severity === 'HIGH').length
  const infoWarn   = findings.filter(f => f.status === 'warn' && PATHS[findings.indexOf(f)]?.infoOnly).length
  const score      = Math.max(0, 100 - critical * 40 - high * 20 - failCount * 5)

  const categories = {
    'Secrets / credentials': findings.filter(f => f.path?.startsWith('/.env') || f.path === '/.npmrc' || f.path === '/.yarnrc.yml').filter(f => f.status === 'fail').length,
    'Source control':        findings.filter(f => f.path?.startsWith('/.git') || f.path?.startsWith('/.svn')).filter(f => f.status === 'fail').length,
    'Database backups':      findings.filter(f => /\.(sql)$/.test(f.path ?? '')).filter(f => f.status === 'fail').length,
    'Debug / admin':         findings.filter(f => /debug|admin|console/.test(f.path ?? '')).filter(f => f.status === 'fail').length,
  }

  return {
    id:     'sensitive_paths',
    name:   'Sensitive Path Exposure',
    source: `HEAD requests · ${PATHS.length} paths · ${siteUrl}`,
    status: critical > 0 ? 'fail' : failCount > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      method:       'HEAD (parallel) — no body downloaded, minimal bandwidth',
      redirect:     'manual — 301/302 not followed, only 200/206 counts as exposed',
      pathsTested:  PATHS.length,
      pathList:     PATHS.map(p => p.path),
      categories,
      infoOnlyPaths: PATHS.filter(p => p.infoOnly).map(p => p.path),
      timeout:      '6000ms per path',
    },
    summary: failCount === 0
      ? `All ${PATHS.length} sensitive paths correctly return non-200 status`
      : `${failCount} path${failCount > 1 ? 's' : ''} may be exposed (${critical} critical, ${high} high) — ${PATHS.length} total paths checked`,
  }
}
