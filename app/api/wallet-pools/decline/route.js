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
  const inviteId = Number(body.inviteId || 0);
  if (!wallet || !inviteId) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data: invitation, error: invitationError } = await supabase
      .from('mm3_wallet_pool_invitations')
      .select('id, wallet, status')
      .eq('id', inviteId)
      .eq('wallet', wallet)
      .maybeSingle();

    if (invitationError) throw invitationError;
    if (!invitation || invitation.status !== 'pending') {
      return Response.json({ ok: false, error: 'invite_not_found' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('mm3_wallet_pool_invitations')
      .update({ status: 'declined', accepted_at: new Date().toISOString() })
      .eq('id', inviteId);

    if (updateError) throw updateError;

    return Response.json({ ok: true });
  } catch (error) {
    console.error('wallet pool decline error:', error);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}
