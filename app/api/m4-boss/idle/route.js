export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}

/** Boss returns to idle when no alive fighters remain on M4. */
export async function POST() {
  const sb = serviceClient()
  const { data, error } = await sb.rpc('set_mm3_boss_idle_if_requested', { p_map_id: '4' })
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true, mapId: '4', ...data })
}
