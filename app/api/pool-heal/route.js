export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

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
  if (!wallet || wallet.startsWith('anon-')) {
    return Response.json({ ok: false, error: 'invalid_wallet' }, { status: 400 })
  }

  const sb = serviceClient()
  const { data: current } = await sb
    .from('mm3_pvp_health')
    .select('health,pvp_dead_until')
    .eq('wallet', wallet)
    .maybeSingle()

  if (current?.pvp_dead_until && new Date(current.pvp_dead_until) > new Date()) {
    return Response.json({ ok: false, error: 'already_dead' }, { status: 409 })
  }

  const health = Math.min(100, Number(current?.health ?? 100) + 10)
  await sb
    .from('mm3_pvp_health')
    .upsert({ wallet, health }, { onConflict: 'wallet', ignoreDuplicates: false })

  return Response.json({ ok: true, health, healed: 10 })
}
