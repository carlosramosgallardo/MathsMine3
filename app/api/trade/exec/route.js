export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { sanitizeProgressPayload } from '@/lib/player-progress-guard';
import { walletFromRequest } from '@/lib/wallet-session';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  // Wallet comes from the verified session, not the body — see 2026-07
  // security audit phase 2. A caller can no longer act as a wallet they
  // haven't proven ownership of (signature or re-verified Google token).
  const wallet = walletFromRequest(req);
  if (!wallet) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const progress = body.progress;
  if (!progress || typeof progress !== 'object') {
    return Response.json({ ok: false, error: 'missing_progress' }, { status: 400 });
  }

  const level = Number(progress.level ?? 0);
  if (!Number.isFinite(level) || level < 0 || level > 100) {
    return Response.json({ ok: false, error: 'invalid_level' }, { status: 400 });
  }

  // Only forward known economy fields — reject anything else silently rather
  // than letting the caller set arbitrary player_progress columns.
  const payload = sanitizeProgressPayload(wallet, progress);

  const supabase = serviceClient();
  const { error } = await supabase
    .from('player_progress')
    .upsert(payload, { onConflict: 'wallet', ignoreDuplicates: false });

  if (error) {
    console.error('trade/exec progress upsert:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
