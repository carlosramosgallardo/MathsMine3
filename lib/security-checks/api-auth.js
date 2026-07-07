// Every API endpoint in the app, grouped by section.
// Test: unauthenticated request with empty/minimal body → verify expected HTTP status.
// A PASS means the endpoint correctly rejects or serves the request as intended.
// A FAIL means a protected endpoint accepted the unauthenticated request (HTTP 200 unexpected).

const ENDPOINTS = [

  // ── System ─────────────────────────────────────────────────────────────────
  {
    method: 'GET', path: '/api/status', expect: [200],
    label: 'GET /api/status — public health check', section: 'System',
    rationale: 'Public status endpoint must return 200 — verifies API routing is functional.',
    body: null,
  },

  // ── Auth / Account ──────────────────────────────────────────────────────────
  {
    method: 'POST', path: '/api/create-account', expect: [400, 401, 403],
    label: 'POST /api/create-account — empty body', section: 'Auth',
    rationale: 'Account creation with no body must fail at input validation before any DB writes.',
    body: '{}',
  },

  // ── Training / Chain-Solve ──────────────────────────────────────────────────
  {
    method: 'POST', path: '/api/chain-solve/attempt', expect: [400, 401, 403],
    label: 'POST /api/chain-solve/attempt — empty body', section: 'Training',
    rationale: 'Puzzle submission requires wallet + answer. Empty body must return 400 before DB reads.',
    body: '{}',
  },
  {
    method: 'GET', path: '/api/chain-solve/status', expect: [200, 400, 404],
    label: 'GET /api/chain-solve/status — no wallet param', section: 'Training',
    rationale: 'Status without wallet param should fail gracefully, not expose other wallet data.',
    body: null,
  },
  {
    // CRITICAL: chain-check has NO auth and NO body validation — triggers
    // checkAndAwardChainWinner() with SERVICE_ROLE access on every POST.
    method: 'POST', path: '/api/chain-check', expect: [400, 401, 403],
    label: 'POST /api/chain-check — NO auth, NO body (CRITICAL)',
    section: 'Training',
    rationale: 'chain-check triggers the chain winner evaluation with Supabase SERVICE_ROLE access and NO authentication. Any anonymous caller can repeatedly invoke this privileged operation.',
    attacks: 'DoS via repeated winner-check triggering, potential race condition to influence winner selection, service-role DB operation by unauthenticated caller',
    severity: 'HIGH',
    body: '{}',
  },

  // ── Mining ──────────────────────────────────────────────────────────────────
  {
    method: 'POST', path: '/api/mine-block', expect: [400, 401, 403],
    label: 'POST /api/mine-block — empty body', section: 'Mining',
    rationale: 'Mining requires valid wallet + blockHex. Empty body must reject before chain queries.',
    body: '{}',
  },
  {
    method: 'GET', path: '/api/mining-snapshot', expect: [200],
    label: 'GET /api/mining-snapshot — public snapshot', section: 'Mining',
    rationale: 'Mining snapshot is intentionally public — should return 200. Verifies no accidental auth regression.',
    body: null,
  },
  {
    method: 'POST', path: '/api/rm-rf-chain', expect: [400, 401, 403],
    label: 'POST /api/rm-rf-chain — empty body', section: 'Mining',
    rationale: 'Chain wipe command requires valid wallet + chip. Empty body must be rejected.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/exec-hidden-cmd', expect: [400, 401, 403],
    label: 'POST /api/exec-hidden-cmd — empty body', section: 'Mining',
    rationale: 'Hidden command requires wallet + command starting with /. Empty body must reject.',
    body: '{}',
  },

  // ── Relaying ────────────────────────────────────────────────────────────────
  {
    method: 'POST', path: '/api/relay/exec', expect: [400, 401, 403],
    label: 'POST /api/relay/exec — empty body', section: 'Relaying',
    rationale: 'Relay execution is a privileged economic action — must reject with no wallet.',
    body: '{}',
  },

  // ── Game Engine / Bot ────────────────────────────────────────────────────────
  {
    method: 'GET', path: '/api/bot/tick', expect: [401],
    label: 'GET /api/bot/tick — no auth header', section: 'Game Engine',
    rationale: 'Bot tick is an internal action — must require CRON_SECRET authorization header.',
    body: null,
  },

  // ── Economy ─────────────────────────────────────────────────────────────────
  {
    // nudge-macro uses clampMacroPercent and ANON key but has ZERO auth — anyone
    // can alter the global game economy state (war_percent, nature_percent).
    method: 'POST', path: '/api/nudge-macro', expect: [401, 403],
    label: 'POST /api/nudge-macro — no auth (unauthenticated economy mutation)',
    section: 'Economy',
    rationale: 'nudge-macro updates mm3_macro_state (global game economy) with NO wallet or token auth. Any anonymous visitor can shift the war/nature balance for all players.',
    attacks: 'Unauthenticated game state manipulation — spam requests to hold macro at extremes, economy griefing',
    severity: 'HIGH',
    body: '{"war_percent":50,"nature_percent":50}',
  },
  {
    method: 'GET', path: '/api/token-value', expect: [200],
    label: 'GET /api/token-value — public market data', section: 'Economy',
    rationale: 'Token value is public market data — should return 200 without auth.',
    body: null,
  },
  {
    method: 'GET', path: '/api/token-history', expect: [200],
    label: 'GET /api/token-history — public chart data', section: 'Economy',
    rationale: 'Token history is public — should return 200. Verifies chart data API is operational.',
    body: null,
  },
  {
    method: 'GET', path: '/api/nft-events', expect: [200],
    label: 'GET /api/nft-events — public NFT events', section: 'Economy',
    rationale: 'NFT event log is public — should return 200 without auth.',
    body: null,
  },

  // ── Daily Tasks ──────────────────────────────────────────────────────────────
  {
    method: 'POST', path: '/api/daily-tasks/claim', expect: [400, 401, 403],
    label: 'POST /api/daily-tasks/claim — empty body', section: 'Daily Tasks',
    rationale: 'Task claim requires valid wallet + taskKey. Empty body must be rejected before any DB reads.',
    body: '{}',
  },

  // ── Ranking ──────────────────────────────────────────────────────────────────
  {
    method: 'GET', path: '/api/leaderboard', expect: [200],
    label: 'GET /api/leaderboard — public ranking', section: 'Ranking',
    rationale: 'Leaderboard is public — should return 200. Confirms ranking API is up.',
    body: null,
  },

  // ── Wallet Pools ─────────────────────────────────────────────────────────────
  {
    method: 'POST', path: '/api/wallet-pools/accept', expect: [400, 401, 403],
    label: 'POST /api/wallet-pools/accept — empty body', section: 'Wallet Pools',
    rationale: 'Pool invite acceptance requires wallet + inviteId. Empty body must be rejected.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/wallet-pools/decline', expect: [400, 401, 403],
    label: 'POST /api/wallet-pools/decline — empty body', section: 'Wallet Pools',
    rationale: 'Pool invite decline requires wallet + inviteId. Empty body must be rejected.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/wallet-pools/contact', expect: [400, 401, 403],
    label: 'POST /api/wallet-pools/contact — empty body', section: 'Wallet Pools',
    rationale: 'Pool contact (invite creation) requires a wallet. Empty body must be rejected.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/wallet-pools/leave', expect: [400, 401, 403],
    label: 'POST /api/wallet-pools/leave — empty body', section: 'Wallet Pools',
    rationale: 'Pool leave requires a wallet. Empty body must be rejected before DB operations.',
    body: '{}',
  },
  {
    method: 'GET', path: '/api/wallet-pools/disputes', expect: [200],
    label: 'GET /api/wallet-pools/disputes — public disputes list', section: 'Wallet Pools',
    rationale: 'Active disputes list should be publicly readable for transparency.',
    body: null,
  },

  // ── Disputes ─────────────────────────────────────────────────────────────────
  {
    method: 'POST', path: '/api/wallet-pools/dispute/vote', expect: [400, 401, 403],
    label: 'POST /api/wallet-pools/dispute/vote — empty body', section: 'Disputes',
    rationale: 'Dispute vote requires wallet + pool fields. Empty body must reject before any vote recording.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/wallet-pools/dispute/join', expect: [400, 401, 403],
    label: 'POST /api/wallet-pools/dispute/join — empty body', section: 'Disputes',
    rationale: 'Dispute join requires wallet. Empty body must be rejected.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/wallet-pools/dispute/start-battle', expect: [400, 401, 403],
    label: 'POST /api/wallet-pools/dispute/start-battle — empty body', section: 'Disputes',
    rationale: 'Battle start requires disputeId. Empty body must be rejected.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/wallet-pools/dispute/cancel', expect: [400, 401, 403],
    label: 'POST /api/wallet-pools/dispute/cancel — empty body', section: 'Disputes',
    rationale: 'Dispute cancel requires disputeId. Empty body must be rejected.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/wallet-pools/dispute/resolve', expect: [400, 401, 403],
    label: 'POST /api/wallet-pools/dispute/resolve — empty body', section: 'Disputes',
    rationale: 'Dispute resolution requires disputeId — must reject empty body without executing state changes.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/wallet-pools/dispute/claim-nftji-drop', expect: [400, 401, 403],
    label: 'POST /api/wallet-pools/dispute/claim-nftji-drop — empty body', section: 'Disputes',
    rationale: 'NFT drop claim requires disputeId + wallet. Empty body must reject before any NFT transfer.',
    body: '{}',
  },

  // ── Webhooks ──────────────────────────────────────────────────────────────────
  {
    method: 'POST', path: '/api/webhooks/alchemy', expect: [401, 403],
    label: 'POST /api/webhooks/alchemy — no token param', section: 'Webhooks',
    rationale: 'Webhook must verify ALCHEMY_WEBHOOK_TOKEN before processing any events. No token → 401.',
    body: '{}',
  },

  // ── PvP / Health ─────────────────────────────────────────────────────────────
  {
    method: 'GET', path: '/api/pvp-hit', expect: [400],
    label: 'GET /api/pvp-hit — no wallet param', section: 'PvP',
    rationale: 'Public HP read — wallet param required. Missing wallet must return 400 before any DB query.',
    body: null,
  },
  {
    method: 'POST', path: '/api/pvp-hit', expect: [400, 401, 403],
    label: 'POST /api/pvp-hit — empty body', section: 'PvP',
    rationale: 'Hit requires attacker + victim fields. Empty body must return 400 before DB queries or damage application.',
    body: '{}',
  },
  {
    method: 'GET', path: '/api/pvp-death', expect: [400],
    label: 'GET /api/pvp-death — no wallet param', section: 'PvP',
    rationale: 'Public dead-state read — wallet param required. Missing wallet must return 400.',
    body: null,
  },
  {
    method: 'PATCH', path: '/api/pvp-death', expect: [400, 401, 403],
    label: 'PATCH /api/pvp-death — empty body', section: 'PvP',
    rationale: 'Position persistence requires wallet + row + col. Empty body must return 400 before DB upsert.',
    body: '{}',
  },
  {
    // CRITICAL: pvp-death POST writes a 5-min kill state with NO authentication
    method: 'POST', path: '/api/pvp-death', expect: [401, 403],
    label: 'POST /api/pvp-death — write kill with no auth (CRITICAL)',
    section: 'PvP',
    rationale: 'pvp-death POST upserts pvp_dead_until for any wallet via SERVICE_ROLE with NO authentication or signature check. Any unauthenticated caller with a target wallet address can instantly force-kill any player.',
    attacks: 'Griefing via forced kill injection — any IP can lock out any wallet for 5 minutes per request, disabling mining, training, relaying, and PvP for the victim',
    severity: 'CRITICAL',
    body: '{"wallet":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","gx":14.5,"gy":14.5}',
  },
  {
    // HIGH: DELETE pvp-death clears death state with NO authentication
    method: 'DELETE', path: '/api/pvp-death?wallet=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', expect: [401, 403],
    label: 'DELETE /api/pvp-death — clear death with no auth (HIGH)',
    section: 'PvP',
    rationale: 'pvp-death DELETE clears pvp_dead_until for any wallet with NO authentication. Anyone can revive any dead player, bypassing the 5-minute death penalty.',
    attacks: 'Death penalty bypass — revive own or any wallet instantly, maintaining post-kill stats without serving the cooldown',
    severity: 'HIGH',
    body: null,
  },
  {
    method: 'POST', path: '/api/stormroll-damage', expect: [400, 409],
    label: 'POST /api/stormroll-damage — empty body', section: 'PvP',
    rationale: 'StormRoll damage requires wallet field. Empty body must return 400. Outside dice window (most of the time), even a valid wallet returns 409 dice_not_active.',
    body: '{}',
  },

  // ── World Bosses (M3 Putin · M4 Kim · M5 Trump) ──────────────────────────────
  // GET boss endpoints are public read-only state (health/state); POST attack/hit
  // must reject unauthenticated/empty bodies before any HP write. The */idle
  // endpoints are intentionally NOT probed here: hitting them mutates live boss
  // state (can pull a boss out of an active fight), which is a scan side-effect.
  {
    method: 'GET', path: '/api/m3-boss', expect: [200],
    label: 'GET /api/m3-boss — public boss state', section: 'World Bosses',
    rationale: 'Boss state (health/state) is public read-only — should return 200.',
    body: null,
  },
  {
    method: 'GET', path: '/api/m4-boss', expect: [200],
    label: 'GET /api/m4-boss — public boss state', section: 'World Bosses',
    rationale: 'Boss state (health/state) is public read-only — should return 200.',
    body: null,
  },
  {
    method: 'GET', path: '/api/m5-boss', expect: [200],
    label: 'GET /api/m5-boss — public boss state', section: 'World Bosses',
    rationale: 'Boss state (health/state) is public read-only — should return 200.',
    body: null,
  },
  {
    method: 'POST', path: '/api/m3-boss/attack', expect: [400, 403],
    label: 'POST /api/m3-boss/attack — empty body', section: 'World Bosses',
    rationale: 'Boss-on-player damage requires wallet + positions. Empty body must reject before any HP write.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/m4-boss/attack', expect: [400, 403],
    label: 'POST /api/m4-boss/attack — empty body', section: 'World Bosses',
    rationale: 'Boss-on-player damage requires wallet + positions. Empty body must reject before any HP write.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/m5-boss/attack', expect: [400, 403],
    label: 'POST /api/m5-boss/attack — empty body', section: 'World Bosses',
    rationale: 'Boss-on-player damage requires wallet + positions. Empty body must reject before any HP write.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/m3-boss/hit', expect: [400, 403],
    label: 'POST /api/m3-boss/hit — empty body', section: 'World Bosses',
    rationale: 'Player-on-boss hit requires wallet + positions. Empty body must reject before boss HP write.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/m4-boss/hit', expect: [400, 403],
    label: 'POST /api/m4-boss/hit — empty body', section: 'World Bosses',
    rationale: 'Player-on-boss hit requires wallet + positions. Empty body must reject before boss HP write.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/m5-boss/hit', expect: [400, 403],
    label: 'POST /api/m5-boss/hit — empty body', section: 'World Bosses',
    rationale: 'Player-on-boss hit requires wallet + positions. Empty body must reject before boss HP write.',
    body: '{}',
  },

  // ── Node Dice ────────────────────────────────────────────────────────────────
  {
    method: 'GET', path: '/api/node-dice', expect: [200],
    label: 'GET /api/node-dice — public dice state', section: 'Node Dice',
    rationale: 'Current Node Dice ownership/mode is public read-only — should return 200.',
    body: null,
  },

  // ── Mining (buy/resell/redeem/demine) ────────────────────────────────────────
  {
    method: 'POST', path: '/api/mining/nftji-buy', expect: [400, 401, 403],
    label: 'POST /api/mining/nftji-buy — empty body', section: 'Mining',
    rationale: 'NFTJI purchase requires wallet + level. Empty body must reject before economy writes.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/mining/nftji-resell', expect: [400, 401, 403],
    label: 'POST /api/mining/nftji-resell — empty body', section: 'Mining',
    rationale: 'NFTJI resell requires wallet + level. Empty body must reject before economy writes.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/mining/code-redeem', expect: [400, 401, 403],
    label: 'POST /api/mining/code-redeem — empty body', section: 'Mining',
    rationale: 'Code redemption requires wallet. Empty body must reject before economy writes.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/chain-solve/demine', expect: [400, 403, 409],
    label: 'POST /api/chain-solve/demine — empty body', section: 'Mining',
    rationale: 'Demine reward requires wallet. Empty body must reject; anon gets 403.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/resell-nftji', expect: [400, 404],
    label: 'POST /api/resell-nftji — empty body', section: 'Mining',
    rationale: 'NFTJI block resell requires a valid payload. Empty body must reject before DB writes.',
    body: '{}',
  },

  // ── PvP / Movement ───────────────────────────────────────────────────────────
  {
    method: 'POST', path: '/api/pvp-anon-kill', expect: [400, 403],
    label: 'POST /api/pvp-anon-kill — empty body', section: 'PvP',
    rationale: 'Anon-kill requires attacker/victim params. Empty body must reject.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/pool-heal', expect: [400, 403, 409],
    label: 'POST /api/pool-heal — empty body', section: 'PvP',
    rationale: 'Pool heal requires a valid wallet. Empty body must reject before HP writes.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/rl-mount', expect: [400, 403],
    label: 'POST /api/rl-mount — empty body', section: 'Mining',
    rationale: 'RL Mount purchase requires wallet. Empty body must reject before economy writes.',
    body: '{}',
  },

  // ── Economy (trade / penalties) ──────────────────────────────────────────────
  {
    method: 'POST', path: '/api/trade/exec', expect: [400, 401, 403],
    label: 'POST /api/trade/exec — empty body', section: 'Economy',
    rationale: 'Trade execution requires wallet + level. Empty body must reject before economy writes.',
    body: '{}',
  },
  {
    method: 'GET', path: '/api/token-history-minutes', expect: [200],
    label: 'GET /api/token-history-minutes — public chart data', section: 'Economy',
    rationale: 'Minute-resolution chart data is public — should return 200.',
    body: null,
  },
  {
    method: 'POST', path: '/api/redeem-penalty', expect: [400, 404],
    label: 'POST /api/redeem-penalty — empty body', section: 'Economy',
    rationale: 'Penalty redemption requires params. Empty body must reject before DB writes.',
    body: '{}',
  },
  {
    method: 'POST', path: '/api/relay/penalize', expect: [400, 401, 403],
    label: 'POST /api/relay/penalize — empty body', section: 'Relaying',
    rationale: 'Penalize requires an updates array of valid wallets. Empty body must reject.',
    body: '{}',
  },

  // ── Wallet Pools (read endpoints) ────────────────────────────────────────────
  {
    method: 'GET', path: '/api/wallet-pools/my-pool', expect: [200],
    label: 'GET /api/wallet-pools/my-pool — no wallet param', section: 'Wallet Pools',
    rationale: 'Without a wallet param it returns pool_code:null (200), never another wallet’s data.',
    body: null,
  },
  {
    method: 'GET', path: '/api/wallet-pools/invites', expect: [200, 400],
    label: 'GET /api/wallet-pools/invites — no wallet param', section: 'Wallet Pools',
    rationale: 'Invites list without a wallet param must not expose other wallets’ invitations.',
    body: null,
  },
  {
    method: 'GET', path: '/api/wallet-pools/cooldown', expect: [200, 400],
    label: 'GET /api/wallet-pools/cooldown — no wallet param', section: 'Wallet Pools',
    rationale: 'Pool cooldown status without a wallet param must fail gracefully.',
    body: null,
  },

  // ── System (public reads) ────────────────────────────────────────────────────
  {
    method: 'GET', path: '/api/portal-status', expect: [200],
    label: 'GET /api/portal-status — public portal stats', section: 'System',
    rationale: 'Aggregate portal stats are public — should return 200.',
    body: null,
  },
  {
    method: 'GET', path: '/api/pools-quick', expect: [200],
    label: 'GET /api/pools-quick — public pool summary', section: 'Wallet Pools',
    rationale: 'Quick pool summary is public read-only — should return 200.',
    body: null,
  },
  {
    method: 'GET', path: '/api/home-minimap', expect: [200],
    label: 'GET /api/home-minimap — public minimap data', section: 'Mining',
    rationale: 'Home minimap data is public read-only — should return 200.',
    body: null,
  },
  {
    method: 'GET', path: '/api/security/history', expect: [200, 400],
    label: 'GET /api/security/history — public scan history', section: 'System',
    rationale: 'Security scan history backs the public /security page — should return 200.',
    body: null,
  },
]

