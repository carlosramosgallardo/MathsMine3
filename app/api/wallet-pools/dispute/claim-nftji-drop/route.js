export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const { disputeId, wallet } = await req.json();

  if (!disputeId || !wallet) {
    return Response.json({ ok: false, error: 'missing_params' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase.rpc('mm3_squeeze_nftji_take', {
      p_dispute_id: disputeId,
      p_wallet: wallet,
    });

    if (error) throw error;
    if (data?.error) return Response.json({ ok: false, error: data.error }, { status: 400 });

    return Response.json({ ok: true, ...data });
  } catch (err) {
    console.error('claim-nftji-drop error:', err);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}
