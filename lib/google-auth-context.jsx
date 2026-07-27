'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { signInWithGoogle, clearSession } from '@/lib/wallet-session-client';

const GoogleAuthCtx = createContext({
  googleWallet: null,
  loginWithGoogle: async () => {},
  signOut: () => {},
});

export const useGoogleAuth = () => useContext(GoogleAuthCtx);

export function GoogleAuthProvider({ children }) {
  const [googleWallet, setGoogleWallet] = useState(null);

  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const stored = localStorage.getItem('mm3_gw');
        if (stored) setGoogleWallet(stored);
      } catch {
        /* ignore */
      }
    };
    syncFromStorage();
    // Native Android WebView may inject mm3_gw after first paint.
    const onNative = (e) => {
      const gw = e?.detail?.gw || (typeof window !== 'undefined' && window.__MM3_NATIVE_GW__);
      if (typeof gw === 'string' && gw) {
        try { localStorage.setItem('mm3_gw', gw); } catch { /* */ }
        setGoogleWallet(gw);
      } else {
        syncFromStorage();
      }
    };
    window.addEventListener('mm3-native-session', onNative);
    return () => window.removeEventListener('mm3-native-session', onNative);
  }, []);

  const loginWithGoogle = useCallback(async (accessToken) => {
    const res = await fetch('/api/create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'google', access_token: accessToken }),
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      throw new Error(error || 'create_account_failed');
    }

    const { wallet } = await res.json();
    setGoogleWallet(wallet);
    localStorage.setItem('mm3_gw', wallet);

    // Google wallets have no private key — mint a Bearer session from the
    // same access token. Required for trade/training APIs.
    await signInWithGoogle(accessToken, wallet);

    return wallet;
  }, []);

  const signOut = useCallback(() => {
    setGoogleWallet(null);
    localStorage.removeItem('mm3_gw');
    clearSession();
  }, []);

  return (
    <GoogleAuthCtx.Provider value={{ googleWallet, loginWithGoogle, signOut }}>
      {children}
    </GoogleAuthCtx.Provider>
  );
}
