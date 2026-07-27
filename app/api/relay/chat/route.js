export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { walletFromRequest } from '@/lib/wallet-session';

const MAX_TEXT = 2000;

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

  const wallet = walletFromRequest(req);
  if (!wallet) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const text = String(body.text ?? '').trim();
  if (!text || text.length > MAX_TEXT) {
    return Response.json({ ok: false, error: 'invalid_text' }, { status: 400 });
  }

  const kind = String(body.kind || 'chat');
  const tone = String(body.tone || 'neutral');
  const ts = Number(body.ts);
  const safeTs = Number.isFinite(ts) && ts > 0 ? Math.floor(ts) : Date.now();

  const { error } = await serviceClient().from('mm3_relaying_messages').insert({
    wallet,
    text,
    ts: safeTs,
    kind,
    tone,
  });
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, wallet, ts: safeTs });
}
