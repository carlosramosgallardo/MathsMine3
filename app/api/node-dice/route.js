export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { getDiceState } from '@/lib/dice'

const NODE_DICE_PRICE_MM3 = 500
const NODE_DICE_MIN_LEVEL = 30
const NODE_DICE_DURATION_MS = 24 * 60 * 60 * 1000

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

function modeFor(wallet, hourStart) {
  const seed = `${String(wallet || '').toLowerCase()}:${Number(hourStart) || 0}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  return Math.abs(hash) % 2 === 0 ? 'meteo' : 'war'
}

function serializeNodeDice(row, now = Date.now()) {
  const expiresMs = row?.node_dice_expires_at ? new Date(row.node_dice_expires_at).getTime() : 0
  const wallet = String(row?.node_dice_wallet || '').toLowerCase()
  if (!wallet || !expiresMs || expiresMs <= now) return null
  const dice = getDiceState(now)
  const mode = dice.active ? modeFor(wallet, dice.hourStart) : (row.node_dice_mode === 'war' ? 'war' : 'meteo')
  return {
    wallet,
    startedAt: row.node_dice_started_at ? new Date(row.node_dice_started_at).getTime() : now,
    expiresAt: expiresMs,
    mode,
    hourStart: dice.active ? dice.hourStart : Number(row.node_dice_hour_start) || 0,
    warPercent: Number(row.node_dice_war_percent ?? row.war_percent) || 0,
    naturePercent: Number(row.node_dice_nature_percent ?? row.nature_percent) || 0,
  }
}

async function loadMacro(sb) {
  return sb
    .from('mm3_macro_state')
    .select('war_percent,nature_percent,node_dice_wallet,node_dice_started_at,node_dice_expires_at,node_dice_mode,node_dice_hour_start,node_dice_war_percent,node_dice_nature_percent')
    .eq('id', 1)
    .maybeSingle()
}

export async function GET() {
  try {
    const sb = serviceClient()
    const { data, error } = await loadMacro(sb)
    if (error) throw error
    return Response.json({ ok: true, nodeDice: serializeNodeDice(data) })
  } catch (error) {
    return Response.json({ ok: false, error: 'node_dice_unavailable' }, { status: 500 })
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
  const { data: macro, error: macroError } = await loadMacro(sb)
  if (macroError) return Response.json({ ok: false, error: 'node_dice_unavailable' }, { status: 500 })

  const current = serializeNodeDice(macro)
  if (current) return Response.json({ ok: true, nodeDice: current, alreadyActive: true })

  const [{ data: progress }, { data: balance }] = await Promise.all([
    sb.from('player_progress').select('level,mm3_sold').eq('wallet', wallet).maybeSingle(),
    sb.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
  ])
  const level = Number(progress?.level) || 0
  const mm3 = (Number(balance?.total_eth) || 0) - (Number(progress?.mm3_sold) || 0)
  if (level < NODE_DICE_MIN_LEVEL) {
    return Response.json({ ok: false, error: 'min_level', minLevel: NODE_DICE_MIN_LEVEL }, { status: 403 })
  }
  if (mm3 < NODE_DICE_PRICE_MM3) {
    return Response.json({ ok: false, error: 'not_enough_mm3', price: NODE_DICE_PRICE_MM3 }, { status: 403 })
  }

  const now = Date.now()
  const soldMm3 = Number(progress?.mm3_sold) || 0
  const { error: payError } = await sb
    .from('player_progress')
    .update({
      mm3_sold: soldMm3 + NODE_DICE_PRICE_MM3,
      updated_at: new Date(now).toISOString(),
    })
    .eq('wallet', wallet)
  if (payError) return Response.json({ ok: false, error: 'purchase_failed' }, { status: 500 })

  const dice = getDiceState(now)
  const mode = dice.active ? modeFor(wallet, dice.hourStart) : (Math.random() < .5 ? 'meteo' : 'war')
  const update = {
    node_dice_wallet: wallet,
    node_dice_started_at: new Date(now).toISOString(),
    node_dice_expires_at: new Date(now + NODE_DICE_DURATION_MS).toISOString(),
    node_dice_mode: mode,
    node_dice_hour_start: dice.active ? dice.hourStart : 0,
    node_dice_war_percent: Number(macro?.war_percent) || 0,
    node_dice_nature_percent: Number(macro?.nature_percent) || 0,
    updated_at: new Date(now).toISOString(),
  }
  const { data: saved, error: saveError } = await sb
    .from('mm3_macro_state')
    .update(update)
    .eq('id', 1)
    .select('war_percent,nature_percent,node_dice_wallet,node_dice_started_at,node_dice_expires_at,node_dice_mode,node_dice_hour_start,node_dice_war_percent,node_dice_nature_percent')
    .maybeSingle()

  if (saveError) return Response.json({ ok: false, error: 'activate_failed' }, { status: 500 })
  await sb.from('mm3_mining_events').insert({
    wallet,
    event_type: 'node_stormroll',
    delta_mm3: NODE_DICE_PRICE_MM3,
    emoji: '🎲',
  })
  return Response.json({ ok: true, nodeDice: serializeNodeDice(saved) })
}
