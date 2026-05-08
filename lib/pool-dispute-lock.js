const ACTIVE_SQUEEZE_STATUSES = ['proposing', 'registering', 'battle_start'];

export async function getActivePoolDispute(supabase, poolCode) {
  const pool = String(poolCode || '').trim().toUpperCase();
  if (!pool) return null;

  const { data, error } = await supabase
    .from('mm3_pool_disputes')
    .select('id, challenger_pool_code, defender_pool_code, status')
    .or(`challenger_pool_code.eq.${pool},defender_pool_code.eq.${pool}`)
    .in('status', ACTIVE_SQUEEZE_STATUSES)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== '42P01') throw error;
  return data || null;
}
