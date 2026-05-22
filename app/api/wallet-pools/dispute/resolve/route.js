export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { insertSqueezeIrcTrace } from '@/lib/squeezing-relay';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const disputeId = Number(body.disputeId || 0);
  if (!disputeId) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    // Guard: must be battle_start and at least 5 seconds old
    const { data: dispute, error: fetchErr } = await supabase
      .from('mm3_pool_disputes')
      .select('status, battle_start_at')
      .eq('id', disputeId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!dispute) return Response.json({ ok: false, error: 'dispute_not_found' }, { status: 404 });
    if (dispute.status !== 'battle_start') {
      return Response.json({ ok: false, error: 'wrong_status', status: dispute.status }, { status: 409 });
    }

    const battleStartAt = new Date(dispute.battle_start_at).getTime();
    const now = Date.now();
    if (now - battleStartAt < 5000) {
      return Response.json({ ok: false, error: 'too_early', ms_remaining: 5000 - (now - battleStartAt) }, { status: 425 });
    }

    const { data, error } = await supabase.rpc('mm3_dispute_resolve', {
      p_dispute_id: disputeId,
    });

    if (error) throw error;
    if (data?.error) {
      return Response.json({ ok: false, error: data.error }, { status: 400 });
    }

    const { data: resolvedDispute } = await supabase
      .from('mm3_pool_disputes')
      .select('id, challenger_pool_code, defender_pool_code, status, resolved_at, ch_score, df_score, winner, result_summary, drop_type')
      .eq('id', disputeId)
      .maybeSingle();
    if (resolvedDispute) await insertSqueezeIrcTrace(supabase, resolvedDispute, 'resolved').catch(() => {});

    return Response.json({ ok: true, result: data });
  } catch (error) {
    console.error('dispute resolve error:', error);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}
