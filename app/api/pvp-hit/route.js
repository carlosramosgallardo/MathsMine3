export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

const MAX_HITS   = 100
const EUR_PER_HIT = 0.10   // stolen per hit (max 10 EUR/day per pair)

function dayKey(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString().slice(0, 10)
}

export async function POST(req) {
  let body
  try { body = await req.json() } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const attacker    = String(body.attacker    || '').toLowerCase().trim()
  const victim      = String(body.victim      || '').toLowerCase().trim()
  const victimIsAnon = Boolean(body.victimIsAnon)

  if (!attacker || !victim || attacker === victim) {
    return Response.json({ ok: false, error: 'invalid_params' }, { status: 400 })
  }
  // Only logged-in wallets can attack (not anon keys)
  if (attacker.startsWith('anon-')) {
    return Response.json({ ok: false, error: 'anon_cannot_attack' }, { status: 403 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const dk = dayKey()

  // ── Pool check: same pool → friendly fire off ─────────────────────────────
  if (!victimIsAnon) {
    const { data: myPools } = await sb
      .from('mm3_wallet_pool_members')
      .select('pool_code')
      .eq('wallet', attacker)
      .then(r => r, () => ({ data: [] }))

    if (myPools?.length) {
      const codes = myPools.map(m => m.pool_code)
      const { count } = await sb
        .from('mm3_wallet_pool_members')
        .select('*', { count: 'exact', head: true })
        .eq('wallet', victim)
        .in('pool_code', codes)
        .then(r => r, () => ({ count: 0 }))
      if (count > 0) {
        return Response.json({ ok: false, error: 'same_pool' }, { status: 403 })
      }
    }
  }

  // ── Daily hit count check ─────────────────────────────────────────────────
  const { data: existing } = await sb
    .from('mm3_pvp_hits')
    .select('hit_count, eur_stolen')
    .eq('attacker_wallet', attacker)
    .eq('victim_wallet', victim)
    .eq('day_key', dk)
    .maybeSingle()
    .then(r => r, () => ({ data: null }))

  const currentHits = existing?.hit_count ?? 0
  if (currentHits >= MAX_HITS) {
    return Response.json({ ok: false, error: 'daily_limit', hits: currentHits }, { status: 429 })
  }

  // ── Steal EUR from victim (skip for anon — they have no balance) ──────────
  let stolenEur = 0
  if (!victimIsAnon) {
    const { data: vp } = await sb
      .from('player_progress')
      .select('eur_earned')
      .eq('wallet', victim)
      .maybeSingle()
      .then(r => r, () => ({ data: null }))

    const victimBal = Math.max(0, Number(vp?.eur_earned) || 0)
    stolenEur = Math.min(EUR_PER_HIT, victimBal)

    if (stolenEur > 0) {
      const now = new Date().toISOString()
      // Deduct from victim
      await sb.from('player_progress')
        .update({ eur_earned: victimBal - stolenEur, updated_at: now })
        .eq('wallet', victim)
        .then(null, () => {})

      // Add to attacker
      const { data: ap } = await sb
        .from('player_progress')
        .select('eur_earned')
        .eq('wallet', attacker)
        .maybeSingle()
        .then(r => r, () => ({ data: null }))
      const attackerBal = Math.max(0, Number(ap?.eur_earned) || 0)
      await sb.from('player_progress')
        .upsert({ wallet: attacker, eur_earned: attackerBal + stolenEur, updated_at: now },
          { onConflict: 'wallet', ignoreDuplicates: false })
        .then(null, () => {})
    }
  }

  // ── Record hit ────────────────────────────────────────────────────────────
  const now = new Date().toISOString()
  await sb.from('mm3_pvp_hits')
    .upsert({
      attacker_wallet: attacker,
      victim_wallet:   victim,
      day_key:         dk,
      hit_count:       currentHits + 1,
      eur_stolen:      (existing?.eur_stolen ?? 0) + stolenEur,
      last_hit_at:     now,
      ...(currentHits === 0 ? { first_hit_at: now } : {}),
    }, { onConflict: 'attacker_wallet,victim_wallet,day_key', ignoreDuplicates: false })
    .then(null, () => {})

  return Response.json({
    ok: true,
    hits: currentHits + 1,
    stolenEur,
    atLimit: currentHits + 1 >= MAX_HITS,
  })
}
