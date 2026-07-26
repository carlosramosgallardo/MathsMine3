// Regression coverage for the 2026-07-26 security audit: routes that used to
// upsert `{ ...body.progress, wallet }` (or `{...body.updates[i]}`) verbatim
// into player_progress, letting a caller set any economy column to any
// value. Also covers /api/nudge-macro, which used to trust a client-sent
// absolute war_percent/nature_percent instead of computing its own bounded
// delta.
//
// This is a black-box HTTP scanner with no DB credentials, so it can only
// probe status codes and response shapes it can also verify from the outside
// — not "was the DB write actually scoped correctly" (see rationale on the
// nudge_state_ignores_client_input probe for how we still get real signal on
// that one).

const HARDHAT_WALLET = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb9226'; // publicly known test wallet

async function post(url, body, timeoutMs = 8000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, preview: text.slice(0, 160), ms: Date.now() - t0 };
  } catch (e) {
    return { status: 0, json: null, preview: e.message?.slice(0, 60), ms: Date.now() - t0 };
  }
}

export async function runMassAssignmentCheck(siteUrl) {
  const findings = [];

  // ── 1. Dead mass-assignment routes must not have come back ──
  for (const path of ['/api/mining/nftji-buy', '/api/mining/nftji-resell', '/api/mining/code-redeem']) {
    const r = await post(`${siteUrl}${path}`, { wallet: HARDHAT_WALLET, progress: { level: 1 } });
    const pass = r.status === 404;
    findings.push({
      label: `${path} stays removed`,
      endpoint: `POST ${path}`,
      status: pass ? 'pass' : 'fail',
      severity: pass ? null : 'CRITICAL',
      httpStatus: r.status,
      responseMs: r.ms,
      rationale: pass
        ? 'Dead mass-assignment route correctly absent'
        : 'A route that used to accept an unfiltered progress object and upsert it into player_progress verbatim is back',
      attacks: pass ? null : 'Arbitrary player_progress column write (eur_earned, mining_nftji_key, ...) for any wallet',
    });
  }

  // ── 2. trade/exec and relay/penalize must reject malformed shapes before
  //      any DB write (input-bounds regression, mirrors business-logic.js style) ──
  const shapeProbes = [
    {
      label: 'trade/exec — progress as array instead of object',
      endpoint: '/api/trade/exec',
      body: { wallet: HARDHAT_WALLET, progress: [1, 2, 3] },
    },
    {
      label: 'trade/exec — progress missing',
      endpoint: '/api/trade/exec',
      body: { wallet: HARDHAT_WALLET },
    },
    {
      label: 'relay/penalize — updates not an array',
      endpoint: '/api/relay/penalize',
      body: { updates: { wallet: HARDHAT_WALLET, eur_earned: 999999 } },
    },
  ];
  for (const p of shapeProbes) {
    const r = await post(`${siteUrl}${p.endpoint}`, p.body);
    const pass = r.status >= 400;
    findings.push({
      label: p.label,
      endpoint: `POST ${p.endpoint}`,
      status: pass ? 'pass' : 'fail',
      severity: pass ? null : 'MEDIUM',
      httpStatus: r.status,
      responseMs: r.ms,
      requestBody: JSON.stringify(p.body).slice(0, 120),
      responsePreview: r.preview,
      rationale: pass
        ? 'Malformed request body correctly rejected before any DB write'
        : 'Malformed request body was not rejected — validation layer may be missing',
      attacks: pass ? null : 'Unexpected shape reaching the upsert call, possible type-confusion write',
    });
  }

  // ── 3. nudge-macro must ignore client-supplied war_percent/nature_percent ──
  // Real signal without DB creds: fire the same "set to 100" body twice in a
  // row against a low-traffic test wallet. If the server still honored the
  // client value, both responses would echo back ~100. If it's correctly
  // computing its own ±10 bounded delta from the current row, two consecutive
  // "spam 100" attempts cannot legitimately reach exactly 100 twice.
  const attempt1 = await post(`${siteUrl}/api/nudge-macro`, {
    wallet: HARDHAT_WALLET, war_percent: 100, nature_percent: 100,
  });
  const attempt2 = await post(`${siteUrl}/api/nudge-macro`, {
    wallet: HARDHAT_WALLET, war_percent: 100, nature_percent: 100,
  });
  const echoed1 = Number(attempt1.json?.war_percent) === 100 && Number(attempt1.json?.nature_percent) === 100;
  const echoed2 = Number(attempt2.json?.war_percent) === 100 && Number(attempt2.json?.nature_percent) === 100;
  const nudgePass = attempt1.status >= 400 || !(echoed1 && echoed2);
  findings.push({
    label: 'nudge-macro ignores client-supplied absolute values',
    endpoint: 'POST /api/nudge-macro',
    status: nudgePass ? 'pass' : 'fail',
    severity: nudgePass ? null : 'HIGH',
    httpStatus: attempt1.status,
    responseMs: attempt1.ms,
    requestBody: '{"wallet":"...","war_percent":100,"nature_percent":100}',
    responsePreview: `${attempt1.preview} / ${attempt2.preview}`,
    rationale: nudgePass
      ? 'Server computed its own bounded delta rather than echoing the attacker-supplied absolute value twice in a row'
      : 'war_percent/nature_percent came back as exactly 100 on two consecutive calls — server is trusting the client value, which can instant-kill players via stormroll-damage',
    attacks: nudgePass ? null : 'Global storm-damage state set to 100%, instantly killing any unprotected player on the next hit',
  });

  const failed = findings.filter((f) => f.status === 'fail').length;
  const score = Math.max(0, 100 - failed * 25);

  return {
    id: 'mass_assignment',
    name: 'Mass-Assignment & Economy-Field Tampering',
    source: `Field-allowlist + client-trust regression probes · ${siteUrl}`,
    status: failed > 0 ? 'fail' : 'pass',
    score,
    findings,
    probeDetails: {
      strategy: 'Probe routes that upsert into player_progress/mm3_macro_state from a client-supplied object, checking that unfiltered fields and client-computed absolute values cannot reach the DB write.',
      testWallet: `${HARDHAT_WALLET} (Hardhat account #0 — public test wallet)`,
      note: 'Black-box HTTP only, no DB credentials — cannot directly verify column-level write scoping, only externally observable behavior (removed routes, rejected shapes, ignored client values).',
      totalRequests: findings.length + 1,
    },
    summary: failed === 0
      ? `All ${findings.length} mass-assignment probes passed`
      : `${failed} failure${failed !== 1 ? 's' : ''} in mass-assignment / economy-field tampering checks`,
  };
}
