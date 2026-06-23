export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

const DEAD_MINUTES = 5

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

// GET ?wallet=xxx — check dead state + return last alive position
export async function GET(req) {
  const wallet = new URL(req.url).searchParams.get('wallet')?.toLowerCase().trim()
  if (!wallet) return Response.json({ ok: false, error: 'missing_wallet' }, { status: 400 })

  const { data } = await serviceClient()
    .from('mm3_pvp_health')
    .select('pvp_dead_until, pvp_dead_gx, pvp_dead_gy, last_pos_row, last_pos_col, last_pos_z')
    .eq('wallet', wallet)
    .maybeSingle()

  const posRow = data?.last_pos_row ?? null
  const posCol = data?.last_pos_col ?? null
  const posZ = data?.last_pos_z ?? null

  if (!data?.pvp_dead_until) {
    return Response.json({ ok: true, dead: false, posRow, posCol, posZ })
  }

  const deadUntil = new Date(data.pvp_dead_until)
  if (deadUntil <= new Date()) {
    serviceClient().from('mm3_pvp_health')
      .update({ pvp_dead_until: null, pvp_dead_gx: null, pvp_dead_gy: null })
      .eq('wallet', wallet)
      .then(() => {}).catch(() => {})
    return Response.json({ ok: true, dead: false, posRow, posCol, posZ })
  }

  return Response.json({
    ok: true,
    dead: true,
    deadUntil: data.pvp_dead_until,
    gx: data.pvp_dead_gx,
    gy: data.pvp_dead_gy,
    posRow,
    posCol,
    posZ,
  })
}

// PATCH { wallet, row, col, z } — persist alive position (throttled client-side)
export async function PATCH(req) {
  let body
  try { body = await req.json() } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }
  const wallet = String(body.wallet || '').toLowerCase().trim()
  if (!wallet || wallet.startsWith('anon-')) {
    return Response.json({ ok: false, error: 'anon_or_missing' }, { status: 400 })
  }
  const row = Number(body.row)
  const col = Number(body.col)
  const z = Number(body.z ?? 0)
  if (!Number.isFinite(row) || !Number.isFinite(col)) {
    return Response.json({ ok: false, error: 'bad_pos' }, { status: 400 })
  }
  if (!Number.isFinite(z)) {
    return Response.json({ ok: false, error: 'bad_z' }, { status: 400 })
  }

  const { error } = await serviceClient()
    .from('mm3_pvp_health')
    .upsert(
      { wallet, last_pos_row: row, last_pos_col: col, last_pos_z: z, pos_updated_at: new Date().toISOString() },
      { onConflict: 'wallet', ignoreDuplicates: false },
    )

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

// POST { wallet, gx, gy } — record a fresh death (5-min cooldown)
export async function POST(req) {
  let body
  try { body = await req.json() } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const wallet = String(body.wallet || '').toLowerCase().trim()
  if (!wallet || wallet.startsWith('anon-')) {
    return Response.json({ ok: false, error: 'anon_or_missing' }, { status: 400 })
  }

  const deadUntil = new Date(Date.now() + DEAD_MINUTES * 60 * 1000).toISOString()
  const gx = Number(body.gx) || 14.5
  const gy = Number(body.gy) || 14.5

  const { error } = await serviceClient()
    .from('mm3_pvp_health')
    .upsert(
      { wallet, pvp_dead_until: deadUntil, pvp_dead_gx: gx, pvp_dead_gy: gy },
      { onConflict: 'wallet', ignoreDuplicates: false },
    )

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
  return Response.json({ ok: true, deadUntil })
}

// DELETE ?wallet=xxx — clear death on respawn
export async function DELETE(req) {
  const wallet = new URL(req.url).searchParams.get('wallet')?.toLowerCase().trim()
  if (!wallet) return Response.json({ ok: false, error: 'missing_wallet' }, { status: 400 })

  await serviceClient()
    .from('mm3_pvp_health')
    .update({ pvp_dead_until: null, pvp_dead_gx: null, pvp_dead_gy: null })
    .eq('wallet', wallet)

  return Response.json({ ok: true })
}
