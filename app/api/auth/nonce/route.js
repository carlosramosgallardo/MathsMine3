export const dynamic = 'force-dynamic';

import { createWalletNonce } from '@/lib/wallet-session';

const WALLET_RE = /^0x[0-9a-f]{40}$/;

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = String(body.wallet || '').toLowerCase().trim();
  if (!WALLET_RE.test(wallet)) {
    return Response.json({ ok: false, error: 'invalid_wallet' }, { status: 400 });
  }

  const { token, message } = createWalletNonce(wallet);
  return Response.json({ token, message });
}
