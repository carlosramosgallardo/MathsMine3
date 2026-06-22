import { createClient } from '@supabase/supabase-js'
import { CNY_TO_EUR, CNY_TO_USD } from '@/lib/sell-offer'

export const dynamic = 'force-dynamic'

function normalizeWallet(w) {
  return typeof w === 'string' ? w.toLowerCase().trim() : ''
}

export async function POST(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

  let body
  try { body = await req.json() } catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }) }

  const wallet    = normalizeWallet(body.wallet)
  const penaltyId = body.penaltyId
  const code      = String(body.code || '').replace(/\D/g, '').slice(0, 5)
  const blockHex  = String(body.blockHex || '')
  const blockEmoji = String(body.blockEmoji || '')
  const language  = String(body.language || 'en')

  if (!wallet || !penaltyId || !code) {
    return Response.json({ ok: false, error: 'missing_params' }, { status: 400 })
  }

  const { data: penalty, error: fetchErr } = await supabase
    .from('mm3_command_penalties')
    .select('id, penalty_code, penalty_value, penalty_eur, penalty_effect, attempted_at, redeemed_at')
    .eq('id', penaltyId)
    .eq('wallet', wallet)
    .is('redeemed_at', null)
    .is('attempted_at', null)
    .maybeSingle()

  if (fetchErr) return Response.json({ ok: false, error: fetchErr.message }, { status: 500 })
  if (!penalty)  return Response.json({ ok: false, error: 'penalty_not_found_or_used' }, { status: 404 })

  const now = new Date().toISOString()
  const isCorrect = code === String(penalty.penalty_code || '')
  const updatePayload = isCorrect ? { attempted_at: now, redeemed_at: now } : { attempted_at: now }

  const { error: updateErr } = await supabase
    .from('mm3_command_penalties')
    .update(updatePayload)
    .eq('id', penaltyId)
    .is('redeemed_at', null)
    .is('attempted_at', null)

  if (updateErr) return Response.json({ ok: false, error: updateErr.message }, { status: 500 })

  if (isCorrect) {
    const refundEur = Number(penalty.penalty_eur) || 0
    const refundMm3 = Number(penalty.penalty_value) || 0

    const { data: progressRow } = await supabase
      .from('player_progress')
      .select('mm3_sold, eur_earned, usd_earned, cny_earned')
      .eq('wallet', wallet)
      .maybeSingle()

    const refundPayload = refundEur > 0
      ? {
          wallet,
          eur_earned: (Number(progressRow?.eur_earned) || 0) + refundEur,
          usd_earned: (Number(progressRow?.usd_earned) || 0) + refundEur * (CNY_TO_USD / CNY_TO_EUR),
          cny_earned: (Number(progressRow?.cny_earned) || 0) + refundEur / CNY_TO_EUR,
          updated_at: now,
        }
      : {
          wallet,
          mm3_sold: Math.max(0, (Number(progressRow?.mm3_sold) || 0) - refundMm3),
          updated_at: now,
        }

    await supabase
      .from('player_progress')
      .upsert(refundPayload, { onConflict: 'wallet', ignoreDuplicates: false })

    const shortW = wallet.slice(0, 6) + '…' + wallet.slice(-4)
    const text = language === 'es'
      ? `código ok >> ${blockEmoji} ${blockHex} >> ${shortW} >> penalización reset`
      : `code ok >> ${blockEmoji} ${blockHex} >> ${shortW} >> penalty reset`

    await supabase.from('mm3_relaying_messages').insert({
      wallet: 'system',
      text,
      ts: Date.now(),
      kind: 'system',
      tone: 'market',
    }).then(() => {})
  }

  return Response.json({ ok: true, redeemed: isCorrect, wrong: !isCorrect })
}
