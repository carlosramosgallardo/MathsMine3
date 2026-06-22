export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

const WALLET_RE = /^0x[0-9a-f]{40}$/;

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

  const wallet = String(body.wallet || '').toLowerCase().trim();
  if (!WALLET_RE.test(wallet)) {
    return Response.json({ ok: false, error: 'invalid_wallet' }, { status: 400 });
  }

  const progress = body.progress;
  if (!progress || typeof progress !== 'object') {
    return Response.json({ ok: false, error: 'missing_progress' }, { status: 400 });
  }

  const level = Number(progress.level ?? 0);
  if (!Number.isFinite(level) || level < 0 || level > 100) {
    return Response.json({ ok: false, error: 'invalid_level' }, { status: 400 });
  }

  const payload = { ...progress, wallet };

  const supabase = serviceClient();
  const { error } = await supabase
    .from('player_progress')
    .upsert(payload, { onConflict: 'wallet', ignoreDuplicates: false });

  if (error) {
    console.error('mining/nftji-resell progress upsert:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
