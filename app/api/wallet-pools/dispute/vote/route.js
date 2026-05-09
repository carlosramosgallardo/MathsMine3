export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { maybeStartBattleWhenFull } from '@/lib/squeeze-transitions';
import { getActivePoolDispute } from '@/lib/pool-dispute-lock';

const SQUEEZE_LAUNCH_LIMIT = 5;
const SQUEEZE_LAUNCH_WINDOW_MS = 24 * 60 * 60 * 1000;

function normalizeWallet(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePool(value) {
  return String(value || '').trim().toUpperCase();
}

async function getSqueezeLaunchLimitState(supabase, challengerPool) {
  const windowStart = new Date(Date.now() - SQUEEZE_LAUNCH_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from('mm3_squeeze_launches')
    .select('created_at')
    .eq('challenger_pool_code', challengerPool)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const launches = data || [];
  const count = launches.length;
  const firstAt = launches[0]?.created_at ? new Date(launches[0].created_at).getTime() : null;
  const resetAt = firstAt ? new Date(firstAt + SQUEEZE_LAUNCH_WINDOW_MS).toISOString() : null;
  return { count, resetAt, remaining: Math.max(0, SQUEEZE_LAUNCH_LIMIT - count) };
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
    const existingLock = await getActivePoolDispute(supabase, challengerPool);
    if (existingLock && !(existingLock.status === 'proposing' && existingLock.challenger_pool_code === challengerPool && existingLock.defender_pool_code === defenderPool)) {
      return Response.json(
        { ok: false, error: 'dispute_already_active', dispute_id: existingLock.id },
        { status: 409 }
      );
    }

    const defenderLock = await getActivePoolDispute(supabase, defenderPool);
    if (defenderLock && defenderLock.id !== existingLock?.id) {
      return Response.json(
        { ok: false, error: 'dispute_already_active', dispute_id: defenderLock.id },
        { status: 409 }
      );
    }

    const { data: existingProposal, error: existingProposalError } = await supabase
      .from('mm3_pool_disputes')
      .select('id')
      .eq('challenger_pool_code', challengerPool)
      .eq('defender_pool_code', defenderPool)
      .eq('status', 'proposing')
      .limit(1)
      .maybeSingle();
    if (existingProposalError) throw existingProposalError;

    const isNewLaunch = !existingProposal;
    if (isNewLaunch) {
      const limitState = await getSqueezeLaunchLimitState(supabase, challengerPool);
      if (limitState.count >= SQUEEZE_LAUNCH_LIMIT) {
        return Response.json(
          { ok: false, error: 'squeeze_limit_reached', reset_at: limitState.resetAt },
          { status: 429 }
        );
      }
    }

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
        squeeze_limit_reached: 429,
      };
      return Response.json(
        { ok: false, error: data.error, dispute_id: data.dispute_id },
        { status: statusMap[data.error] || 400 }
      );
    }

    if (isNewLaunch && data?.proposing && data?.dispute_id) {
      await supabase.from('mm3_squeeze_launches').insert({
        wallet,
        challenger_pool_code: challengerPool,
        defender_pool_code: defenderPool,
        dispute_id: data.dispute_id,
      });
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
