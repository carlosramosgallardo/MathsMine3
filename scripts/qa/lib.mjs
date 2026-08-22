/** Shared helpers for scripts/qa-sweep.mjs */
import { createHmac } from 'crypto'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(__dirname, '../..')

export function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* optional */ }
}

export function createSessionToken(wallet) {
  const secret = process.env.WALLET_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!secret) throw new Error('missing WALLET_SESSION_SECRET / SUPABASE_SERVICE_ROLE_KEY')
  const w = String(wallet || '').toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(w)) throw new Error(`invalid_session_wallet ${w}`)
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000
  const payload = ['session', w, String(exp)].join('.')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return Buffer.from(['session', w, String(exp), sig].join('.')).toString('base64url')
}

/** Throwaway wallets — never bots / never real users */
export const QA = {
  claim: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
  life: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2',
  zero: '0xccccccccccccccccccccccccccccccccccccccc3',
  atk: '0xddddddddddddddddddddddddddddddddddddddd4',
  vic: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee5',
  luck: '0xffffffffffffffffffffffffffffffffffffff66',
  mine: '0x1111111111111111111111111111111111111111',
  boss: '0x2222222222222222222222222222222222222222',
  nftji: '0x3333333333333333333333333333333333333333',
  dice: '0x4444444444444444444444444444444444444444',
  rl: '0x5555555555555555555555555555555555555555',
  trade: '0x6666666666666666666666666666666666666666',
  train: '0x7777777777777777777777777777777777777777',
  npc: '0x8888888888888888888888888888888888888888',
  heal: '0x9999999999999999999999999999999999999999',
}

export function parseArgs(argv) {
  const args = argv.slice(2)
  function flag(name, def = null) {
    const i = args.indexOf(name)
    if (i === -1) return def
    const next = args[i + 1]
    if (!next || next.startsWith('--')) return true
    return next
  }
  return {
    unitOnly: args.includes('--unit-only'),
    allowDestructive: args.includes('--allow-destructive'),
    base: String(flag('--base', process.env.QA_BASE_URL || 'http://127.0.0.1:3000')).replace(/\/$/, ''),
    pvpSamples: Math.max(40, Number(flag('--pvp-samples', '80')) || 80),
  }
}

export function createReporter() {
  const results = []
  const line = (kind, id, detail) => {
    const safeId = String(id).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 120)
    const safeDetail = String(detail || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 160)
    console.log(`${kind}  ${safeId}${safeDetail ? ` — ${safeDetail}` : ''}`) // NOSONAR jssecurity:S5145 QA CLI status line
  }
  const ok = (id, detail = '') => {
    results.push({ status: 'OK', id, detail })
    line('OK  ', id, detail)
  }
  const nok = (id, detail = '') => {
    results.push({ status: 'NOK', id, detail })
    line('NOK ', id, detail)
  }
  const skip = (id, detail = '') => {
    results.push({ status: 'SKIP', id, detail })
    line('SKIP', id, detail)
  }
  const summary = () => {
    const counts = { OK: 0, NOK: 0, SKIP: 0 }
    for (const r of results) counts[r.status]++
    console.log('')
    console.log(`=== Summary: ${counts.OK} OK · ${counts.NOK} NOK · ${counts.SKIP} SKIP ===`)
    if (counts.NOK > 0) {
      console.log('NOK to fix:')
      for (const r of results.filter((x) => x.status === 'NOK')) {
        console.log(`  - ${r.id}: ${r.detail}`)
      }
    }
    return counts
  }
  return { ok, nok, skip, summary, results }
}

export function sbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

export function makeApi(base) {
  return async function api(path, { method = 'GET', token = null, body = null } = {}) {
    const headers = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (body != null) headers['Content-Type'] = 'application/json'
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { /* */ }
    return { status: res.status, json, text }
  }
}

export async function ensureProgress(supabase, wallet, extra = {}) {
  const base = {
    wallet,
    level: 10,
    mm3_sold: 0,
    eur_earned: 100,
    usd_earned: 100,
    cny_earned: 100,
    wallet_emojis: [],
    life_used: false,
    lucky_50_claimed: false,
    lucky_100_claimed: false,
    lucky_500_claimed: false,
    lucky_1000_claimed: false,
    lucky_50_level: -1,
    lucky_100_level: -1,
    lucky_500_level: -1,
    lucky_1000_level: -1,
    zero_day_level: -1,
    rl_mount_active: false,
    mining_nftji_key: null,
    mining_nftji_price: 0,
    updated_at: new Date().toISOString(),
    ...extra,
  }
  const { error } = await supabase.from('player_progress').upsert(base, { onConflict: 'wallet' })
  if (error) throw new Error(`seed progress ${wallet}: ${error.message}`)
}

