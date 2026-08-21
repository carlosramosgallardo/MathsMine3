export const API_BASE_URL = 'https://mathsmine3.xyz'

const SESSION = "Authorization: Bearer $MM3_SESSION"
const CRON = "Authorization: Bearer $CRON_SECRET"

/** @typedef {'none'|'session'|'cron'|'webhook'} AuthKind */

/**
 * @param {object} ep
 * @param {string} ep.method
 * @param {string} ep.path
 * @param {string} [ep.requestSample]
 * @param {AuthKind} [ep.auth]
 * @param {string} [ep.authHeader]
 */
export function buildCurl(ep, baseUrl = API_BASE_URL) {
  const url = `${baseUrl}${ep.path}`
  const lines = [`curl -sS -X ${ep.method} '${url}'`]
  if (ep.method !== 'GET' && ep.method !== 'DELETE') {
    lines.push("  -H 'Content-Type: application/json'")
  }
  lines.push("  -H 'Accept: application/json'")
  if (ep.auth === 'session') {
    lines.push(`  -H '${SESSION}'`)
  } else if (ep.auth === 'cron') {
    lines.push(`  -H '${CRON}'`)
  } else if (ep.auth === 'webhook') {
    lines.push("  -H 'Content-Type: application/json'")
  }
  if (ep.requestSample && ep.method !== 'GET' && ep.method !== 'DELETE') {
    const compact = ep.requestSample.replace(/\s+/g, ' ').trim()
    lines.push(`  -d '${compact}'`)
  }
  return lines.join(' \\\n')
}

function ep(method, path, fields) {
  return { method, path, auth: 'none', publicGet: method === 'GET', ...fields }
}

function bossSection(mapId, bossNameEn, bossNameEs) {
  const base = `/api/${mapId}-boss`
  return [
    ep('GET', base, {
      titleEn: `${bossNameEn} boss state`,
      titleEs: `Estado del boss ${bossNameEs}`,
      descEn: `Public read-only HP/state for the ${bossNameEn} world boss on map ${mapId.toUpperCase()}.`,
      descEs: `Lectura pública de HP/estado del boss ${bossNameEs} en el mapa ${mapId.toUpperCase()}.`,
      responseSample: `{
  "ok": true,
  "health": 4200,
  "maxHealth": 5000,
  "state": "fighting"
}`,
    }),
    ep('POST', `${base}/attack`, {
      auth: 'session',
      titleEn: `${bossNameEn} attacks player`,
      titleEs: `${bossNameEs} ataca al jugador`,
      descEn: 'Boss-on-player damage while fighting on this map. Requires session wallet matching body.wallet.',
      descEs: 'Daño del boss al jugador durante el combate. Requiere sesión que coincida con body.wallet.',
      requestSample: `{
  "wallet": "0xabc1234567890123456789012345678901234567890",
  "gx": 14.5, "gy": 14.5, "gz": 0.2
}`,
      responseSample: `{ "ok": true, "damage": 12 }`,
    }),
    ep('POST', `${base}/hit`, {
      auth: 'session',
      titleEn: `Player hits ${bossNameEn}`,
      titleEs: `Jugador golpea a ${bossNameEs}`,
      descEn: 'Player-on-boss damage. Requires session wallet matching body.wallet.',
      descEs: 'Daño del jugador al boss. Requiere sesión que coincida con body.wallet.',
      requestSample: `{
  "wallet": "0xabc1234567890123456789012345678901234567890",
  "gx": 14.5, "gy": 14.5, "gz": 0.2
}`,
      responseSample: `{ "ok": true, "damage": 8, "bossHealth": 4192 }`,
    }),
    ep('POST', `${base}/idle`, {
      titleEn: `Reset ${bossNameEn} to idle`,
      titleEs: `Reiniciar ${bossNameEs} a idle`,
      descEn: 'Called when no fighters remain; returns boss to idle state.',
      descEs: 'Se invoca cuando no quedan luchadores; devuelve el boss a estado idle.',
      responseSample: `{ "ok": true, "state": "idle" }`,
    }),
  ]
}

