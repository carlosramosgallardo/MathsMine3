export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

export async function GET(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { searchParams } = new URL(req.url)
  const id     = searchParams.get('id')
  const limit  = Math.min(50, parseInt(searchParams.get('limit') || '20', 10))

  // Detalle de un scan concreto (con results completo)
  if (id) {
    const { data, error } = await supabase
      .from('security_scans')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data)  return Response.json({ error: 'not_found' }, { status: 404 })
    return Response.json(data)
  }

  // Listado (sin results para no transferir datos innecesarios)
  const { data, error } = await supabase
    .from('security_scans')
    .select('id, triggered_by, triggered_at, completed_at, duration_ms, status, score, summary')
    .order('triggered_at', { ascending: false })
    .limit(limit)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
