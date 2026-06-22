export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

function normalizeWallet(value) {
  return String(value || '').trim().toLowerCase();
}

function getUtcDay() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const wallet = normalizeWallet(searchParams.get('wallet'));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const [
    { data: solversRows },
    { count: alpha },
    { count: beta },
    { data: tvRow },
    { data: macroRow },
  ] = await Promise.all([
    supabase.from('mm3_chain_solvers').select('wallet, solved_at, formula_solved').order('solved_at', { ascending: true }),
    supabase.from('mm3_mining_events').select('id', { count: 'exact', head: true }),
    supabase.from('mm3_mined_blocks').select('id', { count: 'exact', head: true }),
    supabase.from('token_value').select('total_eth').maybeSingle(),
    supabase.from('mm3_macro_state').select('chain_demine_active, chain_demine_hits_remaining').eq('id', 1).maybeSingle(),
  ]);

  const mm3Global = Number(tvRow?.total_eth) || 0;
  const gamma = Math.round(Math.abs(mm3Global) * 100);
  const solvers = solversRows || [];
  const chainDemineActive = Boolean(macroRow?.chain_demine_active);
  const chainDemineHitsRemaining = Number(macroRow?.chain_demine_hits_remaining ?? 100);

  // Wallet already solved lifetime → canAttempt = false forever
  const walletSolved = wallet ? solvers.some(s => s.wallet === wallet) : false;

  let canAttempt = Boolean(wallet) && !walletSolved;
  let attemptedAt = null;
  let resetAt = null;

  if (wallet && !walletSolved) {
    const day = getUtcDay();
    const { data: attempt } = await supabase
      .from('mm3_chain_solve_attempts')
      .select('attempted_at')
      .eq('wallet', wallet)
      .eq('day', day)
      .maybeSingle();

    if (attempt) {
      canAttempt = false;
      attemptedAt = attempt.attempted_at;
      const attemptMs = new Date(attempt.attempted_at).getTime();
      resetAt = new Date(attemptMs + 24 * 60 * 60 * 1000).toISOString();
    }
  }

  return Response.json({
    ok: true,
    solvers,
    walletSolved,
    chainDemineActive,
    chainDemineHitsRemaining,
    canAttempt,
    attemptedAt,
    resetAt,
    alpha: Number(alpha) || 0,
    beta: Number(beta) || 0,
    gamma,
    mm3Global,
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
