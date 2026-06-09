import { readFileSync } from 'fs'
import { join } from 'path'

const OSV_API = 'https://api.osv.dev/v1/querybatch'

export async function runNpmVulnsCheck() {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const depEntries = Object.entries(deps)

  const queries = depEntries.map(([name, version]) => ({
    package: { name, ecosystem: 'npm' },
    version: version.replace(/[\^~>=<\s]/g, '').split('||')[0].split(' ')[0] || '0.0.0',
  }))

  const t0 = Date.now()
  const res = await fetch(OSV_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`OSV API error: ${res.status}`)
  const data = await res.json()
  const responseMs = Date.now() - t0

  const findings = []

  data.results?.forEach((result, i) => {
    if (!result.vulns?.length) return
    const [pkgName, pkgVersion] = depEntries[i]
    result.vulns.forEach(vuln => {
      const severity =
        vuln.database_specific?.severity ||
        vuln.severity?.[0]?.type ||
        'UNKNOWN'

      const cvssEntry = vuln.severity?.find(s => s.score)
      const cvss = cvssEntry?.score || null

      const aliases = vuln.aliases?.filter(a => a.startsWith('CVE-')).slice(0, 3) || []

      const affectedPkg = vuln.affected?.find(a => a.package?.name === pkgName)
      const fixedVersions = affectedPkg?.ranges?.flatMap(r =>
        (r.events || []).filter(e => e.fixed).map(e => e.fixed)
      ).filter(Boolean) || []

      const affectedRanges = affectedPkg?.ranges?.flatMap(r => {
        const evts = r.events || []
        return evts.reduce((acc, e, idx) => {
          if (e.introduced && evts[idx + 1]?.fixed) acc.push(`>=${e.introduced} <${evts[idx + 1].fixed}`)
          else if (e.introduced && !evts[idx + 1]?.fixed) acc.push(`>=${e.introduced}`)
          return acc
        }, [])
      }).filter(Boolean) || []

      findings.push({
        package: pkgName,
        version: pkgVersion,
        id: vuln.id,
        summary: vuln.summary?.slice(0, 150) || '—',
        severity: severity.toUpperCase(),
        cvss,
        aliases,
        fixedIn: fixedVersions[0] || null,
        affectedRange: affectedRanges[0] || null,
        url: vuln.references?.[0]?.url || `https://osv.dev/vulnerability/${vuln.id}`,
        modified: vuln.modified?.slice(0, 10) || null,
      })
    })
  })

  findings.sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 }
    return (order[a.severity] ?? 5) - (order[b.severity] ?? 5)
  })

  const critical = findings.filter(f => f.severity === 'CRITICAL').length
  const high     = findings.filter(f => f.severity === 'HIGH').length
  const medium   = findings.filter(f => f.severity === 'MEDIUM').length
  const low      = findings.filter(f => f.severity === 'LOW').length
  const score    = Math.max(0, 100 - critical * 30 - high * 15 - findings.length * 2)

  const probeDetails = {
    method: 'POST',
    endpoint: OSV_API,
    protocol: 'OSV Batch Query API v1 (Google Open Source Vulnerabilities)',
    packagesQueried: queries.length,
    responseTimeMs: responseMs,
    requestPayload: `{"queries":[...${queries.length} entries, each with {package.name, package.ecosystem:"npm", version}]}`,
    responseFields: 'results[i].vulns[].{id, summary, severity[].{type,score}, aliases, affected[].ranges, references}',
    breakdown: { critical, high, medium, low },
    ecosystemFilter: 'npm',
    timeout: '15000ms',
  }

  return {
    id: 'npm_vulns',
    name: 'npm Dependencies',
    source: 'OSV (Google) · osv.dev',
    status: findings.length === 0 ? 'pass' : critical > 0 ? 'fail' : 'warn',
    score,
    findings,
    probeDetails,
    summary: findings.length === 0
      ? `No known vulnerabilities in ${queries.length} packages`
      : `${findings.length} vulnerabilities — ${critical} critical, ${high} high, ${medium} medium across ${queries.length} packages`,
  }
}
