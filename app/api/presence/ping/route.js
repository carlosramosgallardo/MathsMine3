export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { walletFromRequest } from '@/lib/wallet-session';

const WALLET_RE = /^0x[0-9a-f]{40}$/;

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const wallet = walletFromRequest(req);
  if (!wallet || !WALLET_RE.test(wallet)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const source = body.source === 'google' ? 'google' : 'wallet';
  const disconnect = Boolean(body.disconnect);
  const ircTrace = body.irc_trace === 'join' || body.irc_trace === 'leave' ? body.irc_trace : null;
  const ircText = typeof body.irc_text === 'string' ? body.irc_text.trim() : '';

  const lastSeen = disconnect
    ? new Date(Date.now() - 120_000).toISOString()
    : new Date().toISOString();

  const supabase = serviceClient();
  const { error } = await supabase.from('mm3_wallet_presence').upsert(
    { wallet, source, last_seen: lastSeen },
    { onConflict: 'wallet', ignoreDuplicates: false },
  );
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (ircTrace && ircText) {
    await supabase.from('mm3_relaying_messages').insert({
      wallet: 'system',
      text: ircText,
      ts: Date.now(),
      kind: 'system',
      tone: ircTrace,
    }).then(null, () => {});
  }

  return Response.json({ ok: true, wallet, last_seen: lastSeen });
}
