import { runNpmVulnsCheck }  from './npm-vulns.js'
import { runHeadersCheck }   from './headers.js'
import { runApiAuthCheck }   from './api-auth.js'

// Registry — añadir nuevos checks aquí sin tocar la ruta de scan
export const CHECKS = [
  { id: 'npm_vulns',        weight: 25, run: ()           => runNpmVulnsCheck()         },
  { id: 'security_headers', weight: 35, run: (siteUrl)    => runHeadersCheck(siteUrl)   },
  { id: 'api_auth',         weight: 40, run: (siteUrl)    => runApiAuthCheck(siteUrl)   },
]

export async function runAllChecks(siteUrl) {
  const results = await Promise.allSettled(
    CHECKS.map(c => c.run(siteUrl))
  )

  const checks = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return {
      id:      CHECKS[i].id,
      name:    CHECKS[i].id,
      status:  'error',
      score:   0,
      findings: [],
      summary: `Check failed: ${r.reason?.message || 'unknown error'}`,
      source:  '—',
    }
  })

  // Weighted score
  const totalWeight = CHECKS.reduce((s, c) => s + c.weight, 0)
  const score = Math.round(
    checks.reduce((sum, c, i) => sum + (c.score ?? 0) * CHECKS[i].weight, 0) / totalWeight
  )

  const hasFailure = checks.some(c => c.status === 'fail' || c.status === 'error')
  const hasWarning = checks.some(c => c.status === 'warn')
  const overall    = hasFailure ? 'fail' : hasWarning ? 'warn' : 'pass'

  return { checks, score, overall }
}
