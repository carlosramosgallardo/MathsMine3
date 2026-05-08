export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { getChallengerRegistrationState, SQUEEZE_REGISTER_MS } from '@/lib/squeeze-transitions';

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
    // Guard: dispute must be registering and either the 5 min window has passed
    // or every wallet from the challenger pool is already registered.
    const { data: dispute, error: fetchErr } = await supabase
      .from('mm3_pool_disputes')
      .select('id, challenger_pool_code, status, registered_at')
      .eq('id', disputeId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!dispute) return Response.json({ ok: false, error: 'dispute_not_found' }, { status: 404 });
    if (dispute.status !== 'registering') {
      return Response.json({ ok: false, error: 'wrong_status', status: dispute.status }, { status: 409 });
    }

    const registeredAt = new Date(dispute.registered_at).getTime();
    const now = Date.now();
    const registration = await getChallengerRegistrationState(supabase, dispute);
    if (now - registeredAt < SQUEEZE_REGISTER_MS && !registration.full) {
      return Response.json({
        ok: false,
        error: 'too_early',
        ms_remaining: SQUEEZE_REGISTER_MS - (now - registeredAt),
        ...registration,
      }, { status: 425 });
    }

    const { data, error } = await supabase.rpc('mm3_dispute_start_battle', {
      p_dispute_id: disputeId,
    });

    if (error) throw error;
    if (data?.error) {
      return Response.json({ ok: false, error: data.error }, { status: 400 });
    }

    return Response.json({ ok: true, ...data });
  } catch (error) {
    console.error('dispute start-battle error:', error);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}
