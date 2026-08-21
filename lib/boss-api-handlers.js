import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { walletFromRequest } from '@/lib/wallet-session'
import { isStormActive } from '@/lib/boss-storm'
import { applyDeathLevelPenalty } from '@/lib/death-penalty'

const CACHE_MS = 5_000

/** Cryptographic roll for combat RNG (Sonar S2245 — avoid Math.random in server logic). */
function rollChance(probability) {
  if (probability <= 0) return false
  if (probability >= 1) return true
  return randomInt(0, 10_000) < Math.round(probability * 10_000)
}

export function bossServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

export async function distributeBossRewards(sb, damageTotals, splitBossRewards) {
  const payouts = splitBossRewards(damageTotals)
  const results = []
  for (const payout of payouts) {
    const { data: progress } = await sb
      .from('player_progress')
      .select('mm3_sold, eur_earned, usd_earned, cny_earned')
      .eq('wallet', payout.wallet)
      .maybeSingle()
    if (!progress) continue
    const mm3Sold = Number(progress.mm3_sold) || 0
    const eur = Number(progress.eur_earned) || 0
    const { error } = await sb
      .from('player_progress')
      .update({
        mm3_sold: mm3Sold - payout.mm3,
        eur_earned: eur + payout.eur,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet', payout.wallet)
    if (!error) results.push(payout)
  }
  return results
}

async function loadBossRow(sb, bossId) {
  const { data, error } = await sb
    .from('mm3_map_boss')
    .select('*')
    .eq('id', bossId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const now = Date.now()
  if (data.state === 'dead' && data.respawn_at && new Date(data.respawn_at).getTime() <= now) {
    const { data: revived, error: reviveError } = await sb
      .from('mm3_map_boss')
      .update({
        state: 'idle',
        health: data.max_health,
        damage_totals: {},
        defeated_at: null,
        respawn_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bossId)
      .select('*')
      .maybeSingle()
    if (reviveError) throw reviveError
    return revived || data
  }
  return data
}

/** Shared GET /api/m*-boss handler factory (per-boss module cache). */
export function createBossRouteModule({ bossId, normalizeBossState, splitBossRewards }) {
  let cached = null
  let pending = null

  async function loadBossState() {
    if (cached && Date.now() - cached.ts < CACHE_MS) return cached.payload
    if (!pending) {
      pending = loadBossRow(bossServiceClient(), bossId)
        .then((row) => {
          const payload = normalizeBossState(row)
          cached = { ts: Date.now(), payload }
          return payload
        })
        .finally(() => { pending = null })
    }
    return pending
  }

  async function GET() {
    try {
      return Response.json(await loadBossState(), {
        headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
      })
    } catch (error) {
      return Response.json({ ok: false, error: error?.message || 'boss_load_failed' }, { status: 500 })
    }
  }

  async function distributeRewards(sb, damageTotals) {
    return distributeBossRewards(sb, damageTotals, splitBossRewards)
  }

  return { GET, distributeRewards }
}

export async function handleBossAttack(req, {
  mapId,
  bossId,
  attackRangeServer,
  critChance,
  critDamage,
  hitDamage,
  isBossPositionValid,
}) {
  let body
  try { body = await req.json() } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const wallet = walletFromRequest(req)
  const bodyMapId = String(body.mapId || mapId)
  const playerGx = Number(body.playerGx)
  const playerGy = Number(body.playerGy)
  const bossGx = Number(body.bossGx)
  const bossGy = Number(body.bossGy)

  if (!wallet) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (bodyMapId !== mapId) {
    return Response.json({ ok: false, error: 'wrong_map' }, { status: 403 })
  }
  if (!Number.isFinite(playerGx) || !Number.isFinite(playerGy) || !Number.isFinite(bossGx) || !Number.isFinite(bossGy)) {
    return Response.json({ ok: false, error: 'missing_position' }, { status: 400 })
  }
  if (!isBossPositionValid(bossGx, bossGy)) {
    return Response.json({ ok: false, error: 'boss_position_invalid' }, { status: 400 })
  }
  if (Math.hypot(playerGx - bossGx, playerGy - bossGy) > attackRangeServer) {
    return Response.json({ ok: false, error: 'out_of_range' }, { status: 400 })
  }

  const sb = bossServiceClient()
  const { data: squeezeNftji } = await sb
    .from('mm3_squeezing_nftji')
    .select('equipped, defense_level')
    .eq('wallet', wallet)
    .maybeSingle()

  const hasDefenseNftji = squeezeNftji?.equipped === 'defense'
    && Number(squeezeNftji?.defense_level ?? -1) >= 0
  if (hasDefenseNftji && rollChance(0.10)) {
    const { data: healthRow } = await sb.from('mm3_pvp_health').select('health').eq('wallet', wallet).maybeSingle()
    const dodgePayload = {
      ok: true,
      dodged: true,
      damage: 0,
      health: Number(healthRow?.health ?? 100),
      killed: false,
    }
    if (mapId !== '5') dodgePayload.mapId = mapId
    return Response.json(dodgePayload)
  }

  const critical = rollChance(critChance)
  const damage = critical ? critDamage : hitDamage

  const stormActive = await isStormActive(sb)
  const { data, error } = await sb.rpc('apply_mm3_boss_attack_player', {
    p_wallet: wallet,
    p_damage: damage,
    p_boss_gx: bossGx,
    p_boss_gy: bossGy,
    p_player_gx: playerGx,
    p_player_gy: playerGy,
    p_boss_id: bossId,
    p_storm_active: stormActive,
  })
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
  if (data?.ok === false) {
    return Response.json(data, { status: 409 })
  }

  if (data?.killed) await applyDeathLevelPenalty(sb, wallet)

  const payload = {
    ok: true,
    critical,
    damage: Number(data?.damage ?? damage),
    health: Number(data?.health ?? 100),
    respawnHealth: Number(data?.respawn_health ?? data?.health ?? 100),
    killed: Boolean(data?.killed),
  }
  if (mapId !== '5') payload.mapId = mapId
  return Response.json(payload)
}

export async function handleBossHit(req, {
  mapId,
  bossId,
  bossSpawn,
  hitRange,
  defaultMaxHealth,
  isBossPositionValid,
  distributeRewards,
}) {
  let body
  try { body = await req.json() } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const wallet = walletFromRequest(req)
  const bodyMapId = String(body.mapId || mapId)
  const hitZone = body.hitZone === 'head' ? 'head' : 'body'
  const playerGx = Number(body.playerGx)
  const playerGy = Number(body.playerGy)
  const bossGx = Number(body.bossGx ?? bossSpawn.gx)
  const bossGy = Number(body.bossGy ?? bossSpawn.gy)

  if (!wallet) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (bodyMapId !== mapId) {
    return Response.json({ ok: false, error: 'wrong_map' }, { status: 403 })
  }
  if (!Number.isFinite(playerGx) || !Number.isFinite(playerGy)) {
    return Response.json({ ok: false, error: 'missing_position' }, { status: 400 })
  }
  if (!isBossPositionValid(bossGx, bossGy)) {
    return Response.json({ ok: false, error: 'boss_position_invalid' }, { status: 400 })
  }
  if (Math.hypot(playerGx - bossGx, playerGy - bossGy) > hitRange) {
    return Response.json({ ok: false, error: 'out_of_range' }, { status: 400 })
  }

  const sb = bossServiceClient()
  const [{ data: progress }, { data: squeezeNftji }] = await Promise.all([
    sb.from('player_progress').select('wallet').eq('wallet', wallet).maybeSingle(),
    sb.from('mm3_squeezing_nftji').select('equipped, attack_level').eq('wallet', wallet).maybeSingle(),
  ])
  if (!progress) {
    return Response.json({ ok: false, error: 'wallet_not_found' }, { status: 403 })
  }

  const hasAttackNftji = squeezeNftji?.equipped === 'attack'
    && Number(squeezeNftji?.attack_level ?? -1) >= 0
  const critical = hasAttackNftji && rollChance(0.05)
  const headshot = hitZone === 'head'
  const damage = headshot || critical ? 5 : 1

  const { data, error } = await sb.rpc('apply_mm3_boss_player_hit', {
    p_wallet: wallet,
    p_damage: damage,
    p_boss_id: bossId,
  })
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  let rewards = []
  if (data?.killed && data?.damage_totals) {
    rewards = await distributeRewards(sb, data.damage_totals)
  }

  const payload = {
    ok: true,
    critical,
    headshot,
    hitZone,
    damage,
    health: Number(data?.health ?? 0),
    maxHealth: Number(data?.max_health ?? defaultMaxHealth),
    state: data?.state || 'active',
    killed: Boolean(data?.killed),
    activated: Boolean(data?.activated),
    rewards,
  }
  if (mapId !== '5') payload.mapId = mapId
  return Response.json(payload)
}

export async function handleBossIdle({ mapId, includeMapId = true }) {
  const sb = bossServiceClient()
  const { data, error } = await sb.rpc('set_mm3_boss_idle_if_requested', { p_map_id: mapId })
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
  const payload = { ok: true, ...data }
  if (includeMapId) payload.mapId = mapId
  return Response.json(payload)
}
