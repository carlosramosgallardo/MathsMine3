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

    const poolCode = walletPool || targetPool || await createUniquePool(supabase, wallet);
    const rows = [];
    if (!walletPool) rows.push({ wallet, pool_code: poolCode, added_by: wallet });
    if (!targetPool) rows.push({ wallet: targetWallet, pool_code: poolCode, added_by: wallet });

    if (rows.length) {
      const { error: insertError } = await supabase
        .from('mm3_wallet_pool_members')
        .insert(rows);

      if (insertError && insertError.code !== '23505') throw insertError;
    }

    await supabase
      .from('mm3_wallet_pools')
      .update({ updated_at: new Date().toISOString() })
      .eq('pool_code', poolCode);

    return Response.json({ ok: true, poolCode, wallets: [wallet, targetWallet] });
  } catch (error) {
    console.error('wallet pool contact error:', error);
    const missingTable = error?.code === '42P01';
    return Response.json(
      { ok: false, error: missingTable ? 'wallet_pools_not_installed' : 'db_error' },
      { status: missingTable ? 501 : 500 }
    );
  }
}