const REQUEST_HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json' }

export async function runApiAuthCheck(siteUrl) {
  const results = await Promise.allSettled(
    ENDPOINTS.map(async ep => {
      const t0 = Date.now()
      let status = 0
      let responsePreview = null
      try {
        const res = await fetch(`${siteUrl}${ep.path}`, {
          method: ep.method,
          headers: REQUEST_HEADERS,
          body: ep.body ?? undefined,
          signal: AbortSignal.timeout(8000),
        })
        status = res.status
        try { responsePreview = (await res.text()).slice(0, 100) } catch {}
      } catch (e) {
        responsePreview = e.message?.slice(0, 80)
      }
      return { status, responsePreview, ms: Date.now() - t0 }
    })
  )

  const sections = [...new Set(ENDPOINTS.map(ep => ep.section))]

  const findings = ENDPOINTS.map((ep, i) => {
    const r    = results[i].status === 'fulfilled' ? results[i].value : { status: 0, responsePreview: results[i].reason?.message, ms: 0 }
    const pass = ep.expect.includes(r.status)
    const effectiveSeverity = ep.severity ?? (pass ? null : 'HIGH')

    return {
      label:           ep.label,
      section:         ep.section,
      endpoint:        `${ep.method} ${ep.path}`,
      expected:        ep.expect,
      actual:          r.status,
      status:          pass ? 'pass' : 'fail',
      severity:        pass ? null : effectiveSeverity,
      rationale:       ep.rationale,
      attacks:         pass ? null : (ep.attacks ?? 'Unauthenticated access to protected endpoint — attacker can trigger or read privileged data without credentials'),
      requestBody:     ep.body,
      responseMs:      r.ms,
      responsePreview: r.responsePreview,
    }
  })

  const failed   = findings.filter(f => f.status === 'fail').length
  const high     = findings.filter(f => f.status === 'fail' && f.severity === 'HIGH').length
  const score    = Math.round(((findings.length - failed) / findings.length) * 100)

  const sectionSummary = sections.map(sec => {
    const secFinds = findings.filter(f => f.section === sec)
    const secFails = secFinds.filter(f => f.status === 'fail').length
    return `${sec}: ${secFails === 0 ? '✓' : `✗ ${secFails} fail`}`
  }).join(' · ')

  return {
    id:     'api_auth',
    name:   'API Authentication',
    source: `Unauthenticated probes · ${ENDPOINTS.length} endpoints · ${sections.length} sections`,
    status: failed === 0 ? 'pass' : failed >= Math.ceil(findings.length / 4) ? 'fail' : 'warn',
    score,
    findings,
    probeDetails: {
      targetBase:       siteUrl,
      endpointsTested:  ENDPOINTS.length,
      sections,
      strategy:         'Unauthenticated HTTP requests — no Authorization header, no session cookie, no API key, no wallet signature',
      requestHeaders:   REQUEST_HEADERS,
      passCondition:    'Expected HTTP status received (4xx for protected, 200 for public)',
      failCondition:    'HTTP 200 on endpoint expected to require auth — attacker can operate without credentials',
      timeout:          '8000ms per endpoint',
    },
    summary: failed === 0
      ? `All ${findings.length} endpoints respond correctly to unauthenticated requests — ${sectionSummary}`
      : `${failed} endpoint${failed > 1 ? 's' : ''} may be unprotected (${high} HIGH) — ${sectionSummary}`,
  }
}
