export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

// Mirrors getDiceWindowForHour from lib/dice.js (server-side validation)
function seededRand(n) {
  let s = (n ^ 0xdeadbeef) >>> 0
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0
  return ((s ^ (s >>> 16)) >>> 0) / 0x100000000
}

function isDiceWindowActive(now = Date.now()) {
  const hourStart = Math.floor(now / 3_600_000) * 3_600_000
  const seed = Math.floor(hourStart / 3_600_000)
  const r1 = seededRand(seed * 1664525 + 1013904223)
  const startMs = hourStart + (Math.floor(r1 * 2699) + 1) * 1000
  const endMs = startMs + 15 * 60 * 1000
  return now >= startMs && now < endMs
}

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
  const mode   = body.mode === 'war' ? 'war' : 'meteo'

  if (!wallet) return Response.json({ ok: false, error: 'missing_wallet' }, { status: 400 })

  if (!isDiceWindowActive()) {
    return Response.json({ ok: false, error: 'dice_not_active' }, { status: 409 })
  }

  // Anon wallets have no server-side HP — client handles locally
  if (wallet.startsWith('anon-')) {
    return Response.json({ ok: true, isAnon: true })
  }

  const sb = serviceClient()

  const [{ data: macro }, { data: hData }] = await Promise.all([
    sb.from('mm3_macro_state').select('war_percent, nature_percent').eq('id', 1).maybeSingle(),
    sb.from('mm3_pvp_health').select('health, pvp_dead_until').eq('wallet', wallet).maybeSingle(),
  ])

  if (hData?.pvp_dead_until && new Date(hData.pvp_dead_until) > new Date()) {
    return Response.json({ ok: false, error: 'already_dead' }, { status: 409 })
  }

  const warPercent    = Number(macro?.war_percent)    || 0
  const naturePercent = Number(macro?.nature_percent) || 0
  const damage        = mode === 'war' ? warPercent : naturePercent
  const currentHP     = Number(hData?.health ?? 100)
  const newHP         = Math.max(0, currentHP - damage)
  const killed        = newHP <= 0

  const updates = killed
    ? { health: 0, pvp_dead_until: new Date(Date.now() + 5 * 60 * 1000).toISOString() }
    : { health: newHP }

  await sb.from('mm3_pvp_health').upsert(
    { wallet, ...updates },
    { onConflict: 'wallet', ignoreDuplicates: false },
  )

  return Response.json({ ok: true, health: newHP, killed, damage })
}
