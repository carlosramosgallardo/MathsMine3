import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET() {
  const { data, error } = await supabase
    .from('token_value_timeseries')
    .select('hour, cumulative_reward')
    .order('hour', { ascending: false }) // ← más reciente primero
    .limit(2000) // ← suficientes horas para cubrir 30 días

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Reordenamos en el cliente para usar hour ASC si es necesario
  const sorted = data.sort((a, b) => new Date(a.hour) - new Date(b.hour))

  return new Response(JSON.stringify(sorted), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60'
    }
  })
}