/** @type {Array<{id:string,titleEn:string,titleEs:string,endpoints:object[]}>} */
export const API_SECTIONS = [
  {
    id: 'system',
    titleEn: 'System',
    titleEs: 'Sistema',
    endpoints: [
      ep('GET', '/api/status', {
        titleEn: 'Service status',
        titleEs: 'Estado del servicio',
        descEn: 'Health probe and per-IP rate-limit quota for public endpoints.',
        descEs: 'Sonda de salud y cuota de rate limit por IP en endpoints públicos.',
        responseSample: `{
  "message": "✅ Within rate limit",
  "ip": "1.2.3.4",
  "remaining": 9,
  "timestamp": "2026-04-21T06:55:34.476Z"
}`,
      }),
      ep('GET', '/api/portal-status', {
        titleEn: 'Portal status',
        titleEs: 'Estado del portal',
        descEn: 'Macro war/nature %, accent color from top wallet, active and total wallet counts.',
        descEs: 'Macro guerra/naturaleza %, color de acento del top wallet y contadores de wallets.',
        responseSample: `{
  "ok": true,
  "macro": { "war_percent": 52, "nature_percent": 48 },
  "accent": "#22d3ee",
  "activeWalletCount": 12,
  "totalWallets": 128
}`,
      }),
      ep('GET', '/api/home-minimap', {
        titleEn: 'Home minimap',
        titleEs: 'Minimapa del home',
        descEn: 'Mined blocks, market emojis, and active player positions for the home minimap.',
        descEs: 'Bloques minados, emojis de mercado y posiciones activas para el minimapa.',
        responseSample: `{
  "minedBlocks": [{ "block_hex": "#029", "wallet": "0xabc..." }],
  "marketEmojis": ["🔮"],
  "players": [{ "wallet": "0xabc...", "gx": 14, "gy": 14 }]
}`,
      }),
      ep('GET', '/api/security/history', {
        titleEn: 'Security scan history',
        titleEs: 'Histórico de auditorías',
        descEn: 'List or fetch security scan runs. Query ?limit=20 or ?id=<scanId>.',
        descEs: 'Lista o detalle de auditorías. Query ?limit=20 o ?id=<scanId>.',
        responseSample: `{
  "ok": true,
  "scans": [{ "id": "scan_abc", "createdAt": "2026-08-01T03:00:00Z", "score": 94 }]
}`,
      }),
      ep('POST', '/api/security/scan', {
        auth: 'cron',
        titleEn: 'Run security scan',
        titleEs: 'Ejecutar auditoría',
        descEn: 'Runs the full security audit suite. Requires Authorization: Bearer CRON_SECRET (Vercel cron or manual).',
        descEs: 'Ejecuta la suite de auditoría. Requiere Authorization: Bearer CRON_SECRET.',
        responseSample: `{ "ok": true, "scanId": "scan_abc", "score": 94 }`,
      }),
      ep('GET', '/api/security/scan', {
        titleEn: 'Latest security scan',
        titleEs: 'Última auditoría',
        descEn: 'Summary of the most recent completed security scan.',
        descEs: 'Resumen de la última auditoría completada.',
        responseSample: `{ "ok": true, "scanId": "scan_abc", "score": 94, "status": "complete" }`,
      }),
    ],
  },
  {
    id: 'auth',
    titleEn: 'Auth & accounts',
    titleEs: 'Auth y cuentas',
    endpoints: [
      ep('POST', '/api/auth/nonce', {
        titleEn: 'Wallet sign-in nonce',
        titleEs: 'Nonce de firma wallet',
        descEn: 'Issues a one-time nonce (token + message) for wallet signature login.',
        descEs: 'Emite un nonce de un solo uso (token + mensaje) para login por firma.',
        requestSample: `{ "wallet": "0xabc1234567890123456789012345678901234567890" }`,
        responseSample: String.raw`{
  "token": "nonce_...",
  "message": "Sign in to MathsMine3\nNonce: ..."
}`,
      }),
      ep('POST', '/api/auth/session', {
        titleEn: 'Create session',
        titleEs: 'Crear sesión',
        descEn: 'Exchange wallet signature (nonceToken + signature) or Google access_token for a Bearer session token.',
        descEs: 'Intercambia firma wallet o access_token de Google por un token Bearer de sesión.',
        requestSample: `{
  "type": "wallet",
  "wallet": "0xabc1234567890123456789012345678901234567890",
  "nonceToken": "nonce_...",
  "signature": "0x..."
}`,
        responseSample: `{
  "ok": true,
  "token": "sess_...",
  "wallet": "0xabc1234567890123456789012345678901234567890"
}`,
      }),
      ep('POST', '/api/create-account', {
        titleEn: 'Create account',
        titleEs: 'Crear cuenta',
        descEn: 'Create or ensure a player account (Google or wallet). New accounts per IP are rate-limited (5/day).',
        descEs: 'Crea o asegura una cuenta (Google o wallet). Nuevas cuentas por IP limitadas (5/día).',
        requestSample: `{
  "type": "wallet",
  "wallet": "0xabc1234567890123456789012345678901234567890"
}`,
        responseSample: `{ "ok": true, "wallet": "0xabc1234567890123456789012345678901234567890" }`,
      }),
      ep('POST', '/api/presence/ping', {
        titleEn: 'Presence ping',
        titleEs: 'Ping de presencia',
        descEn: 'Updates wallet last_seen, source, and optional disconnect flag for 3D presence.',
        descEs: 'Actualiza last_seen, origen y flag de desconexión para presencia 3D.',
        requestSample: `{
  "wallet": "0xabc1234567890123456789012345678901234567890",
  "source": "web",
  "disconnect": false
}`,
        responseSample: `{ "ok": true }`,
      }),
    ],
  },
  {
    id: 'economy',
    titleEn: 'Economy & market',
    titleEs: 'Economía y mercado',
    endpoints: [
      ep('GET', '/api/token-value', {
        titleEn: 'Token value',
        titleEs: 'Valor del token',
        descEn: 'Latest cumulative MM3 value (updated every minute). Rate-limited per IP; returns X-RateLimit-* headers.',
        descEs: 'Valor MM3 acumulado más reciente (actualizado cada minuto). Rate limit por IP.',
        responseSample: `{
  "value": 1.0234,
  "updatedAt": "2025-03-23T20:00:00Z",
  "total_eth": 0.42
}`,
      }),
      ep('GET', '/api/token-history', {
        titleEn: 'Token history',
        titleEs: 'Histórico del token',
        descEn: 'Hourly MM3 value history with per-source breakdown (up to ~83 days).',
        descEs: 'Histórico horario del valor MM3 con desglose por fuente (~83 días).',
        responseSample: `[
  {
    "hour": "2025-03-26T18:00:00Z",
    "cumulative_reward": 0.00001776,
    "delta": 0.0000012,
    "mined_delta": 0.0000009,
    "trade_delta": 0.0000003,
    "nftji_delta": 0.000001,
    "market_delta": -0.000025
  }
]`,
      }),
      ep('GET', '/api/token-history-minutes', {
        titleEn: 'Minute-level history',
        titleEs: 'Histórico por minutos',
        descEn: 'Minute-by-minute MM3 value for the last ~75–90 minutes.',
        descEs: 'Valor MM3 minuto a minuto de los últimos ~75–90 minutos.',
        responseSample: `[
  {
    "minute": "14:30",
    "value": 0.00001234,
    "delta": 0.0000001,
    "mined_delta": 0.0000001,
    "trade_delta": 0
  }
]`,
      }),
      ep('GET', '/api/nft-events', {
        titleEn: 'Market events',
        titleEs: 'Eventos de mercado',
        descEn: 'NFTJI claims, life continues, and other market events with emoji enrichment.',
        descEs: 'Claims NFTJI, continuaciones de vida y otros eventos con emoji.',
        responseSample: `[
  {
    "wallet": "0xabc...1234",
    "event_type": "nftji_claim",
    "delta_mm3": 0.000005,
    "created_at": "2025-03-26T18:30:00Z",
    "emoji": "🔮"
  }
]`,
      }),
      ep('GET', '/api/leaderboard?page=1&limit=50', {
        titleEn: 'Leaderboard',
        titleEs: 'Leaderboard',
        descEn: 'Paginated ranking by MM3 Chain contribution (default limit 50, max 200). Rate-limited per IP.',
        descEs: 'Ranking paginado por contribución MM3 Chain (límite por defecto 50, máx. 200).',
        responseSample: `{
  "page": 1,
  "limit": 50,
  "total": 128,
  "items": [
    {
      "rank": 1,
      "wallet": "0xabc...1234",
      "level": 72,
      "block_chain_percent": 2.04,
      "mined_block_count": 1,
      "available_mm3": 0.00412,
      "nftjis": ["🔮"]
    }
  ]
}`,
      }),
      ep('POST', '/api/trade/exec', {
        auth: 'session',
        titleEn: 'Execute trade',
        titleEs: 'Ejecutar trade',
        descEn: 'Buy or sell MM3. Server re-derives quotes from DB; client sends mode, currency, amount only. Max 5 trades/day.',
        descEs: 'Compra o venta MM3. El servidor recalcula cotizaciones; el cliente envía mode, currency, amount. Máx. 5/día.',
        requestSample: `{
  "mode": "buy",
  "currency": "EUR",
  "amount": 0.5
}`,
        responseSample: `{ "ok": true, "mm3Delta": 0.00012, "balanceEur": 1.36 }`,
      }),
      ep('POST', '/api/trade/zero-day-claim', {
        auth: 'session',
        titleEn: 'Zero-day trading claim',
        titleEs: 'Claim zero-day trading',
        descEn: 'Claim zero-day trading NFTJI decoration after meeting requirements.',
        descEs: 'Reclama decoración NFTJI zero-day al cumplir requisitos.',
        responseSample: `{ "ok": true, "emoji": "📈" }`,
      }),
      ep('POST', '/api/redeem-penalty', {
        titleEn: 'Redeem relay penalty',
        titleEs: 'Canjear penalización relay',
        descEn: 'Redeem a relay command penalty with the correct code.',
        descEs: 'Canjea una penalización de comando relay con el código correcto.',
        requestSample: `{ "wallet": "0xabc...", "code": "PENALTY123" }`,
        responseSample: `{ "ok": true }`,
      }),
      ep('POST', '/api/nudge-macro', {
        auth: 'session',
        titleEn: 'Nudge macro balance',
        titleEs: 'Ajustar macro guerra/naturaleza',
        descEn: 'Randomly nudges war/nature macro percentages. Requires session.',
        descEs: 'Ajusta aleatoriamente los porcentajes macro guerra/naturaleza. Requiere sesión.',
        responseSample: `{ "ok": true, "war_percent": 51, "nature_percent": 49 }`,
      }),
    ],
  },
  {
    id: 'mining',
    titleEn: 'Mining & block chain',
    titleEs: 'Minado y block chain',
    endpoints: [
      ep('GET', '/api/mining-snapshot', {
        titleEn: 'Mining snapshot',
        titleEs: 'Snapshot de minado',
        descEn: 'Mining world state: blocks, owners, minedBlocks, blockChain progress. Query ?map=1 (lighter), ?details=1, ?wallet=, ?blockKey=.',
        descEs: 'Estado del mundo 3D: bloques, dueños, minedBlocks, progreso blockChain. Query ?map=1, ?details=1, ?wallet=, ?blockKey=.',
        responseSample: `{
  "blocks": [{ "block_key": "mm3-023", "emoji": "🔮", "grid_row": 1, "grid_col": 2 }],
  "minedBlocks": [{ "block_hex": "#029", "wallet": "0xabc...", "chain_index": 1 }],
  "blockChain": { "mined": 42, "total": 784, "percent": 5.36, "code": "#0x..." }
}`,
      }),
      ep('POST', '/api/mine-block', {
        titleEn: 'Mine block',
        titleEs: 'Minar bloque',
        descEn: 'Mine a free board block from Relaying when wallet level and global MM3 value meet requirements.',
        descEs: 'Mina un bloque libre desde Relaying si wallet y valor MM3 global cumplen requisitos.',
        requestSample: `{
  "wallet": "0xabc1234567890123456789012345678901234567890",
  "blockHex": "#029"
}`,
        responseSample: `{
  "ok": true,
  "mined": {
    "block_hex": "#029",
    "wallet": "0xabc...",
    "mm3_value_hex": "D6D8C0",
    "chain_index": 1
  },
  "percent": 2.04
}`,
      }),
      ep('POST', '/api/resell-nftji', {
        auth: 'session',
        titleEn: 'Resell NFTJI block',
        titleEs: 'Revender bloque NFTJI',
        descEn: 'Resell an owned NFTJI mining block back to the market.',
        descEs: 'Revende un bloque NFTJI de minado al mercado.',
        requestSample: `{ "blockKey": "mm3-023" }`,
        responseSample: `{ "ok": true, "refundEur": 0.12 }`,
      }),
      ep('POST', '/api/chain-check', {
        auth: 'session',
        titleEn: 'Chain winner check',
        titleEs: 'Comprobar ganador de cadena',
        descEn: 'Check and award chain winner when the board is complete. Requires session.',
        descEs: 'Comprueba y otorga ganador de cadena al completar el tablero. Requiere sesión.',
        responseSample: `{ "ok": true, "winner": null }`,
      }),
      ep('GET', '/api/chain-solve/status?wallet=0xabc1234567890123456789012345678901234567890', {
        path: '/api/chain-solve/status?wallet=0xabc1234567890123456789012345678901234567890',
        titleEn: 'Chain-solve status',
        titleEs: 'Estado chain-solve',
        descEn: 'Puzzle status and solver counts. Requires ?wallet=.',
        descEs: 'Estado del puzzle y contadores de solvers. Requiere ?wallet=.',
        responseSample: `{ "ok": true, "solved": false, "solverCount": 3 }`,
      }),
      ep('POST', '/api/chain-solve/attempt', {
        auth: 'session',
        titleEn: 'Chain-solve attempt',
        titleEs: 'Intento chain-solve',
        descEn: 'Submit a chain-solve math answer.',
        descEs: 'Envía una respuesta matemática del puzzle chain-solve.',
        requestSample: `{ "wallet": "0xabc...", "answer": 42 }`,
        responseSample: `{ "ok": true, "correct": true }`,
      }),
      ep('POST', '/api/chain-solve/demine', {
        auth: 'session',
        titleEn: 'Chain-solve demine',
        titleEs: 'Demine chain-solve',
        descEn: 'Activate demine mode reward after chain completion.',
        descEs: 'Activa recompensa demine tras completar la cadena.',
        requestSample: `{ "wallet": "0xabc..." }`,
        responseSample: `{ "ok": true }`,
      }),
      ep('GET', '/api/rm-rf-chain', {
        titleEn: 'RM-RF chain chip status',
        titleEs: 'Estado chip /rm -rf',
        descEn: 'Status of chain-reset chips (24h cooldown per wallet).',
        descEs: 'Estado de chips de reset de cadena (cooldown 24h por wallet).',
        responseSample: `{ "ok": true, "available": true }`,
      }),
      ep('POST', '/api/rm-rf-chain', {
        auth: 'session',
        titleEn: 'Wipe mined blocks',
        titleEs: 'Borrar bloques minados',
        descEn: 'Wipes mm3_mined_blocks via /rm -rf chip. Requires session.',
        descEs: 'Borra mm3_mined_blocks con chip /rm -rf. Requiere sesión.',
        requestSample: `{ "wallet": "0xabc..." }`,
        responseSample: `{ "ok": true, "wiped": 12 }`,
      }),
      ep('POST', '/api/exec-hidden-cmd', {
        titleEn: 'Hidden IRC command',
        titleEs: 'Comando oculto IRC',
        descEn: 'Hidden command executor — currently disabled (503 temporarily_disabled) pending wallet auth hardening.',
        descEs: 'Ejecutor de comandos ocultos — actualmente deshabilitado (503 temporarily_disabled).',
        requestSample: `{
  "wallet": "0xabc...",
  "command": "/hidden-cmd"
}`,
        responseSample: `{ "ok": false, "error": "temporarily_disabled" }`,
      }),
      ep('GET', '/api/rl-mount?wallet=0xabc1234567890123456789012345678901234567890', {
        path: '/api/rl-mount?wallet=0xabc1234567890123456789012345678901234567890',
        titleEn: 'RL mount status',
        titleEs: 'Estado RL mount',
        descEn: 'Check RL mount node ownership for a wallet.',
        descEs: 'Comprueba propiedad del nodo RL mount de una wallet.',
        responseSample: `{ "ok": true, "active": false }`,
      }),
      ep('POST', '/api/rl-mount', {
        auth: 'session',
        titleEn: 'Purchase RL mount',
        titleEs: 'Comprar RL mount',
        descEn: 'Purchase RL mount node (costs MM3).',
        descEs: 'Compra nodo RL mount (cuesta MM3).',
        requestSample: `{ "wallet": "0xabc..." }`,
        responseSample: `{ "ok": true, "active": true }`,
      }),
      ep('DELETE', '/api/rl-mount?wallet=0xabc1234567890123456789012345678901234567890', {
        path: '/api/rl-mount?wallet=0xabc1234567890123456789012345678901234567890',
        titleEn: 'Deactivate RL mount',
        titleEs: 'Desactivar RL mount',
        descEn: 'Deactivate RL mount for a wallet.',
        descEs: 'Desactiva RL mount para una wallet.',
        responseSample: `{ "ok": true, "active": false }`,
      }),
      ep('GET', '/api/node-dice', {
        titleEn: 'Node dice state',
        titleEs: 'Estado node dice',
        descEn: 'Current node-dice storm ownership and mode.',
        descEs: 'Propietario y modo actual del storm node-dice.',
        responseSample: `{ "ok": true, "owner": "0xabc...", "mode": "storm" }`,
      }),
      ep('POST', '/api/node-dice', {
        auth: 'session',
        titleEn: 'Purchase node dice',
        titleEs: 'Comprar node dice',
        descEn: 'Purchase 24h node-dice control (500 MM3, level ≥30).',
        descEs: 'Compra control node-dice 24h (500 MM3, nivel ≥30).',
        requestSample: `{ "wallet": "0xabc..." }`,
        responseSample: `{ "ok": true, "expiresAt": "2026-08-22T09:00:00Z" }`,
      }),
    ],
  },
  {
    id: 'pvp',
    titleEn: 'PvP & combat',
    titleEs: 'PvP y combate',
    endpoints: [
      ep('GET', '/api/pvp-hit?wallet=0xabc1234567890123456789012345678901234567890', {
        path: '/api/pvp-hit?wallet=0xabc1234567890123456789012345678901234567890',
        titleEn: 'PvP health',
        titleEs: 'Salud PvP',
        descEn: 'Get wallet PvP HP. Requires ?wallet=.',
        descEs: 'Obtiene HP PvP de una wallet. Requiere ?wallet=.',
        responseSample: `{ "ok": true, "health": 85 }`,
      }),
      ep('POST', '/api/pvp-hit', {
        auth: 'session',
        titleEn: 'Record PvP hit',
        titleEs: 'Registrar golpe PvP',
        descEn: 'Record PvP hit (attacker → victim). Real wallets require session matching attacker.',
        descEs: 'Registra golpe PvP. Wallets reales requieren sesión que coincida con attacker.',
        requestSample: `{
  "attacker": "0xabc...",
  "victim": "0xdef...",
  "hitZone": "body",
  "attackerGx": 14, "attackerGy": 14, "attackerGz": 0,
  "victimGx": 15, "victimGy": 14, "victimGz": 0
}`,
        responseSample: `{ "ok": true, "victimHealth": 70 }`,
      }),
      ep('GET', '/api/pvp-death?wallet=0xabc1234567890123456789012345678901234567890', {
        path: '/api/pvp-death?wallet=0xabc1234567890123456789012345678901234567890',
        titleEn: 'Death state',
        titleEs: 'Estado de muerte',
        descEn: 'Check death state and last alive position.',
        descEs: 'Comprueba estado de muerte y última posición viva.',
        responseSample: `{ "ok": true, "dead": false, "deadUntil": null }`,
      }),
      ep('PATCH', '/api/pvp-death', {
        titleEn: 'Persist alive position',
        titleEs: 'Guardar posición viva',
        descEn: 'Persist alive position (row/col/z/mapId) while alive.',
        descEs: 'Guarda posición viva (row/col/z/mapId) mientras está vivo.',
        requestSample: `{
  "wallet": "0xabc...",
  "row": 14, "col": 14, "z": 0, "mapId": "m1"
}`,
        responseSample: `{ "ok": true }`,
      }),
      ep('POST', '/api/pvp-death', {
        titleEn: 'Record death',
        titleEs: 'Registrar muerte',
        descEn: 'Record death (5-minute cooldown).',
        descEs: 'Registra muerte (cooldown 5 minutos).',
        requestSample: `{
  "wallet": "0xabc...",
  "gx": 14.5, "gy": 14.5
}`,
        responseSample: `{ "ok": true, "deadUntil": "2026-08-21T09:40:00Z" }`,
      }),
      ep('DELETE', '/api/pvp-death?wallet=0xabc1234567890123456789012345678901234567890', {
        path: '/api/pvp-death?wallet=0xabc1234567890123456789012345678901234567890',
        titleEn: 'Clear death on respawn',
        titleEs: 'Limpiar muerte al reaparecer',
        descEn: 'Clear death state when player respawns.',
        descEs: 'Limpia estado de muerte al reaparecer.',
        responseSample: `{ "ok": true }`,
      }),
      ep('POST', '/api/pvp-anon-kill', {
        titleEn: 'Anonymous kill reward',
        titleEs: 'Recompensa kill anónimo',
        descEn: 'Reward EUR bonus for killing an anonymous player.',
        descEs: 'Bonificación EUR por matar a un jugador anónimo.',
        requestSample: `{
  "attacker": "0xabc...",
  "victim": "anon-xyz"
}`,
        responseSample: `{ "ok": true, "bonusEur": 0.01 }`,
      }),
      ep('POST', '/api/npc-hit', {
        titleEn: 'NPC chaser damage',
        titleEs: 'Daño NPC perseguidor',
        descEn: 'NPC chaser damage (1 HP, rate-limited).',
        descEs: 'Daño del NPC perseguidor (1 HP, rate limit).',
        requestSample: `{ "wallet": "0xabc..." }`,
        responseSample: `{ "ok": true, "health": 99 }`,
      }),
      ep('POST', '/api/pool-heal', {
        auth: 'session',
        titleEn: 'Pool safe-zone heal',
        titleEs: 'Curación zona segura pool',
        descEn: 'Heal +10 HP in house pool safe zone.',
        descEs: 'Cura +10 HP en zona segura de la casa pool.',
        requestSample: `{ "wallet": "0xabc..." }`,
        responseSample: `{ "ok": true, "health": 100 }`,
      }),
      ep('POST', '/api/stormroll-damage', {
        titleEn: 'Node-dice storm damage',
        titleEs: 'Daño storm node-dice',
        descEn: 'Apply node-dice storm damage during active dice window (409 dice_not_active outside window).',
        descEs: 'Aplica daño storm node-dice durante ventana activa (409 fuera de ventana).',
        requestSample: `{ "wallet": "0xabc..." }`,
        responseSample: `{ "ok": true, "damage": 5 }`,
      }),
    ],
  },
  {
    id: 'bosses',
    titleEn: 'World bosses',
    titleEs: 'Bosses de mundo',
    endpoints: [
      ...bossSection('m3', 'Putin (M3)', 'Putin (M3)'),
      ...bossSection('m4', 'Kim (M4)', 'Kim (M4)'),
      ...bossSection('m5', 'Trump (M5)', 'Trump (M5)'),
    ],
  },
  {
    id: 'training',
    titleEn: 'Training',
    titleEs: 'Entrenamiento',
    endpoints: [
      ep('POST', '/api/training/resolve', {
        auth: 'session',
        titleEn: 'Resolve training answer',
        titleEs: 'Resolver respuesta training',
        descEn: 'Resolve correct training answer (rewards/level).',
        descEs: 'Resuelve respuesta correcta de training (recompensas/nivel).',
        requestSample: `{ "answer": 42, "puzzleId": "p1" }`,
        responseSample: `{ "ok": true, "correct": true, "level": 5 }`,
      }),
      ep('POST', '/api/training/failure', {
        auth: 'session',
        titleEn: 'Training failure',
        titleEs: 'Fallo training',
        descEn: 'Record failed training attempt (penalties).',
        descEs: 'Registra intento fallido (penalizaciones).',
        responseSample: `{ "ok": true, "lifeLost": true }`,
      }),
      ep('POST', '/api/training/life-revive', {
        auth: 'session',
        titleEn: 'Training life revive',
        titleEs: 'Revivir vida training',
        descEn: 'Pay to revive training life after failure.',
        descEs: 'Paga para revivir vida tras fallo.',
        responseSample: `{ "ok": true, "lifeRestored": true }`,
      }),
      ep('POST', '/api/training/emoji-claim', {
        auth: 'session',
        titleEn: 'Training emoji claim',
        titleEs: 'Claim emoji training',
        descEn: 'Claim training emoji NFTJI reward.',
        descEs: 'Reclama recompensa emoji NFTJI de training.',
        responseSample: `{ "ok": true, "emoji": "🧮" }`,
      }),
    ],
  },
  {
    id: 'daily',
    titleEn: 'Daily tasks',
    titleEs: 'Tareas diarias',
    endpoints: [
      ep('POST', '/api/daily-tasks/claim', {
        auth: 'session',
        titleEn: 'Claim daily task',
        titleEs: 'Reclamar tarea diaria',
        descEn: 'Claim daily task reward (training, trading, mining, etc.).',
        descEs: 'Reclama recompensa de tarea diaria (training, trading, mining, etc.).',
        requestSample: `{ "taskKey": "training_3" }`,
        responseSample: `{ "ok": true, "rewardMm3": 0.00001 }`,
      }),
    ],
  },
  {
    id: 'relay',
    titleEn: 'Relaying terminal',
    titleEs: 'Terminal Relaying',
    endpoints: [
      ep('POST', '/api/relay/exec', {
        auth: 'session',
        titleEn: 'Relay command',
        titleEs: 'Comando relay',
        descEn: 'Execute relay command between two wallets (initiator must match session).',
        descEs: 'Ejecuta comando relay entre dos wallets (iniciador = sesión).',
        requestSample: `{ "targetWallet": "0xdef..." }`,
        responseSample: `{ "ok": true, "execCount": 6 }`,
      }),
      ep('POST', '/api/relay/chat', {
        auth: 'session',
        titleEn: 'Relay chat message',
        titleEs: 'Mensaje chat relay',
        descEn: 'Post chat message to relaying terminal.',
        descEs: 'Publica mensaje en el terminal relaying.',
        requestSample: `{ "message": "hello IRC" }`,
        responseSample: `{ "ok": true, "id": 12345 }`,
      }),
      ep('POST', '/api/relay/invalid-command', {
        titleEn: 'Log invalid command',
        titleEs: 'Registrar comando inválido',
        descEn: 'Log invalid relay command attempt.',
        descEs: 'Registra intento de comando relay inválido.',
        requestSample: `{ "wallet": "0xabc...", "command": "/bad" }`,
        responseSample: `{ "ok": true }`,
      }),
      ep('POST', '/api/relay/market-command', {
        auth: 'session',
        titleEn: 'Market slash command',
        titleEs: 'Comando slash mercado',
        descEn: 'Execute market slash-command (/buy, etc.).',
        descEs: 'Ejecuta comando slash de mercado (/buy, etc.).',
        requestSample: `{ "command": "/buy EUR 0.5" }`,
        responseSample: `{ "ok": true }`,
      }),
      ep('POST', '/api/relay/penalize', {
        auth: 'session',
        titleEn: 'Relay penalize',
        titleEs: 'Penalizar relay',
        descEn: 'Apply relay command penalty to wallet progress.',
        descEs: 'Aplica penalización de comando relay al progreso.',
        requestSample: `{ "updates": [{ "wallet": "0xabc...", "penalty": 1 }] }`,
        responseSample: `{ "ok": true }`,
      }),
    ],
  },
  {
    id: 'pools',
    titleEn: 'Wallet pools & squeezes',
    titleEs: 'Pools y squeezes',
    endpoints: [
      ep('GET', '/api/wallet-pools/my-pool?wallet=0xabc1234567890123456789012345678901234567890', {
        path: '/api/wallet-pools/my-pool?wallet=0xabc1234567890123456789012345678901234567890',
        titleEn: 'My pool',
        titleEs: 'Mi pool',
        descEn: 'Get pool membership for a wallet.',
        descEs: 'Obtiene membresía de pool de una wallet.',
        responseSample: `{ "ok": true, "pool_code": "FHNN6" }`,
      }),
      ep('GET', '/api/wallet-pools/invites?wallet=0xabc1234567890123456789012345678901234567890', {
        path: '/api/wallet-pools/invites?wallet=0xabc1234567890123456789012345678901234567890',
        titleEn: 'Pool invites',
        titleEs: 'Invitaciones pool',
        descEn: 'Pending pool invitations for a wallet.',
        descEs: 'Invitaciones pendientes de pool.',
        responseSample: `{ "ok": true, "invites": [{ "id": 1, "pool_code": "FHNN6" }] }`,
      }),
      ep('GET', '/api/wallet-pools/cooldown?wallet=0xabc1234567890123456789012345678901234567890', {
        path: '/api/wallet-pools/cooldown?wallet=0xabc1234567890123456789012345678901234567890',
        titleEn: 'Pool leave cooldown',
        titleEs: 'Cooldown salida pool',
        descEn: 'Post-leave rejoin cooldown status (24h).',
        descEs: 'Estado cooldown tras salir (24h para reingresar).',
        responseSample: `{ "ok": true, "cooldownUntil": null }`,
      }),
      ep('GET', '/api/wallet-pools/disputes?pool=FHNN6&limit=50', {
        path: '/api/wallet-pools/disputes?pool=FHNN6&limit=50',
        titleEn: 'Squeezes / disputes',
        titleEs: 'Squeezes / disputas',
        descEn: 'List squeezing disputes. Optional ?pool= and ?limit=.',
        descEs: 'Lista disputas squeeze. Opcional ?pool= y ?limit=.',
        responseSample: `{
  "ok": true,
  "disputes": [{
    "id": 42,
    "challenger_pool_code": "FHNN6",
    "defender_pool_code": "8FR49",
    "status": "resolved",
    "winner": "defender"
  }]
}`,
      }),
      ep('GET', '/api/pools-quick', {
        titleEn: 'Pools quick summary',
        titleEs: 'Resumen rápido pools',
        descEn: 'Quick summary of pools and recent squeeze activity.',
        descEs: 'Resumen rápido de pools y actividad squeeze reciente.',
        responseSample: `{ "ok": true, "pools": [{ "code": "FHNN6", "memberCount": 3 }] }`,
      }),
      ep('POST', '/api/wallet-pools/accept', {
        auth: 'session',
        titleEn: 'Accept pool invite',
        titleEs: 'Aceptar invitación pool',
        descEn: 'Accept pool invitation.',
        descEs: 'Acepta invitación a pool.',
        requestSample: `{ "inviteId": 1 }`,
        responseSample: `{ "ok": true, "pool_code": "FHNN6" }`,
      }),
      ep('POST', '/api/wallet-pools/decline', {
        auth: 'session',
        titleEn: 'Decline pool invite',
        titleEs: 'Rechazar invitación pool',
        descEn: 'Decline pool invitation.',
        descEs: 'Rechaza invitación a pool.',
        requestSample: `{ "inviteId": 1 }`,
        responseSample: `{ "ok": true }`,
      }),
      ep('POST', '/api/wallet-pools/contact', {
        auth: 'session',
        titleEn: 'Invite to pool',
        titleEs: 'Invitar a pool',
        descEn: 'Invite wallet to pool or create pool.',
        descEs: 'Invita wallet a pool o crea pool.',
        requestSample: `{ "targetWallet": "0xdef..." }`,
        responseSample: `{ "ok": true, "inviteId": 2 }`,
      }),
      ep('POST', '/api/wallet-pools/leave', {
        auth: 'session',
        titleEn: 'Leave pool',
        titleEs: 'Salir del pool',
        descEn: 'Leave current pool (24h rejoin cooldown).',
        descEs: 'Sale del pool actual (cooldown 24h).',
        responseSample: `{ "ok": true }`,
      }),
      ep('POST', '/api/wallet-pools/dispute/vote', {
        auth: 'session',
        titleEn: 'Dispute vote',
        titleEs: 'Voto disputa',
        descEn: 'Vote on or launch squeeze proposal between pools.',
        descEs: 'Vota o lanza propuesta squeeze entre pools.',
        requestSample: `{ "challengerPool": "FHNN6", "defenderPool": "8FR49" }`,
        responseSample: `{ "ok": true, "disputeId": 42 }`,
      }),
      ep('POST', '/api/wallet-pools/dispute/join', {
        auth: 'session',
        titleEn: 'Join squeeze battle',
        titleEs: 'Unirse a batalla squeeze',
        descEn: 'Register for squeeze battle.',
        descEs: 'Registra participación en batalla squeeze.',
        requestSample: `{ "disputeId": 42 }`,
        responseSample: `{ "ok": true }`,
      }),
      ep('POST', '/api/wallet-pools/dispute/cancel', {
        auth: 'session',
        titleEn: 'Cancel dispute',
        titleEs: 'Cancelar disputa',
        descEn: 'Cancel expired proposing dispute.',
        descEs: 'Cancela disputa en propuesta expirada.',
        requestSample: `{ "disputeId": 42 }`,
        responseSample: `{ "ok": true }`,
      }),
      ep('POST', '/api/wallet-pools/dispute/start-battle', {
        auth: 'session',
        titleEn: 'Start squeeze battle',
        titleEs: 'Iniciar batalla squeeze',
        descEn: 'Transition dispute from registering → battle.',
        descEs: 'Pasa disputa de registering → battle.',
        requestSample: `{ "disputeId": 42 }`,
        responseSample: `{ "ok": true, "battle_start_at": "2026-05-09T10:00:05Z" }`,
      }),
      ep('POST', '/api/wallet-pools/dispute/resolve', {
        auth: 'session',
        titleEn: 'Resolve squeeze battle',
        titleEs: 'Resolver batalla squeeze',
        descEn: 'Resolve battle after start window.',
        descEs: 'Resuelve batalla tras ventana de inicio.',
        requestSample: `{ "disputeId": 42 }`,
        responseSample: `{ "ok": true, "winner": "defender" }`,
      }),
      ep('POST', '/api/wallet-pools/dispute/claim-nftji-drop', {
        auth: 'session',
        titleEn: 'Claim squeeze NFTJI drop',
        titleEs: 'Reclamar drop NFTJI squeeze',
        descEn: 'Claim squeeze NFTJI drop reward.',
        descEs: 'Reclama recompensa drop NFTJI de squeeze.',
        requestSample: `{ "disputeId": 42 }`,
        responseSample: `{ "ok": true, "nftji": "attack" }`,
      }),
    ],
  },
  {
    id: 'internal',
    titleEn: 'Cron & webhooks',
    titleEs: 'Cron y webhooks',
    endpoints: [
      ep('GET', '/api/bot/tick', {
        auth: 'cron',
        titleEn: 'Bot cron tick',
        titleEs: 'Tick cron del bot',
        descEn: 'Internal bot cron: trading, squeezing, 3D presence simulation. Requires CRON_SECRET.',
        descEs: 'Cron interno del bot: trading, squeezes, simulación 3D. Requiere CRON_SECRET.',
        responseSample: `{ "ok": true, "actions": 3 }`,
      }),
      ep('POST', '/api/webhooks/alchemy?token=$ALCHEMY_WEBHOOK_TOKEN', {
        path: '/api/webhooks/alchemy?token=$ALCHEMY_WEBHOOK_TOKEN',
        auth: 'webhook',
        titleEn: 'Alchemy donation webhook',
        titleEs: 'Webhook donaciones Alchemy',
        descEn: 'Alchemy webhook for ETH/USDC donations. Requires ?token=ALCHEMY_WEBHOOK_TOKEN.',
        descEs: 'Webhook Alchemy para donaciones ETH/USDC. Requiere ?token=ALCHEMY_WEBHOOK_TOKEN.',
        requestSample: `{ "event": { "activity": [] } }`,
        responseSample: `{ "ok": true }`,
      }),
    ],
  },
]

