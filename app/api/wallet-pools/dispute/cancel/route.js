export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const disputeId = Number(body.disputeId || 0);
  if (!disputeId) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase.rpc('mm3_dispute_cancel', {
      p_dispute_id: disputeId,
    });

    if (error) throw error;

    if (data?.error) {
      if (data.error === 'not_expired_yet') {
        return Response.json({ ok: false, error: 'not_expired_yet' }, { status: 409 });
      }
      if (data.error === 'wrong_status') {
        return Response.json({ ok: false, error: 'wrong_status', status: data.status }, { status: 409 });
      }
      return Response.json({ ok: false, error: data.error }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('dispute cancel error:', error);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}
