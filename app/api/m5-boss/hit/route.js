export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { distributeBossRewards } from '@/app/api/m5-boss/route'
import {
  M5_TRUMP_BOSS_HIT_RANGE,
  M5_TRUMP_BOSS_SPAWN,
  isBossPositionValid,
} from '@/lib/m5-trump-boss'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

export async function POST(req) {
  let body
  try { body = await req.json() } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const wallet = String(body.wallet || '').toLowerCase().trim()
  const mapId = String(body.mapId || '5')
  const hitZone = body.hitZone === 'head' ? 'head' : 'body'
  const playerGx = Number(body.playerGx)
  const playerGy = Number(body.playerGy)
  const bossGx = Number(body.bossGx ?? M5_TRUMP_BOSS_SPAWN.gx)
  const bossGy = Number(body.bossGy ?? M5_TRUMP_BOSS_SPAWN.gy)

  if (!wallet || wallet.startsWith('anon-')) {
    return Response.json({ ok: false, error: 'wallet_required' }, { status: 403 })
  }
  if (mapId !== '5') {
    return Response.json({ ok: false, error: 'wrong_map' }, { status: 403 })
  }
  if (!Number.isFinite(playerGx) || !Number.isFinite(playerGy)) {
    return Response.json({ ok: false, error: 'missing_position' }, { status: 400 })
  }
  if (!isBossPositionValid(bossGx, bossGy)) {
    return Response.json({ ok: false, error: 'boss_position_invalid' }, { status: 400 })
  }
  const dist = Math.hypot(playerGx - bossGx, playerGy - bossGy)
  if (dist > M5_TRUMP_BOSS_HIT_RANGE) {
    return Response.json({ ok: false, error: 'out_of_range' }, { status: 400 })
  }

  const sb = serviceClient()
  const [{ data: progress }, { data: squeezeNftji }] = await Promise.all([
    sb.from('player_progress').select('wallet').eq('wallet', wallet).maybeSingle(),
    sb.from('mm3_squeezing_nftji').select('equipped, attack_level').eq('wallet', wallet).maybeSingle(),
  ])
  if (!progress) {
    return Response.json({ ok: false, error: 'wallet_not_found' }, { status: 403 })
  }

  const hasAttackNftji = squeezeNftji?.equipped === 'attack'
    && Number(squeezeNftji?.attack_level ?? -1) >= 0
  const critical = hasAttackNftji && Math.random() < 0.05
  const headshot = hitZone === 'head'
  const damage = headshot || critical ? 5 : 1

  const { data, error } = await sb.rpc('apply_mm3_boss_player_hit', {
    p_wallet: wallet,
    p_damage: damage,
    p_map_id: '5',
  })
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  let rewards = []
  if (data?.killed && data?.damage_totals) {
    rewards = await distributeBossRewards(sb, data.damage_totals)
  }

  return Response.json({
    ok: true,
    critical,
    headshot,
    hitZone,
    damage,
    health: Number(data?.health ?? 0),
    maxHealth: Number(data?.max_health ?? 5000),
    state: data?.state || 'active',
    killed: Boolean(data?.killed),
    activated: Boolean(data?.activated),
    rewards,
  })
}