export async function ensureLeaderboard(supabase, wallet, totalEth) {
  const { error } = await supabase.from('leaderboard_data').upsert({
    wallet,
    total_eth: totalEth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'wallet' })
  if (error) {
    // some schemas use different PK — try insert/update
    const { error: e2 } = await supabase.from('leaderboard_data').upsert({
      wallet,
      total_eth: totalEth,
    }, { onConflict: 'wallet' })
    if (e2) throw new Error(`seed leaderboard ${wallet}: ${error.message} / ${e2.message}`)
  }
}

export async function ensureHealth(supabase, wallet, health = 100, extra = {}) {
  const payload = {
    wallet,
    health,
    last_pos_row: 12,
    last_pos_col: 12,
    last_pos_z: 0,
    last_pos_map_id: '1',
    pvp_dead_until: null,
    pos_updated_at: new Date().toISOString(),
    ...extra,
  }
  let { error } = await supabase.from('mm3_pvp_health').upsert(payload, { onConflict: 'wallet' })
  if (error?.message?.includes('last_pos_map_id')) {
    delete payload.last_pos_map_id
    ;({ error } = await supabase.from('mm3_pvp_health').upsert(payload, { onConflict: 'wallet' }))
  }
  if (error) throw new Error(`seed health ${wallet}: ${error.message}`)
}

export async function clearSqueeze(supabase, wallet) {
  await supabase.from('mm3_squeezing_nftji').delete().eq('wallet', wallet)
}

export async function setSqueeze(supabase, wallet, { equipped, attackLevel = 0, defenseLevel = 0 }) {
  const { error } = await supabase.from('mm3_squeezing_nftji').upsert({
    wallet,
    equipped,
    attack_level: attackLevel,
    defense_level: defenseLevel,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'wallet' })
  if (error) throw new Error(`seed squeeze ${wallet}: ${error.message}`)
}

function normalizeQaBlockHex(value) {
  const raw = String(value || '').trim().toUpperCase()
  const match = raw.match(/^#?([0-9A-F]{1,3})$/)
  if (!match) return ''
  return `#${match[1].padStart(3, '0')}`
}

export async function clearMined(supabase, blockHex) {
  const hex = normalizeQaBlockHex(blockHex)
  if (!hex) return
  await supabase.from('mm3_mined_blocks').delete().eq('block_hex', hex)
}

export async function findFreeRegularBlock(supabase, { walletLevel = 10 } = {}) {
  // Hex format must match DB (#000 uppercase). Skip cells the wallet/global MM3 cannot mine.
  const { data: tv } = await supabase.from('token_value').select('total_eth').limit(1).maybeSingle()
  const globalMm3 = Number(Number(tv?.total_eth || 0).toFixed(2))
  const candidates = []
  for (let i = 0; i < 48; i++) {
    const progress = i / 999
    const minLevel = Math.round(progress * 100)
    const mm3Magnitude = Number((progress * 100).toFixed(2))
    const requiredMm3 = i === 0 ? 0 : (i % 2 === 1 ? mm3Magnitude : -mm3Magnitude)
    if (walletLevel < minLevel) continue
    if (requiredMm3 < 0 ? globalMm3 > requiredMm3 : globalMm3 < requiredMm3) continue
    candidates.push(`#${i.toString(16).toUpperCase().padStart(3, '0')}`)
  }
  if (!candidates.length) return null
  const { data } = await supabase.from('mm3_mined_blocks').select('block_hex').in('block_hex', candidates)
  const taken = new Set((data || []).map((r) => normalizeQaBlockHex(r.block_hex)))
  for (const hex of candidates) {
    if (!taken.has(hex)) return hex
  }
  return null
}

export function rateInBand(rate, expected, samples, label) {
  const se = Math.sqrt(expected * (1 - expected) / samples)
  const pad = Math.max(0.05, 3 * se)
  const lo = Math.max(0, expected - pad)
  const hi = Math.min(1, expected + pad)
  if (rate < lo || rate > hi) {
    return `${label} rate=${rate.toFixed(3)} expected~${expected} band=[${lo.toFixed(3)},${hi.toFixed(3)}] n=${samples}`
  }
  return null
}

export async function restoreBossHp(supabase, bossId, maxHealth) {
  await supabase.from('mm3_map_boss').update({
    health: maxHealth,
    state: 'idle',
    respawn_at: null,
    updated_at: new Date().toISOString(),
  }).eq('boss_id', bossId)
}
