export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { applyDeathLevelPenalty } from '@/lib/death-penalty'

// NPC bot chasers (M2–M5) deal a fixed 1 HP per hit, rate-limited hard so the
// endpoint stays near-free: one write per wallet at most every NPC_COOLDOWN_MS.
const NPC_DAMAGE = 1
const NPC_COOLDOWN_MS = 25_000

// Best-effort per-instance rate limit (no schema changes; the client also
// enforces a 30s cooldown — this guards against direct API abuse).
const lastHitByWallet = new Map()

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
  const npcWallet = String(body.npcWallet || '').toLowerCase().trim()
  if (!wallet) return Response.json({ ok: false, error: 'missing_wallet' }, { status: 400 })

  // Anon wallets have no server-side HP — client handles locally
  if (wallet.startsWith('anon-')) {
    return Response.json({ ok: true, isAnon: true })
  }

  const now = Date.now()
  const last = lastHitByWallet.get(wallet) || 0
  if (now - last < NPC_COOLDOWN_MS) {
    return Response.json({ ok: false, error: 'cooldown' }, { status: 429 })
  }
  lastHitByWallet.set(wallet, now)
  // Keep the map bounded
  if (lastHitByWallet.size > 5000) lastHitByWallet.clear()

  const sb = serviceClient()

  // No friendly fire: if the NPC's AI wallet shares a pool with the victim,
  // the hit is waived (same rule as PvP, storm and relay command penalties).
  if (npcWallet && npcWallet !== wallet) {
    const { data: poolRows } = await sb
      .from('mm3_wallet_pool_members')
      .select('wallet, pool_code')
      .in('wallet', [wallet, npcWallet])
    const victimPool = poolRows?.find(r => String(r.wallet).toLowerCase() === wallet)?.pool_code || null
    const npcPool = poolRows?.find(r => String(r.wallet).toLowerCase() === npcWallet)?.pool_code || null
    if (victimPool && npcPool && victimPool === npcPool) {
      return Response.json({ ok: true, immune: true, health: null, killed: false, damage: 0 })
    }
  }

  const { data: hData } = await sb
    .from('mm3_pvp_health')
    .select('health, pvp_dead_until')
    .eq('wallet', wallet)
    .maybeSingle()

  if (hData?.pvp_dead_until && new Date(hData.pvp_dead_until) > new Date()) {
    return Response.json({ ok: false, error: 'already_dead' }, { status: 409 })
  }

  const currentHP = Number(hData?.health ?? 100)
  const newHP = Math.max(0, currentHP - NPC_DAMAGE)
  const killed = newHP <= 0

  const updates = killed
    ? { health: 0, pvp_dead_until: new Date(now + 5 * 60 * 1000).toISOString() }
    : { health: newHP }

  await sb.from('mm3_pvp_health').upsert(
    { wallet, ...updates },
    { onConflict: 'wallet', ignoreDuplicates: false },
  )

  // Same rule as every other death: a killed logged-in player loses 1 level.
  if (killed) await applyDeathLevelPenalty(sb, wallet)

  return Response.json({ ok: true, health: newHP, killed, damage: NPC_DAMAGE })
}
