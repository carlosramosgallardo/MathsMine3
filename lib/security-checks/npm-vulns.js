import { readFileSync } from 'fs'
import { join } from 'path'

export async function runNpmVulnsCheck() {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  const queries = Object.entries(deps).map(([name, version]) => ({
    package: { name, ecosystem: 'npm' },
    version: version.replace(/[\^~>=<\s]/g, '').split('||')[0].split(' ')[0] || '0.0.0',
  }))

  const res = await fetch('https://api.osv.dev/v1/querybatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`OSV API error: ${res.status}`)
  const data = await res.json()

  const findings = []
  const depEntries = Object.entries(deps)

  data.results?.forEach((result, i) => {
    if (!result.vulns?.length) return
    const [pkgName, pkgVersion] = depEntries[i]
    result.vulns.forEach(vuln => {
      const severity =
        vuln.database_specific?.severity ||
        vuln.severity?.[0]?.type ||
        'UNKNOWN'
      findings.push({
        package: pkgName,
        version: pkgVersion,
        id: vuln.id,
        summary: vuln.summary?.slice(0, 120) || '—',
        severity: severity.toUpperCase(),
        url: vuln.references?.[0]?.url || null,
      })
    })
  })

  findings.sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 }
    return (order[a.severity] ?? 5) - (order[b.severity] ?? 5)
  })

  const critical = findings.filter(f => f.severity === 'CRITICAL').length
  const high = findings.filter(f => f.severity === 'HIGH').length
  const score = Math.max(0, 100 - critical * 30 - high * 15 - findings.length * 2)

  return {
    id: 'npm_vulns',
    name: 'npm Dependencies',
    source: 'OSV (Google) · osv.dev',
    status: findings.length === 0 ? 'pass' : critical > 0 ? 'fail' : 'warn',
    score,
    findings,
    summary: findings.length === 0
      ? 'No known vulnerabilities'
      : `${findings.length} vulnerabilities — ${critical} critical, ${high} high`,
  }
}
