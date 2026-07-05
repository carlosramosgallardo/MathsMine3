export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import {
  M5_TRUMP_BOSS_ID,
  normalizeBossState,
  splitBossRewards,
} from '@/lib/m5-trump-boss'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

async function loadBossRow(sb) {
  const { data, error } = await sb
    .from('mm3_map_boss')
    .select('*')
    .eq('id', M5_TRUMP_BOSS_ID)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const now = Date.now()
  if (data.state === 'dead' && data.respawn_at && new Date(data.respawn_at).getTime() <= now) {
    const { data: revived, error: reviveError } = await sb
      .from('mm3_map_boss')
      .update({
        state: 'idle',
        health: data.max_health,
        damage_totals: {},
        defeated_at: null,
        respawn_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', M5_TRUMP_BOSS_ID)
      .select('*')
      .maybeSingle()
    if (reviveError) throw reviveError
    return revived || data
  }
  return data
}

export async function GET() {
  try {
    const sb = serviceClient()
    const row = await loadBossRow(sb)
    return Response.json(normalizeBossState(row))
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'boss_load_failed' }, { status: 500 })
  }
}

export async function distributeBossRewards(sb, damageTotals) {
  const payouts = splitBossRewards(damageTotals)
  const results = []
  for (const payout of payouts) {
    const { data: progress } = await sb
      .from('player_progress')
      .select('mm3_sold, eur_earned, usd_earned, cny_earned')
      .eq('wallet', payout.wallet)
      .maybeSingle()
    if (!progress) continue
    const mm3Sold = Number(progress.mm3_sold) || 0
    const eur = Number(progress.eur_earned) || 0
    const { error } = await sb
      .from('player_progress')
      .update({
        mm3_sold: mm3Sold - payout.mm3,
        eur_earned: eur + payout.eur,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet', payout.wallet)
    if (!error) results.push(payout)
  }
  return results
}
