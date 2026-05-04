export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const wallet = String(searchParams.get('wallet') || '').trim().toLowerCase();

  if (!wallet) {
    return Response.json({ ok: false, error: 'missing_wallet' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data } = await supabase
      .from('mm3_wallet_pool_cooldowns')
      .select('expires_at')
      .eq('wallet', wallet)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    return Response.json({ ok: true, inCooldown: !!data, expiresAt: data?.expires_at || null });
  } catch (error) {
    console.error('cooldown check error:', error);
    return Response.json({ ok: true, inCooldown: false, expiresAt: null });
  }
}
