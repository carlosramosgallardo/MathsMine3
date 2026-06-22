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

  const updates = body.updates;
  if (!Array.isArray(updates) || updates.length === 0) {
    return Response.json({ ok: false, error: 'missing_updates' }, { status: 400 });
  }

  // Validate each entry has a valid wallet
  for (const u of updates) {
    const w = String(u.wallet || '').toLowerCase().trim();
    if (!WALLET_RE.test(w)) {
      return Response.json({ ok: false, error: `invalid_wallet: ${u.wallet}` }, { status: 400 });
    }
    u.wallet = w;
  }

  const supabase = serviceClient();
  const { error } = await supabase
    .from('player_progress')
    .upsert(updates, { onConflict: 'wallet', ignoreDuplicates: false });

  if (error) {
    console.error('relay/penalize progress upsert:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
