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
      .select('id, wallet, invited_by, pool_code, status')
      .eq('id', inviteId)
      .eq('wallet', wallet)
      .maybeSingle();

    if (invitationError) throw invitationError;
    if (!invitation || invitation.status !== 'pending') {
      return Response.json({ ok: false, error: 'invite_not_found' }, { status: 404 });
    }

    const { data: existingMember, error: memberError } = await supabase
      .from('mm3_wallet_pool_members')
      .select('wallet')
      .eq('wallet', wallet)
      .maybeSingle();

    if (memberError) throw memberError;
    if (existingMember) {
      return Response.json({ ok: false, error: 'already_in_pool' }, { status: 409 });
    }

    const { count, error: countError } = await supabase
      .from('mm3_wallet_pool_members')
      .select('*', { count: 'exact', head: true })
      .eq('pool_code', invitation.pool_code);

    if (countError) throw countError;
    if (Number(count || 0) >= 5) {
      return Response.json({ ok: false, error: 'pool_full' }, { status: 409 });
    }

    const { error: insertError } = await supabase
      .from('mm3_wallet_pool_members')
      .insert({ wallet, pool_code: invitation.pool_code, added_by: invitation.invited_by });

    if (insertError) throw insertError;

    const { error: updateInviteError } = await supabase
      .from('mm3_wallet_pool_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', inviteId);

    if (updateInviteError) throw updateInviteError;

    const { error: updatePoolError } = await supabase
      .from('mm3_wallet_pools')
      .update({ updated_at: new Date().toISOString() })
      .eq('pool_code', invitation.pool_code);

    if (updatePoolError) throw updatePoolError;

    return Response.json({ ok: true, poolCode: invitation.pool_code });
  } catch (error) {
    console.error('wallet pool accept error:', error);
    const missingTable = error?.code === '42P01';
    return Response.json(
      { ok: false, error: missingTable ? 'wallet_pools_not_installed' : 'db_error' },
      { status: missingTable ? 501 : 500 }
    );
  }
}
