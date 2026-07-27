export const dynamic = 'force-dynamic';

import {
  createSessionToken,
  verifyWalletSignature,
} from '@/lib/wallet-session';
import { verifyGoogleAccessToken } from '@/lib/google-verify';
import { deriveVirtualWallet } from '@/lib/virtual-wallet';

const WALLET_RE = /^0x[0-9a-f]{40}$/;

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const type = String(body.type || 'wallet');

  if (type === 'google') {
    const accessToken = String(body.access_token || body.accessToken || '').trim();
    if (!accessToken) {
      return Response.json({ ok: false, error: 'missing_token' }, { status: 400 });
    }
    const sub = await verifyGoogleAccessToken(accessToken);
    if (!sub) {
      return Response.json({ ok: false, error: 'invalid_google_token' }, { status: 401 });
    }
    const wallet = deriveVirtualWallet(sub);
    const token = createSessionToken(wallet);
    return Response.json({ ok: true, token, wallet });
  }

  const wallet = String(body.wallet || '').toLowerCase().trim();
  const nonceToken = String(body.nonceToken || body.nonce_token || '');
  const signature = String(body.signature || '');
  if (!WALLET_RE.test(wallet) || !nonceToken || !signature) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const valid = await verifyWalletSignature(wallet, nonceToken, signature);
  if (!valid) {
    return Response.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
  }

  const token = createSessionToken(wallet);
  return Response.json({ ok: true, token, wallet });
}
