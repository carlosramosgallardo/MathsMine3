import { runNpmVulnsCheck }       from './npm-vulns.js'
import { runHeadersCheck }         from './headers.js'
import { runApiAuthCheck }         from './api-auth.js'
import { runSensitivePathsCheck }  from './sensitive-paths.js'
import { runCorsPolicyCheck }      from './cors-policy.js'
import { runHttpMethodsCheck }     from './http-methods.js'

// Registry — add a new check: create file + push entry here
export const CHECKS = [
  { id: 'npm_vulns',        weight: 15, run: ()      => runNpmVulnsCheck()          },
  { id: 'security_headers', weight: 20, run: url     => runHeadersCheck(url)        },
  { id: 'api_auth',         weight: 25, run: url     => runApiAuthCheck(url)        },
  { id: 'sensitive_paths',  weight: 20, run: url     => runSensitivePathsCheck(url) },
  { id: 'cors_policy',      weight: 12, run: url     => runCorsPolicyCheck(url)     },
  { id: 'http_methods',     weight: 8,  run: url     => runHttpMethodsCheck(url)    },
]

export async function runAllChecks(siteUrl) {
  const results = await Promise.allSettled(
    CHECKS.map(c => c.run(siteUrl))
  )

  const checks = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return {
      id:       CHECKS[i].id,
      name:     CHECKS[i].id,
      status:   'error',
      score:    0,
      findings: [],
      summary:  `Check failed: ${r.reason?.message || 'unknown error'}`,
      source:   '—',
    }
  })

  // Weighted score (weights sum to 100)
  const totalWeight = CHECKS.reduce((s, c) => s + c.weight, 0)
  const score = Math.round(
    checks.reduce((sum, c, i) => sum + (c.score ?? 0) * CHECKS[i].weight, 0) / totalWeight
  )

  const hasFailure = checks.some(c => c.status === 'fail' || c.status === 'error')
  const hasWarning = checks.some(c => c.status === 'warn')
  const overall    = hasFailure ? 'fail' : hasWarning ? 'warn' : 'pass'

  return { checks, score, overall }
}
