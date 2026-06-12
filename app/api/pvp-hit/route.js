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
  const victimIsAnon = victim.startsWith('anon-') || Boolean(body.victimIsAnon)
  if (!attacker || !victim || attacker === victim) {
    return Response.json({ ok: false, error: 'invalid_params' }, { status: 400 })
  }

  const sb = serviceClient()
  const { data: attackerProgress } = await sb
    .from('player_progress').select('wallet_emojis').eq('wallet', attacker).maybeSingle()
  if (!attackerProgress) {
    return Response.json({ ok: false, error: 'attacker_not_found' }, { status: 403 })
  }
  const hasHeart = Array.isArray(attackerProgress?.wallet_emojis)
    && attackerProgress.wallet_emojis.includes('❤️')
  const critical = hasHeart && Math.random() < 0.05
  const damage = critical ? 5 : 1

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
  return Response.json({ ok: true, critical, ...data })
}
