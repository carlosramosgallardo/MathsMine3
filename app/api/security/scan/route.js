export const dynamic  = 'force-dynamic'
export const maxDuration = 60

import { createClient } from '@supabase/supabase-js'
import { runAllChecks } from '@/lib/security-checks/index.js'

const SITE_URL     = 'https://mathsmine3.xyz'
const RATE_LIMIT_MS = 60 * 60 * 1000 // 1 scan por hora como máximo

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function triggeredBy(req) {
  const auth = req.headers.get('authorization') || ''
  const cron = process.env.CRON_SECRET || ''
  if (cron && auth === `Bearer ${cron}`) return 'cron'
  return 'manual'
}

function rateLimited(triggeredAt) {
  const retryAfter = Math.max(1, Math.ceil(
    (new Date(triggeredAt).getTime() + RATE_LIMIT_MS - Date.now()) / 1000
  ))
  return Response.json(
    { ok: false, error: 'rate_limited', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}

export async function POST(req) {
  const supabase = getSupabase()
  const by = triggeredBy(req)

  // Rate limit global: no más de 1 scan en una ventana móvil de 1 hora.
  const { data: recent } = await supabase
    .from('security_scans')
    .select('id, triggered_at')
    .gte('triggered_at', new Date(Date.now() - RATE_LIMIT_MS).toISOString())
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recent) {
    return rateLimited(recent.triggered_at)
  }

  // Crear registro 'running'
  const { data: scan, error: insertErr } = await supabase
    .from('security_scans')
    .insert({ triggered_by: by, status: 'running' })
    .select()
    .single()

  if (insertErr) {
    return Response.json({ ok: false, error: insertErr.message }, { status: 500 })
  }

  // Close the check/insert race: among simultaneous requests, only the first
  // committed row may continue to the expensive security checks.
  const windowStart = new Date(Date.now() - RATE_LIMIT_MS).toISOString()
  const { data: firstInWindow, error: windowErr } = await supabase
    .from('security_scans')
    .select('id, triggered_at')
    .gte('triggered_at', windowStart)
    .order('triggered_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (windowErr || !firstInWindow) {
    await supabase.from('security_scans').delete().eq('id', scan.id)
    return Response.json(
      { ok: false, error: 'rate_limit_unavailable' },
      { status: 503 }
    )
  }

  if (firstInWindow.id !== scan.id) {
    await supabase.from('security_scans').delete().eq('id', scan.id)
    return rateLimited(firstInWindow.triggered_at)
  }

  const start = Date.now()

  try {
    const { checks, score, overall } = await runAllChecks(SITE_URL)

    const failCount = checks.filter(c => c.status === 'fail' || c.status === 'error').length
    const warnCount = checks.filter(c => c.status === 'warn').length
    const summary   = `Score ${score}/100 · ${failCount} fail${failCount !== 1 ? 's' : ''}, ${warnCount} warn${warnCount !== 1 ? 's' : ''}`

    await supabase
      .from('security_scans')
      .update({
        status:       'completed',
        completed_at: new Date().toISOString(),
        duration_ms:  Date.now() - start,
        score,
        results:      { checks, overall },
        summary,
      })
      .eq('id', scan.id)

    return Response.json({ ok: true, scanId: scan.id, score, overall, summary })
  } catch (err) {
    await supabase
      .from('security_scans')
      .update({ status: 'failed', completed_at: new Date().toISOString(), duration_ms: Date.now() - start })
      .eq('id', scan.id)

    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}

// GET → último scan completado (para el cron badge)
export async function GET() {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('security_scans')
    .select('id, triggered_by, triggered_at, completed_at, duration_ms, status, score, summary')
    .eq('status', 'completed')
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Response.json(data ?? null)
}
