export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

const POOL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalizeWallet(value) {
  return String(value || '').toLowerCase().trim();
}

function randomPoolCode() {
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code += POOL_ALPHABET[Math.floor(Math.random() * POOL_ALPHABET.length)];
  }
  return code;
}

async function createUniquePool(supabase, wallet) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const poolCode = randomPoolCode();
    const { error } = await supabase
      .from('mm3_wallet_pools')
      .insert({ pool_code: poolCode, created_by: wallet });

    if (!error) return poolCode;
    if (error.code !== '23505') throw error;
  }
  throw new Error('pool_code_collision');
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = normalizeWallet(body.wallet);
  const targetWallet = normalizeWallet(body.targetWallet);

  if (!wallet || !targetWallet || wallet === targetWallet) {
    return Response.json({ ok: false, error: 'invalid_wallets' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data: existingMembers, error: membersError } = await supabase
      .from('mm3_wallet_pool_members')
      .select('wallet, pool_code')
      .in('wallet', [wallet, targetWallet]);

    if (membersError) throw membersError;

    const walletPool = existingMembers?.find((row) => row.wallet === wallet)?.pool_code || '';
    const targetPool = existingMembers?.find((row) => row.wallet === targetWallet)?.pool_code || '';

    if (walletPool && targetPool && walletPool !== targetPool) {
      return Response.json({ ok: false, error: 'both_wallets_already_pooled' }, { status: 409 });
    }

    // Block invitations while the initiating wallet's pool has an active dispute as challenger
    if (walletPool) {
      const { data: activeDispute, error: disputeCheckError } = await supabase
        .from('mm3_pool_disputes')
        .select('id')
        .eq('challenger_pool_code', walletPool)
        .in('status', ['proposing', 'registering', 'battle_start'])
        .limit(1)
        .maybeSingle();
      if (disputeCheckError && disputeCheckError.code !== '42P01') throw disputeCheckError;
      if (activeDispute) {
        return Response.json({ ok: false, error: 'dispute_in_progress' }, { status: 409 });
      }
    }

    const { data: cooldownData, error: cooldownError } = await supabase
      .from('mm3_wallet_pool_cooldowns')
      .select('expires_at')
      .eq('wallet', wallet)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cooldownError && cooldownError.code !== '42P01') throw cooldownError;
    if (cooldownData) {
      return Response.json({ ok: false, error: 'leave_cooldown', expiresAt: cooldownData.expires_at }, { status: 409 });
    }

    if (walletPool && targetPool && walletPool === targetPool) {
      return Response.json({ ok: false, error: 'already_in_same_pool' }, { status: 409 });
    }

    const isWalletPoolless = !walletPool;
    const isTargetPoolless = !targetPool;
    const poolCode = walletPool || targetPool || await createUniquePool(supabase, wallet);

    // Invitation always goes to targetWallet; wallet is always the initiator.
    // When wallet (no pool) contacts target (has pool): target approves → wallet joins.
    // When wallet (has pool) contacts target (no pool): target accepts → target joins.
    const inviteTo = targetWallet;
    const invitedBy = wallet;
    const invitePoolCode = poolCode;

    const { data: poolCountData, count: poolCount, error: countError } = await supabase
      .from('mm3_wallet_pool_members')
      .select('*', { count: 'exact', head: true })
      .eq('pool_code', invitePoolCode);

    if (countError) throw countError;
    if (Number(poolCount || 0) >= 5) {
      return Response.json({ ok: false, error: 'pool_full' }, { status: 409 });
    }

    const rows = [];
    // Only auto-add the initiator when we're creating a new pool (both were poolless).
    if (!walletPool && !targetPool) rows.push({ wallet, pool_code: poolCode, added_by: wallet });

    if (walletPool && targetPool) {
      // Already in same pool handled above.
    }
    const { data: existingInvite, error: inviteError } = await supabase
      .from('mm3_wallet_pool_invitations')
      .select('id')
      .eq('wallet', inviteTo)
      .eq('pool_code', invitePoolCode)
      .eq('invited_by', invitedBy)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (existingInvite) {
      return Response.json({ ok: false, error: 'invite_already_exists' }, { status: 409 });
    }

    const { count: pendingCount, error: pendingCountError } = await supabase
      .from('mm3_wallet_pool_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('wallet', inviteTo)
      .eq('status', 'pending');

    if (pendingCountError) throw pendingCountError;
    if (Number(pendingCount || 0) >= 5) {
      return Response.json({ ok: false, error: 'invite_limit_reached' }, { status: 409 });
    }

    if (rows.length) {
      const { error: insertError } = await supabase
        .from('mm3_wallet_pool_members')
        .insert(rows);

      if (insertError && insertError.code !== '23505') throw insertError;
    }

    const { error: inviteInsertError } = await supabase
      .from('mm3_wallet_pool_invitations')
      .insert({ wallet: inviteTo, invited_by: invitedBy, pool_code: invitePoolCode });

    if (inviteInsertError) throw inviteInsertError;

    await supabase
      .from('mm3_wallet_pools')
      .update({ updated_at: new Date().toISOString() })
      .eq('pool_code', poolCode);

    return Response.json({ ok: true, poolCode, inviteTo, wallet });
  } catch (error) {
    console.error('wallet pool contact error:', error);
    const missingTable = error?.code === '42P01';
    return Response.json(
      { ok: false, error: missingTable ? 'wallet_pools_not_installed' : 'db_error' },
      { status: missingTable ? 501 : 500 }
    );
  }
}
