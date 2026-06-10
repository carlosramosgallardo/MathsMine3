import { runNpmVulnsCheck }              from './npm-vulns.js'
import { runHeadersCheck }                from './headers.js'
import { runApiAuthCheck }                from './api-auth.js'
import { runSensitivePathsCheck }         from './sensitive-paths.js'
import { runCorsPolicyCheck }             from './cors-policy.js'
import { runHttpMethodsCheck }            from './http-methods.js'
import { runWalletAuthCheck }             from './wallet-auth.js'
import { runInjectionScanCheck }          from './injection-scan.js'
import { runRateLimitingCheck }           from './rate-limiting.js'
import { runCookieSecurityCheck }         from './cookie-security.js'
import { runCspAnalysisCheck }            from './csp-analysis.js'
import { runBundleSecretsCheck }          from './bundle-secrets.js'
import { runBusinessLogicCheck }          from './business-logic.js'
import { runOpenRedirectCheck }           from './open-redirect.js'
import { runPageHealthCheck }             from './page-health.js'
import { runTlsConfigCheck }              from './tls-config.js'
import { runSubresourceIntegrityCheck }   from './subresource-integrity.js'
import { runHostInjectionCheck }          from './host-injection.js'
import { runPrototypePollutionCheck }     from './prototype-pollution.js'
import { runErrorLeakageCheck }           from './error-leakage.js'

// Registry — add a new check: create file + push entry here.
// Weights are relative (not %-of-100) — total is normalised automatically.
export const CHECKS = [
  // ── Dependency & Supply Chain ──────────────────────────────────────────────
  { id: 'npm_vulns',              weight: 10, run: ()    => runNpmVulnsCheck()                     },
  { id: 'bundle_secrets',         weight: 12, run: url   => runBundleSecretsCheck(url)             },
  { id: 'subresource_integrity',  weight:  6, run: url   => runSubresourceIntegrityCheck(url)      },

  // ── Transport & Certificate ────────────────────────────────────────────────
  { id: 'tls_config',             weight:  8, run: url   => runTlsConfigCheck(url)                 },

  // ── HTTP Security Headers ──────────────────────────────────────────────────
  { id: 'security_headers',       weight: 10, run: url   => runHeadersCheck(url)                   },
  { id: 'csp_analysis',           weight: 10, run: url   => runCspAnalysisCheck(url)               },

  // ── Authentication & Authorisation ─────────────────────────────────────────
  { id: 'api_auth',               weight: 14, run: url   => runApiAuthCheck(url)                   },
  { id: 'wallet_auth',            weight: 14, run: url   => runWalletAuthCheck(url)                },
  { id: 'cookie_security',        weight:  5, run: url   => runCookieSecurityCheck(url)            },

  // ── Page Health & Surface Coverage ────────────────────────────────────────
  { id: 'page_health',            weight: 10, run: url   => runPageHealthCheck(url)                },

  // ── Injection & Input Security ─────────────────────────────────────────────
  { id: 'injection_scan',         weight: 20, run: url   => runInjectionScanCheck(url)             },
  { id: 'business_logic',         weight: 12, run: url   => runBusinessLogicCheck(url)             },
  { id: 'prototype_pollution',    weight:  5, run: url   => runPrototypePollutionCheck(url)        },
  { id: 'error_leakage',          weight:  7, run: url   => runErrorLeakageCheck(url)              },

  // ── Information Disclosure ─────────────────────────────────────────────────
  { id: 'sensitive_paths',        weight:  8, run: url   => runSensitivePathsCheck(url)            },
  { id: 'open_redirect',          weight:  4, run: url   => runOpenRedirectCheck(url)              },

  // ── Network & Protocol ─────────────────────────────────────────────────────
  { id: 'cors_policy',            weight:  8, run: url   => runCorsPolicyCheck(url)                },
  { id: 'http_methods',           weight:  4, run: url   => runHttpMethodsCheck(url)               },
  { id: 'rate_limiting',          weight:  7, run: url   => runRateLimitingCheck(url)              },
  { id: 'host_injection',         weight:  7, run: url   => runHostInjectionCheck(url)             },
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

  const totalWeight = CHECKS.reduce((s, c) => s + c.weight, 0)
  const score = Math.round(
    checks.reduce((sum, c, i) => sum + (c.score ?? 0) * CHECKS[i].weight, 0) / totalWeight
  )

  const hasFailure = checks.some(c => c.status === 'fail' || c.status === 'error')
  const hasWarning = checks.some(c => c.status === 'warn')
  const overall    = hasFailure ? 'fail' : hasWarning ? 'warn' : 'pass'

  return { checks, score, overall }
}
