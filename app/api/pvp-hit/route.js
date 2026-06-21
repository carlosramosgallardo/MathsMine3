export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

export async function GET(req) {
  const wallet = new URL(req.url).searchParams.get('wallet')?.toLowerCase().trim()
  if (!wallet) return Response.json({ ok: false, error: 'missing_wallet' }, { status: 400 })
  const { data } = await serviceClient().from('mm3_pvp_health').select('health').eq('wallet', wallet).maybeSingle()
  return Response.json({ ok: true, health: Number(data?.health ?? 100) })
}

export async function POST(req) {
  let body
  try { body = await req.json() } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }
  const attacker = String(body.attacker || '').toLowerCase().trim()
  const victim = String(body.victim || '').toLowerCase().trim()
  const hitZone = body.hitZone === 'head' ? 'head' : 'body'
  const victimIsAnon = victim.startsWith('anon-')
  const attackerIsAnon = attacker.startsWith('anon-')
  if (!attacker || !victim || attacker === victim) {
    return Response.json({ ok: false, error: 'invalid_params' }, { status: 400 })
  }
  if (attackerIsAnon && !victimIsAnon) {
    return Response.json({ ok: false, error: 'anon_cannot_attack' }, { status: 403 })
  }

  const sb = serviceClient()
  const [{ data: attackerProgress }, { data: squeezeNftji }, { data: victimSqueezeNftji }, { data: victimHealth }] = await Promise.all([
    attackerIsAnon ? Promise.resolve({ data: null }) : sb.from('player_progress').select('wallet').eq('wallet', attacker).maybeSingle(),
    attackerIsAnon ? Promise.resolve({ data: null }) : sb.from('mm3_squeezing_nftji').select('equipped, attack_level').eq('wallet', attacker).maybeSingle(),
    victimIsAnon ? Promise.resolve({ data: null }) : sb.from('mm3_squeezing_nftji').select('equipped, defense_level').eq('wallet', victim).maybeSingle(),
    victimIsAnon ? Promise.resolve({ data: null }) : sb.from('mm3_pvp_health').select('health, pvp_dead_until').eq('wallet', victim).maybeSingle(),
  ])
  if (!attackerProgress && !attackerIsAnon) {
    return Response.json({ ok: false, error: 'attacker_not_found' }, { status: 403 })
  }

  // Reject hit if victim is currently dead (5-min cooldown active in DB)
  if (!victimIsAnon && victimHealth?.pvp_dead_until && new Date(victimHealth.pvp_dead_until) > new Date()) {
    return Response.json({ ok: false, error: 'victim_is_dead' }, { status: 409 })
  }

  // Defense NFTJI (🔰): 10% dodge chance when victim has it equipped
  const hasDefenseNftji = victimSqueezeNftji?.equipped === 'defense'
    && Number(victimSqueezeNftji?.defense_level ?? -1) >= 0
  if (!victimIsAnon && hasDefenseNftji && Math.random() < 0.10) {
    return Response.json({ ok: true, dodged: true, damage: 0, health: Number(victimHealth?.health ?? 100), killed: false })
  }

  const hasAttackNftji = squeezeNftji?.equipped === 'attack'
    && Number(squeezeNftji?.attack_level ?? -1) >= 0
  const critical = hasAttackNftji && Math.random() < 0.05
  const headshot = hitZone === 'head'
  const damage = headshot || critical ? 5 : 1

  const { data, error } = await sb.rpc('apply_mm3_pvp_hit', {
    p_attacker: attacker,
    p_victim: victim,
    p_victim_is_anon: victimIsAnon,
    p_damage: damage,
    p_eur_per_hit: 0.10,
  })
  if (error) {
    const code = error.message.includes('same_pool') ? 403
      : error.message.includes('anon_cannot_attack') ? 403 : 500
    return Response.json({ ok: false, error: error.message }, { status: code })
  }
  return Response.json({ ok: true, critical, headshot, hitZone, ...data })
}
