'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const GoogleAuthCtx = createContext({
  googleWallet: null,
  loginWithGoogle: async () => {},
  signOut: () => {},
});

export const useGoogleAuth = () => useContext(GoogleAuthCtx);

export function GoogleAuthProvider({ children }) {
  const [googleWallet, setGoogleWallet] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('mm3_gw');
    if (stored) setGoogleWallet(stored);
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
    return wallet;
  }, []);

  const signOut = useCallback(() => {
    setGoogleWallet(null);
    localStorage.removeItem('mm3_gw');
  }, []);

  return (
    <GoogleAuthCtx.Provider value={{ googleWallet, loginWithGoogle, signOut }}>
      {children}
    </GoogleAuthCtx.Provider>
  );
}