export const API_COPY = {
  en: {
    intro:
      'MathsMine3 exposes a JSON HTTP API at mathsmine3.xyz. Public read endpoints are open; mutations typically require a Bearer session from POST /api/auth/session.',
    baseUrl: 'Base URL',
    auth: 'Auth',
    authNone: 'None',
    authSession: 'Bearer session (MM3_SESSION)',
    authCron: 'Bearer CRON_SECRET',
    authWebhook: 'Webhook token query param',
    curl: 'curl',
    request: 'Request',
    response: 'Response',
    rateLimit: 'Rate limiting',
    rateLimitDesc:
      'Public endpoints such as /api/token-value and /api/leaderboard enforce a per-IP limit. X-RateLimit-* headers report quota.',
    toc: 'Sections',
    endpointCount: 'endpoints documented',
  },
  es: {
    intro:
      'MathsMine3 expone una API HTTP JSON en mathsmine3.xyz. Los GET públicos son abiertos; las mutaciones suelen requerir Bearer session de POST /api/auth/session.',
    baseUrl: 'URL base',
    auth: 'Auth',
    authNone: 'Ninguna',
    authSession: 'Bearer session (MM3_SESSION)',
    authCron: 'Bearer CRON_SECRET',
    authWebhook: 'Token webhook en query',
    curl: 'curl',
    request: 'Petición',
    response: 'Respuesta',
    rateLimit: 'Rate limiting',
    rateLimitDesc:
      'Endpoints públicos como /api/token-value y /api/leaderboard aplican límite por IP. Las cabeceras X-RateLimit-* informan de la cuota.',
    toc: 'Secciones',
    endpointCount: 'endpoints documentados',
  },
}

export function authLabel(auth, lang) {
  const c = API_COPY[lang] || API_COPY.en
  if (auth === 'session') return c.authSession
  if (auth === 'cron') return c.authCron
  if (auth === 'webhook') return c.authWebhook
  return c.authNone
}

export function exportPayload() {
  return {
    baseUrl: API_BASE_URL,
    copy: API_COPY,
    sections: API_SECTIONS.map((section) => ({
      ...section,
      endpoints: section.endpoints.map((ep) => ({
        ...ep,
        curl: buildCurl(ep),
      })),
    })),
  }
}

export function endpointCount() {
  return API_SECTIONS.reduce((n, s) => n + s.endpoints.length, 0)
}
