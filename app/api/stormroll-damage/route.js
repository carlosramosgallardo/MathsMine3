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

function getDiceHourStart(now = Date.now()) {
  return Math.floor(now / 3_600_000) * 3_600_000
}

function nodeModeFor(wallet, hourStart) {
  const seed = `${String(wallet || '').toLowerCase()}:${Number(hourStart) || 0}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  return Math.abs(hash) % 2 === 0 ? 'meteo' : 'war'
}

import { HOUSE_POOL_HEAL_ZONE } from '@/lib/mining-world-layout'

function isInPoolSafeZone(gx, gy) {
  return gx > HOUSE_POOL_HEAL_ZONE.minX && gx < HOUSE_POOL_HEAL_ZONE.maxX &&
    gy > HOUSE_POOL_HEAL_ZONE.minZ && gy < HOUSE_POOL_HEAL_ZONE.maxZ
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
  const gx = Number(body.gx)
  const gy = Number(body.gy)

  if (!wallet) return Response.json({ ok: false, error: 'missing_wallet' }, { status: 400 })

  if (!isDiceWindowActive()) {
    return Response.json({ ok: false, error: 'dice_not_active' }, { status: 409 })
  }

  if (Number.isFinite(gx) && Number.isFinite(gy) && isInPoolSafeZone(gx, gy)) {
    return Response.json({ ok: true, immune: true, health: null, killed: false, damage: 0 })
  }

  // Anon wallets have no server-side HP — client handles locally
  if (wallet.startsWith('anon-')) {
    return Response.json({ ok: true, isAnon: true })
  }

  const sb = serviceClient()

  const [{ data: macro }, { data: hData }] = await Promise.all([
    sb.from('mm3_macro_state')
      .select('war_percent, nature_percent, node_dice_wallet, node_dice_expires_at')
      .eq('id', 1)
      .maybeSingle(),
    sb.from('mm3_pvp_health').select('health, pvp_dead_until').eq('wallet', wallet).maybeSingle(),
  ])

  const nodeWallet = String(macro?.node_dice_wallet || '').toLowerCase()
  const nodeExpires = macro?.node_dice_expires_at ? new Date(macro.node_dice_expires_at).getTime() : 0
  if (!nodeWallet || !nodeExpires || nodeExpires <= Date.now()) {
    return Response.json({ ok: false, error: 'node_dice_not_active' }, { status: 409 })
  }

  if (hData?.pvp_dead_until && new Date(hData.pvp_dead_until) > new Date()) {
    return Response.json({ ok: false, error: 'already_dead' }, { status: 409 })
  }

  // Friendly-fire off: the dice storm only hurts wallets OPPOSED to the buyer.
  // The buyer themselves, and anyone in the buyer's pool, take no damage.
  if (wallet === nodeWallet) {
    return Response.json({ ok: true, immune: true, health: hData?.health ?? null, killed: false, damage: 0 })
  }
  const { data: poolRows } = await sb
    .from('mm3_wallet_pool_members')
    .select('wallet, pool_code')
    .in('wallet', [wallet, nodeWallet])
  const targetPool = poolRows?.find(r => r.wallet === wallet)?.pool_code || null
  const buyerPool  = poolRows?.find(r => r.wallet === nodeWallet)?.pool_code || null
  if (targetPool && buyerPool && targetPool === buyerPool) {
    return Response.json({ ok: true, immune: true, health: hData?.health ?? null, killed: false, damage: 0 })
  }

  const warPercent    = Number(macro?.war_percent)    || 0
  const naturePercent = Number(macro?.nature_percent) || 0
  const mode          = nodeModeFor(nodeWallet, getDiceHourStart())
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
