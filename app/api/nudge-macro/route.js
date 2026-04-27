export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { clampMacroPercent } from '@/lib/mm3-macro';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }

  const war_percent     = clampMacroPercent(body.war_percent);
  const nature_percent  = clampMacroPercent(body.nature_percent);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

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
