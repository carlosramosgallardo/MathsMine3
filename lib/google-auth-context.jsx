'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { deriveVirtualWallet } from './virtual-wallet';

const GoogleAuthCtx = createContext({
  googleWallet: null,
  setGoogleSub: async () => {},
  signOut: () => {},
});

export const useGoogleAuth = () => useContext(GoogleAuthCtx);

export function GoogleAuthProvider({ children }) {
  const [googleWallet, setGoogleWallet] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('mm3_gw');
    if (stored) setGoogleWallet(stored);
  }, []);

  const setGoogleSub = useCallback(async (sub) => {
    const wallet = await deriveVirtualWallet(sub);
    setGoogleWallet(wallet);
    localStorage.setItem('mm3_gw', wallet);
  }, []);

  const signOut = useCallback(() => {
    setGoogleWallet(null);
    localStorage.removeItem('mm3_gw');
  }, []);

  return (
    <GoogleAuthCtx.Provider value={{ googleWallet, setGoogleSub, signOut }}>
      {children}
    </GoogleAuthCtx.Provider>
  );
}
