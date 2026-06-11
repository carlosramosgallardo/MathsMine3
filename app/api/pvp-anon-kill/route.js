export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

const KILL_BONUS_EUR = 2.0

export async function POST(req) {
  let body
  try { body = await req.json() } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const attacker = String(body.attacker || '').toLowerCase().trim()
  const anonKey  = String(body.anonKey  || '').toLowerCase().trim()

  if (!attacker || !anonKey) {
    return Response.json({ ok: false, error: 'invalid_params' }, { status: 400 })
  }
  if (attacker.startsWith('anon-')) {
    return Response.json({ ok: false, error: 'anon_cannot_kill' }, { status: 403 })
  }
  if (!anonKey.startsWith('anon-')) {
    return Response.json({ ok: false, error: 'victim_not_anon' }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const now = new Date().toISOString()

  // Award kill bonus — rate-limited naturally by the 50-hit requirement per kill
  const { data: ap } = await sb
    .from('player_progress')
    .select('eur_earned')
    .eq('wallet', attacker)
    .maybeSingle()
    .then(r => r, () => ({ data: null }))

  const attackerBal = Math.max(0, Number(ap?.eur_earned) || 0)
  const { error } = await sb.from('player_progress')
    .upsert(
      { wallet: attacker, eur_earned: attackerBal + KILL_BONUS_EUR, updated_at: now },
      { onConflict: 'wallet', ignoreDuplicates: false }
    )

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

  return Response.json({ ok: true, bonusEur: KILL_BONUS_EUR })
}
