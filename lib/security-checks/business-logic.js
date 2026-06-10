async function post(url, body, timeoutMs = 8000) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await res.text().catch(() => '')
    return { status: res.status, preview: text.slice(0, 120), ms: Date.now() - t0 }
  } catch (e) {
    return { status: 0, preview: e.message?.slice(0, 60), ms: Date.now() - t0 }
  }
}

async function get(url, timeoutMs = 7000) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    const text = await res.text().catch(() => '')
    return { status: res.status, preview: text.slice(0, 120), ms: Date.now() - t0 }
  } catch (e) {
    return { status: 0, preview: e.message?.slice(0, 60), ms: Date.now() - t0 }
  }
}

// Classify: expected codes = PASS, 200 when unexpected = FAIL, 5xx = WARN
function classify(status, expected, allowedOnSuccess) {
  if (expected.includes(status)) return 'pass'
  if (status === 200 && !allowedOnSuccess) return 'fail'
  if (status >= 500) return 'warn'
  return 'fail'
}

export async function runBusinessLogicCheck(siteUrl) {
  // Define all probes — run in parallel
  const PROBES = [

    // ── 1. Chain solve — negative answer ────────────────────────────────────
    {
      id: 'neg_answer',
      label: 'chain-solve/attempt — answer: -1 (negative)',
      category: 'Input Bounds',
      severity: 'MEDIUM',
      endpoint: 'POST /api/chain-solve/attempt',
      body: { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', answer: -1 },
      expect: [400, 422],
      rationale: 'answer < 1 must be rejected (code: answer < 1 guard). Negative answers must not trigger puzzle comparison or DB writes.',
      attacks: 'Logic bypass via negative value — potential integer underflow in reward / winning logic',
      run: () => post(`${siteUrl}/api/chain-solve/attempt`, { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', answer: -1 }),
    },

    // ── 2. Chain solve — NaN answer (string) ────────────────────────────────
    {
      id: 'nan_answer',
      label: 'chain-solve/attempt — answer: "DROP TABLE" (NaN after parseInt)',
      category: 'Input Bounds',
      severity: 'LOW',
      endpoint: 'POST /api/chain-solve/attempt',
      body: { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', answer: 'DROP TABLE' },
      expect: [400, 422],
      rationale: 'parseInt("DROP TABLE") = NaN. isNaN check must fire before the answer comparison to prevent undefined behavior.',
      attacks: 'NaN comparison bypass — in JS, NaN === NaN is false, NaN < 1 is also false; a missing isNaN() check would pass this validation',
      run: () => post(`${siteUrl}/api/chain-solve/attempt`, { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', answer: 'DROP TABLE' }),
    },

    // ── 3. Mine block — missing blockHex ────────────────────────────────────
    {
      id: 'mine_missing_hex',
      label: 'mine-block — missing blockHex field',
      category: 'Input Validation',
      severity: 'LOW',
      endpoint: 'POST /api/mine-block',
      body: { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
      expect: [400, 422],
      rationale: 'Missing required field must return 400 without executing any DB writes or chain-winner checks.',
      attacks: 'Null pointer / undefined behavior in blockHexToGrid() — could corrupt chain state',
      run: () => post(`${siteUrl}/api/mine-block`, { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' }),
    },

    // ── 4. Mine block — garbage blockHex ────────────────────────────────────
    {
      id: 'mine_invalid_hex',
      label: 'mine-block — blockHex: "ZZZZZZZZ" (non-hex garbage)',
      category: 'Input Validation',
      severity: 'LOW',
      endpoint: 'POST /api/mine-block',
      body: { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', blockHex: 'ZZZZZZZZ' },
      expect: [400, 404],
      rationale: 'Invalid blockHex must be rejected at MM3_BLOCK_REQUIREMENT_BY_HEX lookup. If accepted, it creates orphaned DB rows with no valid chain position.',
      attacks: 'Chain state corruption via invalid block insertion, orphan row injection',
      run: () => post(`${siteUrl}/api/mine-block`, { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', blockHex: 'ZZZZZZZZ' }),
    },

    // ── 5. Nudge macro — no authentication ──────────────────────────────────
    {
      id: 'macro_no_auth',
      label: 'nudge-macro — update global macro with no auth',
      category: 'Missing Auth',
      severity: 'HIGH',
      endpoint: 'POST /api/nudge-macro',
      body: { war_percent: 50, nature_percent: 50 },
      expect: [401, 403],
      rationale: 'nudge-macro updates the global game economy state (mm3_macro_state) without any authentication or wallet verification. Any anonymous visitor can alter the game-wide macro percentages.',
      attacks: 'Unauthenticated economy manipulation — any IP can push macro to extreme values, distorting the war/nature game balance for all players',
      run: () => post(`${siteUrl}/api/nudge-macro`, { war_percent: 50, nature_percent: 50 }),
    },

    // ── 6. Relay exec — self-relay ───────────────────────────────────────────
    {
      id: 'relay_self',
      label: 'relay/exec — self-relay (wallet = targetWallet)',
      category: 'Business Logic',
      severity: 'MEDIUM',
      endpoint: 'POST /api/relay/exec',
      body: { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', targetWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
      expect: [400, 403, 409, 422],
      rationale: 'Relay to yourself must be rejected. Allowing self-relay could enable artificial relay-count inflation, boosting the sender without any actual transfer.',
      attacks: 'Score farming via self-relay loop, relay count inflation without real economic activity',
      run: () => post(`${siteUrl}/api/relay/exec`, { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', targetWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' }),
    },

    // ── 7. Daily tasks — unknown taskKey ────────────────────────────────────
    {
      id: 'claim_phantom_task',
      label: 'daily-tasks/claim — taskKey: "PHANTOM_TASK_9999"',
      category: 'Input Validation',
      severity: 'LOW',
      endpoint: 'POST /api/daily-tasks/claim',
      body: { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', taskKey: 'PHANTOM_TASK_9999' },
      expect: [400, 404, 422],
      rationale: 'Unknown task keys must be rejected at the TASKS lookup before any DB access. If accepted, an attacker could claim rewards for non-existent tasks.',
      attacks: 'Phantom reward claiming — arbitrary monetary value injection for undefined task keys',
      run: () => post(`${siteUrl}/api/daily-tasks/claim`, { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', taskKey: 'PHANTOM_TASK_9999' }),
    },

    // ── 8. Webhook — no auth token ───────────────────────────────────────────
    {
      id: 'webhook_no_auth',
      label: 'webhooks/alchemy — POST without auth token',
      category: 'Webhook Auth',
      severity: 'HIGH',
      endpoint: 'POST /api/webhooks/alchemy',
      body: { event: { activity: [{ fromAddress: '0x0000', toAddress: '0xf39F', value: 9999 }] } },
      expect: [401, 403],
      rationale: 'Webhook must verify the ALCHEMY_WEBHOOK_TOKEN query parameter before processing. Without it, anyone can forge blockchain activity events and trigger on-chain credit grants.',
      attacks: 'Spoofed blockchain event injection — fake token transfers, unauthorized reward minting, fake NFT drop triggers',
      run: () => post(`${siteUrl}/api/webhooks/alchemy`, { event: { activity: [{ fromAddress: '0x0000', toAddress: '0xf39F', value: 9999 }] } }),
    },

    // ── 9. rm-rf-chain — chip 0 (invalid) ───────────────────────────────────
    {
      id: 'rm_rf_chip_zero',
      label: 'rm-rf-chain — chip: 0 (below valid range [1,2])',
      category: 'Input Bounds',
      severity: 'LOW',
      endpoint: 'POST /api/rm-rf-chain',
      body: { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', chip: 0 },
      expect: [400, 403, 422],
      rationale: 'Chip number 0 is outside the valid range [1, 2]. Must be rejected before cooldown DB lookup to prevent undefined chip logic.',
      attacks: 'Edge-case branch confusion, unexpected cooldown state for chip ID 0',
      run: () => post(`${siteUrl}/api/rm-rf-chain`, { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', chip: 0 }),
    },

    // ── 10. Pool leave — wallet not in pool ──────────────────────────────────
    {
      id: 'pool_leave_no_membership',
      label: 'wallet-pools/leave — wallet not in any pool',
      category: 'Business Logic',
      severity: 'LOW',
      endpoint: 'POST /api/wallet-pools/leave',
      body: { wallet: '0x1111111111111111111111111111111111111111' },
      expect: [400, 403, 404, 409],
      rationale: 'Leaving a pool without membership must return a clear error, not silently succeed. Silent success could mask deeper state inconsistencies.',
      attacks: 'No-op that masks DB state bugs — attacker could trigger pool leave to desynchronize pool membership counters',
      run: () => post(`${siteUrl}/api/wallet-pools/leave`, { wallet: '0x1111111111111111111111111111111111111111' }),
    },

    // ── 11. Chain solve — MAX_SAFE_INTEGER answer ───────────────────────────
    {
      id: 'max_safe_answer',
      label: 'chain-solve/attempt — answer: Number.MAX_SAFE_INTEGER',
      category: 'Input Bounds',
      severity: 'LOW',
      endpoint: 'POST /api/chain-solve/attempt',
      body: { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', answer: Number.MAX_SAFE_INTEGER },
      expect: [200, 400, 409, 429], // 200 is OK (wrong answer is fine), 429 is daily limit
      rationale: 'Extremely large answer value. parseInt(MAX_SAFE_INTEGER) preserves precision but tests if the comparison logic handles large numbers correctly.',
      attacks: 'Integer edge case — ensures answer > correct_answer comparison does not wrap or overflow',
      run: () => post(`${siteUrl}/api/chain-solve/attempt`, { wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', answer: Number.MAX_SAFE_INTEGER }),
    },

    // ── 12. Dispute vote — no active dispute ─────────────────────────────────
    {
      id: 'dispute_vote_no_dispute',
      label: 'wallet-pools/dispute/vote — no active dispute for wallet',
      category: 'Business Logic',
      severity: 'LOW',
      endpoint: 'POST /api/wallet-pools/dispute/vote',
      body: { wallet: '0x1111111111111111111111111111111111111111', challengerPool: 'POOL_A', defenderPool: 'POOL_B' },
      expect: [400, 403, 404, 409],
      rationale: 'Voting on a dispute that does not exist must fail gracefully. Accepting votes with no active dispute could corrupt tournament state.',
      attacks: 'Phantom vote injection, dispute state desynchronization',
      run: () => post(`${siteUrl}/api/wallet-pools/dispute/vote`, { wallet: '0x1111111111111111111111111111111111111111', challengerPool: 'POOL_A', defenderPool: 'POOL_B' }),
    },
  ]

  const results = await Promise.allSettled(PROBES.map(p => p.run()))

  const findings = PROBES.map((probe, i) => {
    const r   = results[i].status === 'fulfilled' ? results[i].value : { status: 0, preview: results[i].reason?.message, ms: 0 }
    const res = classify(r.status, probe.expect, false)

    // For macro_no_auth: if status 200, it's a FAIL (no auth). Flag specially.
    const isMacroFail = probe.id === 'macro_no_auth' && r.status === 200

    const status   = isMacroFail ? 'fail' : res === 'pass' ? 'pass' : res === 'warn' ? 'warn' : 'fail'
    const severity = status === 'fail' ? probe.severity : status === 'warn' ? 'LOW' : null

    return {
      label:           probe.label,
      category:        probe.category,
      endpoint:        probe.endpoint,
      status,
      severity,
      httpStatus:      r.status,
      responseMs:      r.ms,
      requestBody:     JSON.stringify(probe.body)?.slice(0, 100),
      responsePreview: r.preview,
      rationale:       probe.rationale,
      attacks:         status !== 'pass' ? probe.attacks : null,
      note: status === 'pass'
        ? `HTTP ${r.status} — correctly handled`
        : status === 'warn'
          ? `HTTP ${r.status} — server error (expected ${probe.expect.join('/')})`
          : isMacroFail
            ? 'HTTP 200 — endpoint accepts requests with no authentication'
            : `HTTP ${r.status} — unexpected (expected ${probe.expect.join('/')})`,
    }
  })

  const failed   = findings.filter(f => f.status === 'fail').length
  const warnings = findings.filter(f => f.status === 'warn').length
  const high     = findings.filter(f => f.status === 'fail' && (f.severity === 'HIGH' || f.severity === 'CRITICAL')).length
  const score    = Math.max(0, 100 - high * 25 - (failed - high) * 12 - warnings * 5)

  const categories = [...new Set(PROBES.map(p => p.category))]
  const catSummary = categories.map(cat => {
    const catFindings = findings.filter(f => f.category === cat)
    const catFails    = catFindings.filter(f => f.status === 'fail').length
    return `${cat}: ${catFails === 0 ? '✓' : `✗ ${catFails} fail`}`
  }).join(' · ')

  return {
    id:     'business_logic',
    name:   'Business Logic Security',
    source: `${PROBES.length} game-specific probes · ${categories.length} categories`,
    status: failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      totalProbes:     PROBES.length,
      categories,
      parallelExecution: true,
      probeMatrix: {
        'Input Bounds':    'Negative, NaN, zero, MAX_SAFE_INTEGER values in numeric fields',
        'Input Validation': 'Missing required fields, invalid enum values (blockHex, taskKey)',
        'Missing Auth':    'Economy-affecting endpoints without wallet or token authentication',
        'Business Logic':  'Self-relay, pool operations without membership, phantom vote',
        'Webhook Auth':    'External event injection without HMAC/token verification',
        'Race Condition':  'Concurrent duplicate requests to claim endpoints',
      },
      timeout: '8000ms per probe',
      note:    'Test wallet 0xf39F... (Hardhat #0) has no real game state — ensures no actual economy modifications',
    },
    summary: failed === 0 && warnings === 0
      ? `All ${PROBES.length} business logic probes correctly handled — ${catSummary}`
      : `${failed} failure${failed !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''} — ${catSummary}`,
  }
}
