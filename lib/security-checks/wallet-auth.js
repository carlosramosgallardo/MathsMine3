// Public test wallets — private keys are universally known.
// Derived from the standard Hardhat/Foundry/Ganache mnemonic:
// "test test test test test test test test test test test junk" (BIP-39)
const TEST_WALLETS = [
  {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    label: 'Hardhat account #0',
    privKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    note: 'Index 0 of standard Hardhat/Foundry mnemonic — private key is public knowledge',
  },
  {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    label: 'Hardhat account #1',
    privKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    note: 'Index 1 of standard Hardhat/Foundry mnemonic — private key is public knowledge',
  },
  {
    address: '0x0000000000000000000000000000000000000000',
    label: 'Zero address (null/burn address)',
    privKey: null,
    note: 'Ethereum null address — no valid ECDSA private key exists for this address',
  },
]

// Endpoints that require wallet ownership proof
const CLAIM_ENDPOINT  = '/api/daily-tasks/claim'
const CREATE_ENDPOINT = '/api/create-account'

async function probe(url, body, timeoutMs = 8000) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await res.text().catch(() => '')
    return { status: res.status, preview: text.slice(0, 120), ms: Date.now() - t0 }
  } catch (e) {
    return { status: 0, preview: e.message?.slice(0, 60), ms: Date.now() - t0 }
  }
}

