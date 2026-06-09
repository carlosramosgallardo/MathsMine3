const PATHS = [
  { path: '/.env',             label: '.env file',             severity: 'CRITICAL', rationale: 'Plain-text dump of all API keys, DB credentials and secrets used by the app.' },
  { path: '/.env.local',       label: '.env.local file',       severity: 'CRITICAL', rationale: 'Local overrides often contain dev credentials or production keys used during testing.' },
  { path: '/.env.production',  label: '.env.production file',  severity: 'CRITICAL', rationale: 'Production secrets directly accessible without authentication.' },
  { path: '/.git/config',      label: '.git/config',           severity: 'HIGH',     rationale: 'Reveals remote repository URLs and git user config. Combined with /.git/HEAD enables full source tree download.' },
  { path: '/.git/HEAD',        label: '.git/HEAD',             severity: 'HIGH',     rationale: 'Confirms the .git directory is publicly reachable — attacker can reconstruct the full repository.' },
  { path: '/api/debug',        label: '/api/debug endpoint',   severity: 'HIGH',     rationale: 'Debug endpoints often expose internal state, environment variables, or admin-level operations.' },
  { path: '/admin',            label: '/admin route',          severity: 'MEDIUM',   rationale: 'Admin panels must not be publicly routable. Even a login page leaks the existence of an admin interface.' },
  { path: '/phpinfo.php',      label: 'phpinfo.php',           severity: 'LOW',      rationale: 'Exposes PHP version, loaded modules, server path layout and all ini values — useful fingerprinting data.' },
]

export async function runSensitivePathsCheck(siteUrl) {
  const findings = []
  let failCount = 0

  for (const { path, label, severity, rationale } of PATHS) {
    let httpStatus = 0
    let responseMs = 0
    let contentType = null
    try {
      const t0 = Date.now()
      const res = await fetch(`${siteUrl}${path}`, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(6000),
      })
      responseMs = Date.now() - t0
      httpStatus = res.status
      contentType = res.headers.get('content-type')
    } catch { /* timeout or connection error → not exposed */ }

    const exposed = httpStatus === 200 || httpStatus === 206
    if (exposed) failCount++

    findings.push({
      label,
      path,
      status:     exposed ? 'fail' : 'pass',
      severity:   exposed ? severity : null,
      httpStatus,
      contentType: contentType || '(none)',
      rationale,
      responseMs,
      detail: exposed
        ? `HTTP ${httpStatus} — resource accessible`
        : httpStatus === 0
          ? 'connection error / timeout'
          : `HTTP ${httpStatus} — not exposed`,
    })
  }

  const critical = findings.filter(f => f.status === 'fail' && f.severity === 'CRITICAL').length
  const high     = findings.filter(f => f.status === 'fail' && f.severity === 'HIGH').length
  const score    = Math.max(0, 100 - critical * 40 - high * 20 - failCount * 5)

  return {
    id: 'sensitive_paths',
    name: 'Sensitive Path Exposure',
    source: `HEAD requests · ${PATHS.length} paths · ${siteUrl}`,
    status: critical > 0 ? 'fail' : failCount > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      method: 'HEAD',
      redirect: 'manual — 301/302 not followed, only HTTP 200 counts as exposed',
      note: 'HEAD requests download no body — minimal bandwidth, no side effects',
      pathsTested: PATHS.length,
      pathList: PATHS.map(p => p.path),
      timeout: '6000ms per path',
    },
    summary: failCount === 0
      ? `All ${PATHS.length} sensitive paths correctly return non-200 status`
      : `${failCount} path${failCount > 1 ? 's' : ''} may be exposed (${critical} critical, ${high} high)`,
  }
}
