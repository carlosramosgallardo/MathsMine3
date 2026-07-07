export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import {
  M4_KIM_BOSS_ATTACK_RANGE_SERVER,
  M4_KIM_BOSS_CRIT_CHANCE,
  M4_KIM_BOSS_CRIT_DAMAGE,
  M4_KIM_BOSS_HIT_DAMAGE,
  M4_KIM_BOSS_ID,
  isBossPositionValid,
} from '@/lib/m4-kim-boss'
import { isStormActive } from '@/lib/boss-storm'

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
  const mapId = String(body.mapId || '4')
  const playerGx = Number(body.playerGx)
  const playerGy = Number(body.playerGy)
  const bossGx = Number(body.bossGx)
  const bossGy = Number(body.bossGy)

  if (!wallet || wallet.startsWith('anon-')) {
    return Response.json({ ok: false, error: 'wallet_required' }, { status: 403 })
  }
  if (mapId !== '4') {
    return Response.json({ ok: false, error: 'wrong_map' }, { status: 403 })
  }
  if (!Number.isFinite(playerGx) || !Number.isFinite(playerGy) || !Number.isFinite(bossGx) || !Number.isFinite(bossGy)) {
    return Response.json({ ok: false, error: 'missing_position' }, { status: 400 })
  }
  if (!isBossPositionValid(bossGx, bossGy)) {
    return Response.json({ ok: false, error: 'boss_position_invalid' }, { status: 400 })
  }
  if (Math.hypot(playerGx - bossGx, playerGy - bossGy) > M4_KIM_BOSS_ATTACK_RANGE_SERVER) {
    return Response.json({ ok: false, error: 'out_of_range' }, { status: 400 })
  }

  const sb = serviceClient()
  const { data: squeezeNftji } = await sb
    .from('mm3_squeezing_nftji')
    .select('equipped, defense_level')
    .eq('wallet', wallet)
    .maybeSingle()

  const hasDefenseNftji = squeezeNftji?.equipped === 'defense'
    && Number(squeezeNftji?.defense_level ?? -1) >= 0
  if (hasDefenseNftji && Math.random() < 0.10) {
    const { data: healthRow } = await sb.from('mm3_pvp_health').select('health').eq('wallet', wallet).maybeSingle()
    return Response.json({
      ok: true,
      dodged: true,
      damage: 0,
      health: Number(healthRow?.health ?? 100),
      killed: false,
      mapId: '4',
    })
  }

  const critical = Math.random() < M4_KIM_BOSS_CRIT_CHANCE
  const damage = critical ? M4_KIM_BOSS_CRIT_DAMAGE : M4_KIM_BOSS_HIT_DAMAGE

  const stormActive = await isStormActive(sb)
  const { data, error } = await sb.rpc('apply_mm3_boss_attack_player', {
    p_wallet: wallet,
    p_damage: damage,
    p_boss_gx: bossGx,
    p_boss_gy: bossGy,
    p_player_gx: playerGx,
    p_player_gy: playerGy,
    p_boss_id: M4_KIM_BOSS_ID,
    p_storm_active: stormActive,
  })
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
  if (data?.ok === false) {
    return Response.json(data, { status: 409 })
  }

  return Response.json({
    ok: true,
    critical,
    damage: Number(data?.damage ?? damage),
    health: Number(data?.health ?? 100),
    respawnHealth: Number(data?.respawn_health ?? data?.health ?? 100),
    killed: Boolean(data?.killed),
    mapId: '4',
  })
}