export async function runWalletAuthCheck(siteUrl) {
  const findings = []

  // ── 1. Signature bypass: claim tasks as each public test wallet (no ECDSA sig) ──
  for (const w of TEST_WALLETS) {
    const r = await probe(`${siteUrl}${CLAIM_ENDPOINT}`, { wallet: w.address })
    const pass = r.status >= 400

    findings.push({
      label:           `Signature bypass — ${w.label}`,
      endpoint:        `POST ${CLAIM_ENDPOINT}`,
      status:          pass ? 'pass' : 'fail',
      severity:        pass ? null : 'CRITICAL',
      httpStatus:      r.status,
      responseMs:      r.ms,
      requestBody:     `{"wallet":"${w.address}"}`,
      responsePreview: r.preview,
      rationale: pass
        ? 'Correctly rejected — server does not accept bare wallet address without signature'
        : 'Server accepted a wallet claim with no ECDSA signature. Anyone can impersonate any wallet.',
      attacks: pass ? null : 'Wallet impersonation, unauthorized reward claiming, game economy manipulation',
      walletNote: w.note,
    })
  }

  // ── 2. SQL injection via wallet field ──
  const sqlPayloads = [
    { payload: "' OR '1'='1",       label: "Classic OR injection" },
    { payload: "'; DROP TABLE--",   label: "DROP TABLE attempt" },
  ]
  for (const { payload, label } of sqlPayloads) {
    const r = await probe(`${siteUrl}${CLAIM_ENDPOINT}`, { wallet: payload })
    const pass = r.status >= 400

    findings.push({
      label:           `SQL injection — ${label}`,
      endpoint:        `POST ${CLAIM_ENDPOINT}`,
      status:          pass ? 'pass' : 'fail',
      severity:        pass ? null : 'CRITICAL',
      httpStatus:      r.status,
      responseMs:      r.ms,
      requestBody:     `{"wallet":"${payload}"}`,
      responsePreview: r.preview,
      rationale: pass
        ? 'Injection string correctly rejected — parameterized queries or input validation in place'
        : 'SQL injection payload not rejected — possible query injection vulnerability',
      attacks: pass ? null : 'SQL injection, authentication bypass, database dump',
    })
  }

  // ── 3. Account enumeration: do error messages differ for existing vs unknown wallets? ──
  // Use two structurally valid Ethereum addresses — one that exists in the game, one that does not.
  // We compare response bodies to detect information leakage.
  const [rKnown, rUnknown] = await Promise.all([
    probe(`${siteUrl}${CREATE_ENDPOINT}`, { wallet: TEST_WALLETS[0].address }),
    probe(`${siteUrl}${CREATE_ENDPOINT}`, { wallet: '0x1111111111111111111111111111111111111111' }),
  ])

  const normalize = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
  const knownNorm   = normalize(rKnown.preview)
  const unknownNorm = normalize(rUnknown.preview)

  const enumerationKeywords = ['exist', 'already', 'taken', 'registered', 'found', 'duplicate']
  const leaks = enumerationKeywords.some(k => knownNorm.includes(k) || unknownNorm.includes(k))
    && knownNorm !== unknownNorm

  findings.push({
    label:           'Account enumeration via create-account',
    endpoint:        `POST ${CREATE_ENDPOINT}`,
    status:          leaks ? 'warn' : 'pass',
    severity:        leaks ? 'LOW' : null,
    httpStatus:      null,
    responseMs:      Math.max(rKnown.ms, rUnknown.ms),
    requestBody:     'wallet: <hardhat#0 known> vs wallet: <0x1111...1111 unknown>',
    responsePreview: `Known: ${rKnown.preview?.slice(0, 60)} | Unknown: ${rUnknown.preview?.slice(0, 60)}`,
    rationale: leaks
      ? 'Different error messages for known vs unknown wallets — allows enumeration of registered accounts'
      : 'Error responses do not clearly distinguish existing from non-existing wallets',
    attacks: leaks ? 'Account enumeration — attacker discovers which wallets are registered in the game' : null,
  })

  // ── 4. Malformed / oversized wallet field ──
  const malformed = [
    { wallet: 'not-a-wallet',  label: 'Non-hex wallet string' },
    { wallet: '0x' + 'a'.repeat(200), label: 'Oversized wallet (200-char hex)' },
  ]
  for (const { wallet, label } of malformed) {
    const r = await probe(`${siteUrl}${CLAIM_ENDPOINT}`, { wallet })
    const pass = r.status >= 400

    findings.push({
      label:           `Input validation — ${label}`,
      endpoint:        `POST ${CLAIM_ENDPOINT}`,
      status:          pass ? 'pass' : 'fail',
      severity:        pass ? null : 'MEDIUM',
      httpStatus:      r.status,
      responseMs:      r.ms,
      requestBody:     `{"wallet":"${wallet.slice(0, 40)}..."}`,
      responsePreview: r.preview,
      rationale: pass
        ? 'Malformed wallet correctly rejected at input validation layer'
        : 'Malformed wallet not rejected — input validation may be missing',
      attacks: pass ? null : 'Buffer overflow attempt, unexpected state corruption, bypass via type confusion',
    })
  }

  const failed   = findings.filter(f => f.status === 'fail').length
  const warnings = findings.filter(f => f.status === 'warn').length
  const critical = findings.filter(f => f.severity === 'CRITICAL').length
  const score    = Math.max(0, 100 - critical * 40 - failed * 15 - warnings * 5)

  const totalReqs = TEST_WALLETS.length + sqlPayloads.length + 2 + malformed.length

  return {
    id: 'wallet_auth',
    name: 'Web3 Wallet Authentication',
    source: `Signature bypass probes · public test wallets · ${siteUrl}`,
    status: failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
    score,
    findings,
    probeDetails: {
      strategy: 'POST authenticated endpoints with publicly known wallet addresses but NO ECDSA signature — verifies the server requires cryptographic proof of wallet ownership',
      testWallets: TEST_WALLETS.map(w => `${w.address} (${w.label})`),
      hardhatMnemonic: '"test test test test test test test test test test test junk" — BIP-39 standard, universally public',
      zeroAddress: '0x000...000 — no valid private key exists; any server accepting it has a critical auth bypass',
      enumerationTest: 'Compare create-account responses for known vs unknown wallets to detect info leakage',
      injectionTest: 'SQL injection strings in wallet field (expect rejection — Supabase uses parameterized queries)',
      inputValidationTest: 'Malformed / oversized wallet strings — checks input sanitisation layer',
      totalRequests: totalReqs,
      timeout: '8000ms per request',
      note: 'No Google OAuth probed — this project uses wallet-based identity, not OAuth2 flows',
    },
    summary: failed === 0 && warnings === 0
      ? `All ${findings.length} wallet auth probes correctly rejected — signature enforcement verified`
      : `${failed} failure${failed !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''} in wallet auth security`,
  }
}
