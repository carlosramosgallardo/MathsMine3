export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

export async function GET(req) {
  const wallet = String(new URL(req.url).searchParams.get('wallet') || '').toLowerCase().trim();
  if (!wallet) return Response.json({ ok: false, error: 'missing_wallet' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase
      .from('mm3_squeeze_nftji_rewards')
      .select('id, nftji_key, expires_at, created_at')
      .eq('wallet', wallet)
      .is('claimed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Response.json({ ok: true, rewards: data || [] });
  } catch (err) {
    console.error('claim-nftji GET error:', err);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = String(body.wallet || '').toLowerCase().trim();
  const rewardId = Number(body.rewardId || 0);

  if (!wallet || !rewardId) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data: reward, error: fetchErr } = await supabase
      .from('mm3_squeeze_nftji_rewards')
      .select('id, wallet, nftji_key, expires_at, claimed_at')
      .eq('id', rewardId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!reward) return Response.json({ ok: false, error: 'reward_not_found' }, { status: 404 });
    if (reward.wallet.toLowerCase() !== wallet) {
      return Response.json({ ok: false, error: 'not_owner' }, { status: 403 });
    }
    if (reward.claimed_at) {
      return Response.json({ ok: false, error: 'already_claimed' }, { status: 409 });
    }
    if (new Date(reward.expires_at) < new Date()) {
      return Response.json({ ok: false, error: 'expired' }, { status: 410 });
    }

    const { error: claimErr } = await supabase
      .from('mm3_squeeze_nftji_rewards')
      .update({ claimed_at: new Date().toISOString() })
      .eq('id', rewardId);
    if (claimErr) throw claimErr;

    const { error: progressErr } = await supabase
      .from('player_progress')
      .upsert(
        {
          wallet,
          squeeze_nftji_key: reward.nftji_key,
          squeeze_nftji_since: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'wallet', ignoreDuplicates: false }
      );
    if (progressErr) throw progressErr;

    return Response.json({ ok: true, nftji_key: reward.nftji_key });
  } catch (err) {
    console.error('claim-nftji error:', err);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}
