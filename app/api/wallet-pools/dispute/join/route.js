export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

function normalizeWallet(value) {
  return String(value || '').trim().toLowerCase();
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = normalizeWallet(body.wallet);
  const disputeId = Number(body.disputeId || 0);

  if (!wallet || !disputeId) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase.rpc('mm3_dispute_join', {
      p_dispute_id: disputeId,
      p_wallet: wallet,
    });

    if (error) throw error;

    if (data?.error) {
      const statusMap = {
        dispute_not_found: 404,
        registration_closed: 409,
        registration_expired: 410,
        not_in_challenger_pool: 403,
      };
      return Response.json(
        { ok: false, error: data.error },
        { status: statusMap[data.error] || 400 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('dispute join error:', error);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}
