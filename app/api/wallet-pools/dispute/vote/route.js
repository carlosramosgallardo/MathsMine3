export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { maybeStartBattleWhenFull } from '@/lib/squeeze-transitions';

function normalizeWallet(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePool(value) {
  return String(value || '').trim().toUpperCase();
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = normalizeWallet(body.wallet);
  const challengerPool = normalizePool(body.challengerPool);
  const defenderPool = normalizePool(body.defenderPool);

  if (!wallet || !challengerPool || !defenderPool) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase.rpc('mm3_dispute_vote', {
      p_challenger_pool: challengerPool,
      p_defender_pool: defenderPool,
      p_wallet: wallet,
    });

    if (error) throw error;

    if (data?.error) {
      const statusMap = {
        same_pool: 400,
        not_in_challenger_pool: 403,
        already_voted: 409,
        dispute_already_active: 409,
      };
      return Response.json(
        { ok: false, error: data.error, dispute_id: data.dispute_id },
        { status: statusMap[data.error] || 400 }
      );
    }

    const transition = data?.created && data?.dispute_id
      ? await maybeStartBattleWhenFull(supabase, data.dispute_id)
      : { started: false };

    return Response.json({ ok: true, ...data, transition });
  } catch (error) {
    console.error('dispute vote error:', error);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}
