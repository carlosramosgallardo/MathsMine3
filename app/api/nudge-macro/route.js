export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { clampMacroPercent, NUDGE_MAX_DELTA } from '@/lib/mm3-macro';
import { walletFromRequest } from '@/lib/wallet-session';
import { unitRandom } from '@/lib/game-random';

function randomNudge(current) {
  const delta = (unitRandom() * (2 * NUDGE_MAX_DELTA)) - NUDGE_MAX_DELTA;
  return clampMacroPercent(current + delta);
}

export async function POST(req) {
  if (!walletFromRequest(req)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // Server-role client: bypasses RLS but that's fine here, since the values
  // below are always derived server-side from the current row, never trusted
  // from the request body. See 2026-07 security audit — the previous version
  // upserted the caller's own war_percent/nature_percent verbatim, letting
  // any request set the global storm state to 100% (instant-kill damage).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: current } = await supabase
    .from('mm3_macro_state')
    .select('war_percent, nature_percent')
    .eq('id', 1)
    .maybeSingle();

  const war_percent    = randomNudge(Number(current?.war_percent) || 0);
  const nature_percent = randomNudge(Number(current?.nature_percent) || 0);

  const { error } = await supabase
    .from('mm3_macro_state')
    .upsert(
      { id: 1, war_percent, nature_percent, updated_at: new Date().toISOString() },
      { onConflict: 'id', ignoreDuplicates: false }
    );

  if (error) {
    console.error('nudge-macro error:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, war_percent, nature_percent });
}
