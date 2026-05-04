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

    // Check if the accepting wallet is already in this pool (join-request approval flow).
    // In that case the wallet accepting is the approver, and the actual joiner is invited_by.
    const { data: approverMember, error: memberError } = await supabase
      .from('mm3_wallet_pool_members')
      .select('wallet, pool_code')
      .eq('wallet', wallet)
      .maybeSingle();

    if (memberError) throw memberError;

    const isJoinRequest =
      approverMember &&
      approverMember.pool_code === invitation.pool_code;

    if (approverMember && !isJoinRequest) {
      // Approver is in a different pool — invalid state
      return Response.json({ ok: false, error: 'already_in_pool' }, { status: 409 });
    }

    // The wallet that will actually join the pool
    const joinerWallet = isJoinRequest ? invitation.invited_by : wallet;
    const addedBy = isJoinRequest ? wallet : invitation.invited_by;

    // Check cooldown — wallet that recently left cannot rejoin for 24h
    const { data: cooldownData } = await supabase
      .from('mm3_wallet_pool_cooldowns')
      .select('expires_at')
      .eq('wallet', joinerWallet)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cooldownData) {
      return Response.json({ ok: false, error: 'leave_cooldown', expiresAt: cooldownData.expires_at }, { status: 409 });
    }

    // Validate joiner is not already in any pool
    if (isJoinRequest) {
      const { data: joinerMember } = await supabase
        .from('mm3_wallet_pool_members')
        .select('wallet')
        .eq('wallet', joinerWallet)
        .maybeSingle();
      if (joinerMember) {
        return Response.json({ ok: false, error: 'requester_already_in_pool' }, { status: 409 });
      }
    }

    const { data: poolMembers, error: countError } = await supabase
      .from('mm3_wallet_pool_members')
      .select('wallet, player_progress(level)')
      .eq('pool_code', invitation.pool_code);

    if (countError) throw countError;

    const memberCount = (poolMembers || []).length;
    const avgLevel = memberCount > 0
      ? Math.round((poolMembers || []).reduce((s, m) => s + (m.player_progress?.level || 0), 0) / memberCount)
      : 0;

    const { data: maxData } = await supabase
      .rpc('mm3_pool_max_wallets', { p_avg_level: avgLevel });

    const poolMax = Number(maxData || 5);
    if (memberCount >= poolMax) {
      return Response.json({ ok: false, error: 'pool_full' }, { status: 409 });
    }

    const { error: insertError } = await supabase
      .from('mm3_wallet_pool_members')
      .insert({ wallet: joinerWallet, pool_code: invitation.pool_code, added_by: addedBy });

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
