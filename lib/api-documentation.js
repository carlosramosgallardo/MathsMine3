import rawSections from './api-documentation-data.json' with { type: 'json' }

export const API_BASE_URL = 'https://mathsmine3.xyz'

const SESSION = 'Authorization: Bearer $MM3_SESSION'
const CRON = 'Authorization: Bearer $CRON_SECRET'
const DEMO_WALLET = '0xabc1234567890123456789012345678901234567890'
const BOSS_POS_SAMPLE = `{
  "wallet": "${DEMO_WALLET}",
  "gx": 14.5, "gy": 14.5, "gz": 0.2
}`

const BOSS_MAPS = [
  { id: 'm3', nameEn: 'Putin (M3)', nameEs: 'Putin (M3)' },
  { id: 'm4', nameEn: 'Kim (M4)', nameEs: 'Kim (M4)' },
  { id: 'm5', nameEn: 'Trump (M5)', nameEs: 'Trump (M5)' },
]

/** @typedef {'none'|'session'|'cron'|'webhook'} AuthKind */

/**
 * @param {object} ep
 * @param {string} ep.method
 * @param {string} ep.path
 * @param {string} [ep.requestSample]
 * @param {AuthKind} [ep.auth]
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

function normalizeEndpoint(entry) {
  const method = entry.method
  return {
    ...entry,
    auth: entry.auth || 'none',
    publicGet: entry.publicGet ?? method === 'GET',
  }
}

function bossEndpoints({ id, nameEn, nameEs }) {
  const base = `/api/${id}-boss`
  const mapLabel = id.toUpperCase()
  return [
    normalizeEndpoint({
      method: 'GET',
      path: base,
      titleEn: `${nameEn} boss state`,
      titleEs: `Estado del boss ${nameEs}`,
      descEn: `Public read-only HP/state for the ${nameEn} world boss on map ${mapLabel}.`,
      descEs: `Lectura pública de HP/estado del boss ${nameEs} en el mapa ${mapLabel}.`,
      responseSample: '{ "ok": true, "health": 4200, "maxHealth": 5000, "state": "fighting" }',
    }),
    normalizeEndpoint({
      method: 'POST',
      path: `${base}/attack`,
      auth: 'session',
      publicGet: false,
      titleEn: `${nameEn} attacks player`,
      titleEs: `${nameEs} ataca al jugador`,
      descEn: 'Boss-on-player damage while fighting on this map. Requires session wallet matching body.wallet.',
      descEs: 'Daño del boss al jugador durante el combate. Requiere sesión que coincida con body.wallet.',
      requestSample: BOSS_POS_SAMPLE,
      responseSample: '{ "ok": true, "damage": 12 }',
    }),
    normalizeEndpoint({
      method: 'POST',
      path: `${base}/hit`,
      auth: 'session',
      publicGet: false,
      titleEn: `Player hits ${nameEn}`,
      titleEs: `Jugador golpea a ${nameEs}`,
      descEn: 'Player-on-boss damage. Requires session wallet matching body.wallet.',
      descEs: 'Daño del jugador al boss. Requiere sesión que coincida con body.wallet.',
      requestSample: BOSS_POS_SAMPLE,
      responseSample: '{ "ok": true, "damage": 8, "bossHealth": 4192 }',
    }),
    normalizeEndpoint({
      method: 'POST',
      path: `${base}/idle`,
      publicGet: false,
      titleEn: `Reset ${nameEn} to idle`,
      titleEs: `Reiniciar ${nameEs} a idle`,
      descEn: 'Called when no fighters remain; returns boss to idle state.',
      descEs: 'Se invoca cuando no quedan luchadores; devuelve el boss a estado idle.',
      responseSample: '{ "ok": true, "state": "idle" }',
    }),
  ]
}

function sectionEndpoints(section) {
  if (section.id === 'bosses') {
    return BOSS_MAPS.flatMap(bossEndpoints)
  }
  return section.endpoints.map(normalizeEndpoint)
}

/** @type {Array<{id:string,titleEn:string,titleEs:string,endpoints:object[]}>} */
export const API_SECTIONS = rawSections.map((section) => ({
  ...section,
  endpoints: sectionEndpoints(section),
}))

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
