export const dynamic = 'force-dynamic';

import { createSessionToken, verifyWalletSignature } from '@/lib/wallet-session';
import { verifyGoogleAccessToken } from '@/lib/google-verify';
import { deriveVirtualWallet } from '@/lib/virtual-wallet';

const WALLET_RE = /^0x[0-9a-f]{40}$/;
const SESSION_TTL_DAYS = 30;

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }

  const type = String(body.type || '');

  // ── Real wallet: prove ownership via EIP-191 signature of the nonce ──
  if (type === 'wallet') {
    const wallet = String(body.wallet || '').toLowerCase().trim();
    const nonceToken = String(body.nonceToken || '');
    const signature = String(body.signature || '');
    if (!WALLET_RE.test(wallet) || !nonceToken || !signature) {
      return Response.json({ ok: false, error: 'invalid params' }, { status: 400 });
    }

    const valid = await verifyWalletSignature(wallet, nonceToken, signature);
    if (!valid) {
      return Response.json({ ok: false, error: 'signature_invalid' }, { status: 401 });
    }

    const token = createSessionToken(wallet);
    return Response.json({ ok: true, token, wallet, expiresInDays: SESSION_TTL_DAYS });
  }

  // ── Google-derived virtual wallet: no private key, re-verify the OAuth
  //    token itself (same check /api/create-account does) ──
  if (type === 'google') {
    const accessToken = String(body.access_token || '');
    if (!accessToken) return Response.json({ ok: false, error: 'missing_token' }, { status: 400 });

    const sub = await verifyGoogleAccessToken(accessToken);
    if (!sub) return Response.json({ ok: false, error: 'invalid_token' }, { status: 401 });

    const wallet = await deriveVirtualWallet(sub);
    const token = createSessionToken(wallet);
    return Response.json({ ok: true, token, wallet, expiresInDays: SESSION_TTL_DAYS });
  }

  return Response.json({ ok: false, error: 'invalid_type' }, { status: 400 });
}
