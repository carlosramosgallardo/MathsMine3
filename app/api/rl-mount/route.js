export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { RL_NODE_EVENT_EMOJI, RL_NODE_MIN_LEVEL, RL_NODE_PRICE_MM3 } from '@/lib/mining-rl-mount'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

export async function GET(req) {
  const wallet = String(new URL(req.url).searchParams.get('wallet') || '').toLowerCase().trim()
  if (!wallet) return Response.json({ ok: false, error: 'missing_wallet' }, { status: 400 })
  try {
    const sb = serviceClient()
    const { data, error } = await sb
      .from('player_progress')
      .select('rl_mount_active')
      .eq('wallet', wallet)
      .maybeSingle()
    if (error) throw error
    return Response.json({ ok: true, active: Boolean(data?.rl_mount_active) })
  } catch {
    return Response.json({ ok: false, error: 'rl_mount_unavailable' }, { status: 500 })
  }
}

export async function POST(req) {
  let body
  try { body = await req.json() } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const wallet = String(body.wallet || '').toLowerCase().trim()
  if (!wallet) return Response.json({ ok: false, error: 'missing_wallet' }, { status: 400 })

  const sb = serviceClient()
  const [{ data: progress }, { data: balance }] = await Promise.all([
    sb.from('player_progress').select('level,mm3_sold,rl_mount_active').eq('wallet', wallet).maybeSingle(),
    sb.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
  ])

  if (progress?.rl_mount_active) {
    return Response.json({ ok: false, error: 'already_owned' }, { status: 409 })
  }

  const level = Number(progress?.level) || 0
  const soldMm3 = Number(progress?.mm3_sold) || 0
  const mm3 = (Number(balance?.total_eth) || 0) - soldMm3

  if (level < RL_NODE_MIN_LEVEL) {
    return Response.json({ ok: false, error: 'min_level', minLevel: RL_NODE_MIN_LEVEL }, { status: 403 })
  }
  if (mm3 < RL_NODE_PRICE_MM3) {
    return Response.json({ ok: false, error: 'not_enough_mm3', price: RL_NODE_PRICE_MM3 }, { status: 403 })
  }

  const { error: updateError } = await sb
    .from('player_progress')
    .update({
      mm3_sold: soldMm3 + RL_NODE_PRICE_MM3,
      rl_mount_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('wallet', wallet)

  if (updateError) return Response.json({ ok: false, error: 'purchase_failed' }, { status: 500 })

  await sb.from('mm3_mining_events').insert({
    wallet,
    event_type: 'rl_mount_buy',
    delta_mm3: RL_NODE_PRICE_MM3,
    emoji: RL_NODE_EVENT_EMOJI,
  })

  return Response.json({ ok: true, active: true })
}

export async function DELETE(req) {
  let body
  try { body = await req.json() } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const wallet = String(body.wallet || '').toLowerCase().trim()
  if (!wallet) return Response.json({ ok: false, error: 'missing_wallet' }, { status: 400 })

  const sb = serviceClient()
  const { error } = await sb
    .from('player_progress')
    .update({ rl_mount_active: false, updated_at: new Date().toISOString() })
    .eq('wallet', wallet)

  if (error) return Response.json({ ok: false, error: 'clear_failed' }, { status: 500 })
  return Response.json({ ok: true, active: false })
}
