'use client';

// Browser-side half of the wallet-session system (see lib/wallet-session.js
// for the server half). One signature prompt when a wallet first connects
// (or a silent Google-token re-check for virtual wallets) buys a 30-day
// session token — no per-action friction after that.
import { getAccount, signMessage } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/wagmi-core';

const STORAGE_KEY = 'mm3_session';
const GOOGLE_TOKEN_KEY = 'mm3_g_at';

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStored(wallet, token) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallet: String(wallet || '').toLowerCase(), token }));
  } catch { /* ignore */ }
}

export function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  clearGoogleAccessToken();
}

/** Keep the Google OAuth access token so we can mint a session without a full re-login UX. */
export function rememberGoogleAccessToken(accessToken) {
  try {
    if (!accessToken) return;
    sessionStorage.setItem(GOOGLE_TOKEN_KEY, accessToken);
    // Survive hard refresh for ~50 minutes (Google access tokens last ~1h).
    localStorage.setItem(GOOGLE_TOKEN_KEY, JSON.stringify({
      token: accessToken,
      exp: Date.now() + 50 * 60 * 1000,
    }));
  } catch { /* ignore */ }
}

export function getGoogleAccessToken() {
  try {
    const live = sessionStorage.getItem(GOOGLE_TOKEN_KEY);
    if (live) return live;
    const raw = localStorage.getItem(GOOGLE_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !Number.isFinite(parsed.exp) || Date.now() > parsed.exp) {
      localStorage.removeItem(GOOGLE_TOKEN_KEY);
      return null;
    }
    sessionStorage.setItem(GOOGLE_TOKEN_KEY, parsed.token);
    return parsed.token;
  } catch {
    return null;
  }
}

export function clearGoogleAccessToken() {
  try { sessionStorage.removeItem(GOOGLE_TOKEN_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(GOOGLE_TOKEN_KEY); } catch { /* ignore */ }
}

/** Token for `wallet` if we already have one that isn't (client-side-)expired. */
export function getSessionToken(wallet) {
  const stored = readStored();
  if (!stored?.token || stored.wallet !== String(wallet || '').toLowerCase()) return null;
  // Cheap local expiry peek only — this is a UX check to skip re-signing, not
  // a security check. The server independently re-verifies the HMAC + expiry
  // on every request; a tampered/expired token is rejected there regardless.
  try {
    // Server tokens are base64url(session.wallet.exp.sig) — dots, not spaces.
    const b64 = stored.token.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const parts = atob(padded).split('.');
    if (parts[0] === 'session' && parts.length >= 4 && Number.isFinite(Number(parts[2]))) {
      if (Date.now() > Number(parts[2])) return null;
    }
    // Reject clearly broken Google sessions minted before the deriveVirtualWallet await fix.
    const embedded = parts[1] || '';
    if (!/^0x[0-9a-f]{40}$/i.test(embedded)) return null;
  } catch {
    // Still return the token — better a server 401 than silently dropping auth.
  }
  return stored.token;
}

function classifySignError(err) {
  const raw = String(err?.shortMessage || err?.details || err?.message || err || '');
  if (/session.*expir|login session|expired|unauthorized|locked|unlock/i.test(raw)) {
    return 'wallet_locked';
  }
  if (/user rejected|rejected the request|denied|cancel/i.test(raw)) {
    return 'sign_rejected';
  }
  if (/connector|not connected|no active/i.test(raw)) {
    return 'wallet_disconnected';
  }
  return '';
}

/** Real wallet: one signature prompt, then a 30-day session. */
export async function signInWithWallet(wallet) {
  const w = String(wallet || '').toLowerCase();
  const existing = getSessionToken(w);
  if (existing) return existing;

  const connected = getAccount(wagmiConfig);
  const connectedAddr = String(connected.address || '').toLowerCase();
  if (!connected.isConnected || !connectedAddr) {
    throw new Error('wallet_disconnected');
  }
  if (connectedAddr !== w) {
    throw new Error('wallet_mismatch');
  }

  const nonceRes = await fetch('/api/auth/nonce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: w }),
  });
  if (!nonceRes.ok) throw new Error('nonce_failed');
  const { token: nonceToken, message } = await nonceRes.json();

  let signature;
  try {
    // Pass the connector account explicitly — Ronin/WC often fail bare signMessage
    // when the wallet app session is stale or account is ambiguous.
    signature = await signMessage(wagmiConfig, {
      account: connected.address,
      connector: connected.connector,
      message,
    });
  } catch (err) {
    const code = classifySignError(err);
    throw new Error(code || 'sign_failed');
  }

  const sessionRes = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'wallet', wallet: w, nonceToken, signature }),
  });
  if (!sessionRes.ok) throw new Error('session_failed');
  const { token } = await sessionRes.json();
  writeStored(w, token);
  return token;
}

/** Human-readable hint for wallet sign-in failures (Ronin session expiry, etc.). */
export function walletSignErrorMessage(code, language = 'en') {
  const es = language === 'es';
  switch (code) {
    case 'wallet_locked':
      return es
        ? 'Ronin/MetaMask: sesión caducada — desbloquea la wallet, cierra sesión en el portal y vuelve a conectar'
        : 'Ronin/MetaMask: session expired — unlock the wallet, disconnect on the portal, then reconnect';
    case 'wallet_disconnected':
    case 'wallet_mismatch':
      return es
        ? 'Wallet desconectada — vuelve a conectar Ronin/MetaMask'
        : 'Wallet disconnected — reconnect Ronin/MetaMask';
    case 'sign_rejected':
      return es ? 'Firma cancelada en la wallet' : 'Signature cancelled in the wallet';
    case 'nonce_failed':
    case 'session_failed':
    case 'sign_failed':
      return es
        ? 'No se pudo firmar — desbloquea Ronin y reintenta'
        : 'Could not sign — unlock Ronin and retry';
    default:
      return es ? 'Error de firma de wallet' : 'Wallet sign-in error';
  }
}

/** Google-derived virtual wallet: no signature possible, re-verify the token. */
export async function signInWithGoogle(accessToken, wallet) {
  const w = String(wallet || '').toLowerCase();
  const existing = getSessionToken(w);
  if (existing) return existing;

  rememberGoogleAccessToken(accessToken);
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'google', access_token: accessToken }),
  });
  if (!res.ok) throw new Error('session_failed');
  const { token, wallet: sessionWallet } = await res.json();
  const resolved = String(sessionWallet || w).toLowerCase();
  if (w && resolved !== w) throw new Error('session_wallet_mismatch');
  writeStored(resolved, token);
  return token;
}

/**
 * Ensure a Bearer session exists before an authenticated API call.
 * Real wallets: MetaMask/WC signature prompt if missing.
 * Google wallets: uses remembered access token, else requires re-login.
 */
export async function ensureWalletSession(wallet, { isVirtualWallet = false, googleAccessToken = null } = {}) {
  const w = String(wallet || '').toLowerCase();
  if (!w) throw new Error('no_wallet');
  const existing = getSessionToken(w);
  if (existing) return existing;
  if (isVirtualWallet) {
    const token = googleAccessToken || getGoogleAccessToken();
    if (!token) throw new Error('google_session_required');
    return signInWithGoogle(token, w);
  }
  return signInWithWallet(w);
}

/** fetch() wrapper that attaches the session token for the active wallet, if any. */
export function apiFetch(path, options = {}, wallet) {
  const token = wallet ? getSessionToken(wallet) : null;
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(path, { ...options, headers });
}
