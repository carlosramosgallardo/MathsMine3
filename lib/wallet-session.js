// Stateless wallet sessions (2026-07-26 security audit — phase 2).
//
// No new DB table: nonces and sessions are self-verifying HMAC-signed
// strings, not lookups. A route trusts the wallet encoded in a session token
// only after checking the HMAC (server secret) and the expiry — nobody can
// forge or extend one without WALLET_SESSION_SECRET.
//
// Two ways to earn a session:
//  - Real wallet (MetaMask/WalletConnect): sign a nonce message with the
//    wallet's private key (EIP-191 personal_sign), verified via viem.
//  - Google-derived "virtual wallet": re-present a fresh Google OAuth access
//    token, verified against googleapis.com/oauth2/v3/userinfo exactly like
//    /api/create-account already does — these wallets have no private key
//    and can never sign a message.
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { verifyMessage } from 'viem';

const SECRET = process.env.WALLET_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 min to complete the signature
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hmac(payload) {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function encode(parts) {
  return Buffer.from(parts.join('.')).toString('base64url');
}

function decode(token) {
  try {
    return Buffer.from(String(token || ''), 'base64url').toString('utf8').split('.');
  } catch {
    return null;
  }
}

export function nonceMessage(wallet, nonce, iat) {
  return `Sign in to MathsMine3\n\nWallet: ${wallet}\nNonce: ${nonce}\nIssued: ${new Date(iat).toISOString()}`;
}

/** Issue a signed, single-purpose nonce for `wallet` to sign with their key. */
export function createWalletNonce(wallet) {
  const w = String(wallet || '').toLowerCase();
  const nonce = randomBytes(16).toString('hex');
  const iat = Date.now();
  const sig = hmac(['nonce', w, nonce, String(iat)].join('.'));
  return { token: encode(['nonce', w, nonce, String(iat), sig]), message: nonceMessage(w, nonce, iat) };
}

function verifyNonceTokenShape(wallet, nonceToken) {
  const parts = decode(nonceToken);
  if (!parts || parts.length !== 5 || parts[0] !== 'nonce') return null;
  const [, w, nonce, iatStr, sig] = parts;
  if (w !== wallet) return null;
  const expected = hmac(['nonce', w, nonce, iatStr].join('.'));
  if (!safeEqual(expected, sig)) return null;
  const iat = Number(iatStr);
  if (!Number.isFinite(iat) || Date.now() - iat > NONCE_TTL_MS) return null;
  return { nonce, iat };
}

/** Verify `signature` proves ownership of `wallet` via the EIP-191 nonce message. */
export async function verifyWalletSignature(wallet, nonceToken, signature) {
  const decoded = verifyNonceTokenShape(wallet, nonceToken);
  if (!decoded) return false;
  const message = nonceMessage(wallet, decoded.nonce, decoded.iat);
  try {
    return await verifyMessage({ address: wallet, message, signature });
  } catch {
    return false;
  }
}

/** Issue a session token — the only thing routes should trust as "wallet". */
export function createSessionToken(wallet) {
  const w = String(wallet || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(w)) {
    throw new Error('invalid_session_wallet');
  }
  const exp = Date.now() + SESSION_TTL_MS;
  const sig = hmac(['session', w, String(exp)].join('.'));
  return encode(['session', w, String(exp), sig]);
}

/** Returns { wallet } if the token is valid and unexpired, else null. */
export function verifySessionToken(token) {
  const parts = decode(token);
  if (!parts || parts.length !== 4 || parts[0] !== 'session') return null;
  const [, wallet, expStr, sig] = parts;
  const expected = hmac(['session', wallet, expStr].join('.'));
  if (!safeEqual(expected, sig)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return { wallet };
}

/** Pull + verify the session from a Request's Authorization header. */
export function walletFromRequest(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  return verifySessionToken(token)?.wallet || null;
}
