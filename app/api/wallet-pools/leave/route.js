export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { getActivePoolDispute } from '@/lib/pool-dispute-lock';

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
  if (!wallet) {
    return Response.json({ ok: false, error: 'invalid_wallet' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data: member, error: memberError } = await supabase
      .from('mm3_wallet_pool_members')
      .select('pool_code')
      .eq('wallet', wallet)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) {
      return Response.json({ ok: false, error: 'not_in_pool' }, { status: 404 });
    }

    const activeDispute = await getActivePoolDispute(supabase, member.pool_code);
    if (activeDispute) {
      return Response.json({ ok: false, error: 'dispute_in_progress', dispute_id: activeDispute.id }, { status: 409 });
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .rpc('mm3_leave_wallet_pool', { p_wallet: wallet });

    if (deleteError) throw deleteError;

    if (!deletedRows?.length) {
      return Response.json({
        ok: false,
        error: 'delete_failed',
        wallet,
      }, { status: 409 });
    }

    const { error: updatePoolError } = await supabase
      .from('mm3_wallet_pools')
      .update({ updated_at: new Date().toISOString() })
      .eq('pool_code', member.pool_code);

    if (updatePoolError) throw updatePoolError;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('mm3_wallet_pool_cooldowns')
      .upsert({ wallet, left_at: new Date().toISOString(), expires_at: expiresAt }, { onConflict: 'wallet' });

    return Response.json({ ok: true, poolCode: member.pool_code });
  } catch (error) {
    console.error('wallet pool leave error:', error);
    const missingTable = error?.code === '42P01';
    return Response.json(
      { ok: false, error: missingTable ? 'wallet_pools_not_installed' : 'db_error' },
      { status: missingTable ? 501 : 500 }
    );
  }
}
