'use client';

// Browser-side half of the wallet-session system (see lib/wallet-session.js
// for the server half). One signature prompt when a wallet first connects
// (or a silent Google-token re-check for virtual wallets) buys a 30-day
// session token — no per-action friction after that.
import { getAccount, signMessage, getWalletClient, reconnect } from 'wagmi/actions';
import { toHex } from 'viem';
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mm3-wallet-session', {
        detail: { wallet: String(wallet || '').toLowerCase() },
      }));
    }
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
  try {
    const b64 = stored.token.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const parts = atob(padded).split('.');
    if (parts[0] === 'session' && parts.length >= 4 && Number.isFinite(Number(parts[2]))) {
      if (Date.now() > Number(parts[2])) return null;
    }
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

function connectorLooksRonin(connector) {
  const blob = `${connector?.id || ''} ${connector?.name || ''} ${connector?.type || ''}`.toLowerCase();
  return blob.includes('ronin');
}

/** Ronin extension or WalletConnect → Ronin mobile (Waypoint session is separate from ours). */
export function isRoninConnector(connector) {
  return connectorLooksRonin(connector);
}

/** @deprecated Kept for callers; login always auto-prompts personal_sign now. */
export function shouldAutoPromptWalletSign() {
  return true;
}

/**
 * Prefer Ronin's injected EIP-1193 provider when present — MetaMask uses wagmi
 * injected fine; Ronin extension is more reliable via window.ronin.provider than WC.
 */
async function signMessageViaRoninProvider(address, message) {
  if (typeof window === 'undefined') return null;
  const provider = window.ronin?.provider;
  if (!provider?.request) return null;

  let accounts;
  try {
    accounts = await provider.request({ method: 'eth_requestAccounts' });
  } catch {
    return null;
  }
  const acct = String(accounts?.[0] || '');
  if (!acct || acct.toLowerCase() !== String(address).toLowerCase()) return null;

  const hexMessage = toHex(message);
  try {
    return await provider.request({
      method: 'personal_sign',
      params: [hexMessage, acct],
    });
  } catch (err) {
    const code = classifySignError(err);
    if (code === 'sign_rejected' || code === 'wallet_locked') throw new Error(code || 'sign_failed');
  }
  try {
    return await provider.request({
      method: 'personal_sign',
      params: [message, acct],
    });
  } catch (err) {
    const code = classifySignError(err);
    throw new Error(code || 'sign_failed');
  }
}

async function prepareRoninSigning(connector) {
  if (!connector || !isRoninConnector(connector)) return;
  try {
    if (connector.type === 'walletConnect') {
      await reconnect(wagmiConfig, { connectors: [connector] });
    }
  } catch { /* ignore */ }
  await new Promise((r) => setTimeout(r, 700));
  try {
    const provider = await connector.getProvider?.();
    if (provider?.request) {
      await provider.request({ method: 'eth_requestAccounts' });
    }
  } catch { /* ignore */ }
  await new Promise((r) => setTimeout(r, 400));
}

async function requestWalletPersonalSign(connector, address, message) {
  const acct = String(address);
  const hexMessage = toHex(message);
  const attempts = [
    async () => {
      const client = await getWalletClient(wagmiConfig, { connector });
      if (!client) return null;
      return client.signMessage({ account: acct, message });
    },
    async () => {
      const provider = await connector?.getProvider?.();
      if (!provider?.request) return null;
      return provider.request({ method: 'personal_sign', params: [hexMessage, acct] });
    },
    async () => {
      const provider = await connector?.getProvider?.();
      if (!provider?.request) return null;
      return provider.request({ method: 'personal_sign', params: [message, acct] });
    },
    async () => signMessage(wagmiConfig, { account: acct, connector, message }),
  ];

  let lastErr;
  for (const attempt of attempts) {
    try {
      const sig = await attempt();
      if (sig) return sig;
    } catch (err) {
      lastErr = err;
      const code = classifySignError(err);
      if (code === 'sign_rejected') throw new Error(code);
    }
  }
  if (lastErr) throw lastErr;
  return null;
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
    if (isRoninConnector(connected.connector)) {
      await prepareRoninSigning(connected.connector);
    }
    const useRoninInjected = connectorLooksRonin(connected.connector)
      && connected.connector?.type === 'injected'
      && typeof window !== 'undefined'
      && window.ronin?.provider;
    if (useRoninInjected) {
      signature = await signMessageViaRoninProvider(connected.address, message);
    }
    if (!signature) {
      signature = await requestWalletPersonalSign(connected.connector, connected.address, message);
    }
  } catch (err) {
    const code = classifySignError(err) || err?.message;
    throw new Error(
      code === 'wallet_locked' || code === 'sign_rejected' || code === 'wallet_disconnected' || code === 'sign_failed'
        ? code
        : (code && String(code).length < 40 ? code : 'sign_failed'),
    );
  }
  if (!signature) throw new Error('sign_failed');

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
        ? 'Wallet bloqueada o sesión caducada — desbloquea / inicia sesión en la app y reconecta'
        : 'Wallet locked or session expired — unlock / log in in the app and reconnect';
    case 'wallet_disconnected':
    case 'wallet_mismatch':
      return es
        ? 'Wallet desconectada — vuelve a conectar'
        : 'Wallet disconnected — reconnect';
    case 'sign_rejected':
      return es ? 'Firma cancelada en la wallet' : 'Signature cancelled in the wallet';
    case 'nonce_failed':
    case 'session_failed':
    case 'sign_failed':
      return es
        ? 'Firma fallida — desbloquea la wallet y reintenta'
        : 'Sign failed — unlock the wallet and retry';
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
