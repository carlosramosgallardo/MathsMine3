function parseCsp(raw) {
  if (!raw) return null
  const directives = {}
  raw.split(';').forEach(part => {
    const tokens = part.trim().split(/\s+/)
    const name   = tokens[0]?.toLowerCase()
    if (name) directives[name] = tokens.slice(1).map(v => v.toLowerCase())
  })
  return directives
}

function effective(directives, name, fallback = 'default-src') {
  return directives[name] ?? directives[fallback] ?? null
}

const UNSAFE_INLINE = "'unsafe-inline'"
const UNSAFE_EVAL   = "'unsafe-eval'"

export async function runCspAnalysisCheck(siteUrl) {
  let cspHeader  = null
  let httpStatus = 0
  let responseMs = 0
  let isReportOnly = false

  try {
    const t0  = Date.now()
    const res = await fetch(siteUrl, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(10000) })
    responseMs  = Date.now() - t0
    httpStatus  = res.status
    cspHeader   = res.headers.get('content-security-policy')
    if (!cspHeader) {
      cspHeader   = res.headers.get('content-security-policy-report-only')
      isReportOnly = !!cspHeader
    }
  } catch {}

  if (!cspHeader) {
    return {
      id:     'csp_analysis',
      name:   'CSP Deep Analysis',
      source: `GET ${siteUrl} → Content-Security-Policy`,
      status: 'fail',
      score:  0,
      findings: [{
        label:       'No Content-Security-Policy header',
        status:      'fail',
        severity:    'HIGH',
        rationale:   'CSP is the primary browser-level defence against XSS. Without it, any injected script executes without restriction and can read cookies, tokens, and DOM.',
        attacks:     'Cross-Site Scripting (XSS), data injection via external scripts, wallet drain via malicious script in page context',
        recommended: "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
      }],
      probeDetails: { httpStatus, responseMs, cspHeader: '(not set)', isReportOnly: false },
      summary: 'No Content-Security-Policy header — XSS protection absent',
    }
  }

  const directives = parseCsp(cspHeader)
  const findings   = []

  // ── 0. Report-only is not enforced ──────────────────────────────────────────
  if (isReportOnly) {
    findings.push({
      label:    'CSP is Report-Only — not enforced',
      status:   'warn',
      severity: 'HIGH',
      rationale: 'Content-Security-Policy-Report-Only reports violations but does NOT block them. Browsers still execute all scripts regardless of the policy.',
      attacks:  'Full XSS attack surface remains open — report-only provides zero runtime protection',
      recommended: 'Deploy as Content-Security-Policy (enforced) instead of Content-Security-Policy-Report-Only',
    })
  }

  // ── 1. script-src (most critical) ───────────────────────────────────────────
  const scriptSrc = effective(directives, 'script-src')
  if (!scriptSrc) {
    findings.push({
      label:    'script-src — directive absent (no fallback)',
      status:   'fail',
      severity: 'HIGH',
      directive: 'script-src',
      rationale: 'No script-src and no default-src — browser applies no restrictions on script sources.',
      attacks:  'XSS via any external script source, CDN compromise, third-party script injection',
      recommended: "script-src 'self' 'nonce-{random}'",
    })
  } else {
    const hasUnsafeInline = scriptSrc.includes(UNSAFE_INLINE)
    const hasUnsafeEval   = scriptSrc.includes(UNSAFE_EVAL)
    const hasWildcard     = scriptSrc.includes('*')
    const hasData         = scriptSrc.includes('data:')
    const hasNonce        = scriptSrc.some(s => s.startsWith("'nonce-"))
    const hasHash         = scriptSrc.some(s => /^'sha(256|384|512)-/.test(s))
    const httpSources     = scriptSrc.filter(s => s.startsWith('http://'))

    if (hasWildcard) {
      findings.push({
        label: 'script-src — wildcard * allows all script origins',
        status: 'fail', severity: 'HIGH', directive: 'script-src',
        value: scriptSrc.join(' '),
        rationale: "script-src: * permits loading scripts from any URL — equivalent to no CSP for scripts.",
        attacks: 'XSS via any external domain, complete CSP bypass',
        recommended: "script-src 'self' 'nonce-{random}'",
      })
    }
    if (hasUnsafeInline && !hasNonce && !hasHash) {
      findings.push({
        label: "script-src — 'unsafe-inline' negates XSS protection",
        status: 'fail', severity: 'HIGH', directive: 'script-src',
        value: scriptSrc.join(' '),
        rationale: "'unsafe-inline' allows all inline scripts — any XSS payload injected into the HTML will execute. Nonces/hashes override this restriction.",
        attacks: 'Inline XSS — <script>...</script>, onclick=, javascript: URI, event handler injection',
        recommended: "Remove 'unsafe-inline'; use nonces or hashes for legitimate inline scripts",
      })
    }
    if (hasUnsafeEval) {
      findings.push({
        label: "script-src — 'unsafe-eval' enables dynamic code execution",
        status: 'fail', severity: 'HIGH', directive: 'script-src',
        value: scriptSrc.join(' '),
        rationale: "'unsafe-eval' allows eval(), Function(), setTimeout(string), setInterval(string) — attacker-controlled strings can become executable code.",
        attacks: 'Template injection to eval(), dynamic script execution from user-controlled strings',
        recommended: "Remove 'unsafe-eval'; refactor code using eval() to literal functions",
      })
    }
    if (hasData) {
      findings.push({
        label: "script-src — data: URI allows embedded scripts",
        status: 'warn', severity: 'MEDIUM', directive: 'script-src',
        value: scriptSrc.join(' '),
        rationale: "'data:' in script-src allows <script src=\"data:text/javascript,...\"> which can embed attacker scripts as base64 URIs.",
        attacks: 'Encoded XSS payload via data: URI, bypass of naive string-based filters',
        recommended: "Remove data: from script-src",
      })
    }
    if (httpSources.length > 0) {
      findings.push({
        label: `script-src — HTTP (non-HTTPS) sources: ${httpSources.join(', ')}`,
        status: 'warn', severity: 'MEDIUM', directive: 'script-src',
        value: scriptSrc.join(' '),
        rationale: 'HTTP script sources allow MITM to replace scripts with malicious payloads.',
        attacks: 'Script MITM injection via HTTP interception',
        recommended: 'Use https:// for all script-src origins',
      })
    }
    if (!hasWildcard && !hasUnsafeInline && !hasUnsafeEval && !hasData && httpSources.length === 0) {
      findings.push({
        label: `script-src — correctly restricted${hasNonce ? ' (nonce)' : hasHash ? ' (hash)' : ''}`,
        status: 'pass', severity: null, directive: 'script-src',
        value: scriptSrc.join(' '),
        rationale: 'script-src does not allow inline scripts, eval, or wildcard origins.',
      })
    }
  }

  // ── 2. object-src ────────────────────────────────────────────────────────────
  const objectSrc = effective(directives, 'object-src')
  if (!objectSrc) {
    findings.push({
      label: "object-src — missing (should be 'none')",
      status: 'warn', severity: 'MEDIUM', directive: 'object-src',
      rationale: "Without explicit object-src, browser may allow <object>/<embed>/<applet> (Flash/Java) based on default-src. Explicit 'none' is required.",
      attacks: 'Plugin-based XSS via Flash/Java applets embedded via <object> or <embed>',
      recommended: "object-src 'none'",
    })
  } else if (!objectSrc.includes("'none'")) {
    findings.push({
      label: "object-src — not set to 'none'",
      status: 'warn', severity: 'MEDIUM', directive: 'object-src',
      value: objectSrc.join(' '),
      rationale: "object-src should be 'none' to disable all plugin-based code execution.",
      attacks: 'Plugin-based script execution via <object>/<embed>',
      recommended: "object-src 'none'",
    })
  } else {
    findings.push({
      label: "object-src 'none' — plugins disabled",
      status: 'pass', severity: null, directive: 'object-src',
      value: objectSrc.join(' '),
      rationale: "object-src 'none' prevents all plugin-based execution.",
    })
  }

  // ── 3. base-uri ──────────────────────────────────────────────────────────────
  const baseUri = directives['base-uri']
  if (!baseUri) {
    findings.push({
      label: 'base-uri — missing directive',
      status: 'warn', severity: 'MEDIUM', directive: 'base-uri',
      rationale: "Without base-uri, an injected <base href='https://attacker.com'> can redirect all relative URLs to the attacker's domain.",
      attacks: "<base> tag injection to redirect relative script/resource loads to attacker infrastructure",
      recommended: "base-uri 'self'",
    })
  } else {
    findings.push({
      label: `base-uri — ${baseUri.join(' ')}`,
      status: 'pass', severity: null, directive: 'base-uri',
      value: baseUri.join(' '),
      rationale: 'base-uri restricts <base href> injection.',
    })
  }

  // ── 4. frame-ancestors ───────────────────────────────────────────────────────
  const frameAncestors = directives['frame-ancestors']
  if (!frameAncestors) {
    findings.push({
      label: 'frame-ancestors — missing directive',
      status: 'warn', severity: 'MEDIUM', directive: 'frame-ancestors',
      rationale: "frame-ancestors supersedes X-Frame-Options. Without it, any origin can embed this page in an iframe (clickjacking).",
      attacks: 'Clickjacking — invisible iframe overlay tricks users into wallet-connect or approve transactions',
      recommended: "frame-ancestors 'none' or frame-ancestors 'self'",
    })
  } else {
    const allowsAll = frameAncestors.includes('*')
    findings.push({
      label: allowsAll ? "frame-ancestors * — any origin can iframe this page" : `frame-ancestors — ${frameAncestors.join(' ')}`,
      status: allowsAll ? 'fail' : 'pass',
      severity: allowsAll ? 'MEDIUM' : null,
      directive: 'frame-ancestors',
      value: frameAncestors.join(' '),
      rationale: allowsAll
        ? 'Wildcard frame-ancestors allows all origins to embed this page — clickjacking attack surface fully open.'
        : 'frame-ancestors restricts iframe embedding.',
      attacks: allowsAll ? 'Clickjacking, wallet-connect approval fraud, invisible overlay attacks' : null,
    })
  }

  // ── 5. form-action ───────────────────────────────────────────────────────────
  const formAction = directives['form-action']
  if (!formAction) {
    findings.push({
      label: 'form-action — missing directive',
      status: 'warn', severity: 'LOW', directive: 'form-action',
      rationale: "Without form-action, an injected form can submit data to any external domain.",
      attacks: 'Data exfiltration via injected form — user credentials / wallet info sent to attacker server',
      recommended: "form-action 'self'",
    })
  } else {
    findings.push({
      label: `form-action — ${formAction.join(' ')}`,
      status: 'pass', severity: null, directive: 'form-action',
      value: formAction.join(' '),
      rationale: 'form-action limits where form submissions can go.',
    })
  }

  // ── 6. upgrade-insecure-requests ─────────────────────────────────────────────
  if (!directives['upgrade-insecure-requests']) {
    findings.push({
      label: 'upgrade-insecure-requests — absent',
      status: 'warn', severity: 'LOW', directive: 'upgrade-insecure-requests',
      rationale: 'Instructs browsers to upgrade http:// resource requests to https://. Absence allows mixed-content loading.',
      attacks: 'Mixed content loading — HTTP resources loaded on HTTPS page, susceptible to MITM',
      recommended: 'Add upgrade-insecure-requests to CSP',
    })
  } else {
    findings.push({
      label: 'upgrade-insecure-requests — present',
      status: 'pass', severity: null, directive: 'upgrade-insecure-requests',
      rationale: 'HTTP resources upgraded to HTTPS automatically.',
    })
  }

  const failed   = findings.filter(f => f.status === 'fail').length
  const warnings = findings.filter(f => f.status === 'warn').length
  const high     = findings.filter(f => f.severity === 'HIGH').length
  const score    = Math.max(0, 100 - high * 25 - failed * 12 - warnings * 5)

  return {
    id:     'csp_analysis',
    name:   'CSP Deep Analysis',
    source: `GET ${siteUrl} → Content-Security-Policy header`,
    status: failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      httpStatus,
      responseMs,
      isReportOnly,
      cspHeader: cspHeader?.slice(0, 400),
      directivesFound: Object.keys(directives),
      directivesChecked: ['script-src', 'object-src', 'base-uri', 'frame-ancestors', 'form-action', 'upgrade-insecure-requests'],
      note: "CSP-Report-Only is not enforced — only Content-Security-Policy provides actual XSS protection",
    },
    summary: failed === 0 && warnings === 0
      ? `CSP correctly configured — ${Object.keys(directives).length} directive${Object.keys(directives).length !== 1 ? 's' : ''} analysed`
      : `${failed} CSP failure${failed !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''} — ${isReportOnly ? 'policy not enforced (report-only)' : `${Object.keys(directives).length} directives parsed`}`,
  }
}
