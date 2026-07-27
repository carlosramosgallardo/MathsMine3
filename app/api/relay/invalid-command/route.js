export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { walletFromRequest } from '@/lib/wallet-session';
import { formatWalletLabel } from '@/lib/wallet-format';
import { insertRelayMessage } from '@/lib/insert-relay-message';

const MAX_INPUT = 500;

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function POST(req) {
  const wallet = walletFromRequest(req);
  if (!wallet) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const input = String(body.input || '').trim().slice(0, MAX_INPUT);
  const expected = String(body.expected_command || body.expectedCommand || '').trim().slice(0, MAX_INPUT);
  if (!input || !expected) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const language = body.language === 'es' ? 'es' : 'en';
  const text = language === 'es'
    ? `ERR: intento de hackeo del sistema >> wallet=${formatWalletLabel(wallet)} >> input=${input} >> expected=${expected}`
    : `ERR: system hack attempt >> wallet=${formatWalletLabel(wallet)} >> input=${input} >> expected=${expected}`;

  const supabase = serviceClient();
  await insertRelayMessage(supabase, {
    wallet: 'system',
    text,
    kind: 'system',
    tone: 'command',
  });

  return Response.json({ ok: true, message: text, tone: 'command' });
}
