export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { sanitizeProgressPayload } from '@/lib/player-progress-guard';
import { walletFromRequest } from '@/lib/wallet-session';

const WALLET_RE = /^0x[0-9a-f]{40}$/;

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function POST(req) {
  // Gate: must be a real logged-in wallet triggering this (closes anonymous
  // scripting). Note: this does NOT yet verify the penalty amounts
  // themselves are correct — those are still client-computed. See 2026-07
  // audit phase 3 (deferred): server should recompute penalties from the
  // command/price tables instead of trusting `updates` verbatim.
  const caller = walletFromRequest(req);
  if (!caller) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const updates = body.updates;
  if (!Array.isArray(updates) || updates.length === 0) {
    return Response.json({ ok: false, error: 'missing_updates' }, { status: 400 });
  }

  // Validate each entry has a valid wallet, then drop any field outside the
  // known economy allowlist before it reaches the upsert.
  const sanitized = [];
  for (const u of updates) {
    const w = String(u.wallet || '').toLowerCase().trim();
    if (!WALLET_RE.test(w)) {
      return Response.json({ ok: false, error: `invalid_wallet: ${u.wallet}` }, { status: 400 });
    }
    sanitized.push(sanitizeProgressPayload(w, u));
  }

  const supabase = serviceClient();
  const { error } = await supabase
    .from('player_progress')
    .upsert(sanitized, { onConflict: 'wallet', ignoreDuplicates: false });

  if (error) {
    console.error('relay/penalize progress upsert:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
