'use client';

// Browser-side half of the wallet-session system (see lib/wallet-session.js
// for the server half). One signature prompt when a wallet first connects
// (or a silent Google-token re-check for virtual wallets) buys a 30-day
// session token — no per-action friction after that.
import { signMessage } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/wagmi-core';

const STORAGE_KEY = 'mm3_session';

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallet, token }));
  } catch { /* ignore */ }
}

export function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
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
  } catch {
    // Still return the token — better a server 401 than silently dropping auth.
  }
  return stored.token;
}

/** Real wallet: one signature prompt, then a 30-day session. */
export async function signInWithWallet(wallet) {
  const w = String(wallet || '').toLowerCase();
  const existing = getSessionToken(w);
  if (existing) return existing;

  const nonceRes = await fetch('/api/auth/nonce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: w }),
  });
  if (!nonceRes.ok) throw new Error('nonce_failed');
  const { token: nonceToken, message } = await nonceRes.json();

  const signature = await signMessage(wagmiConfig, { message });

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

/** Google-derived virtual wallet: no signature possible, re-verify the token. */
export async function signInWithGoogle(accessToken, wallet) {
  const existing = getSessionToken(wallet);
  if (existing) return existing;

  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'google', access_token: accessToken }),
  });
  if (!res.ok) throw new Error('session_failed');
  const { token, wallet: sessionWallet } = await res.json();
  writeStored(sessionWallet, token);
  return token;
}

/**
 * Ensure a Bearer session exists before an authenticated API call.
 * Real wallets: MetaMask/WC signature prompt if missing.
 * Google wallets: requires a fresh access token (re-login if absent).
 */
export async function ensureWalletSession(wallet, { isVirtualWallet = false, googleAccessToken = null } = {}) {
  const w = String(wallet || '').toLowerCase();
  if (!w) throw new Error('no_wallet');
  const existing = getSessionToken(w);
  if (existing) return existing;
  if (isVirtualWallet) {
    if (!googleAccessToken) throw new Error('google_session_required');
    return signInWithGoogle(googleAccessToken, w);
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
