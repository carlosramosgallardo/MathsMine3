'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useGoogleAuth } from '@/lib/google-auth-context';

export function useActiveWallet() {
  const { address, isConnected } = useAccount();
  const { googleWallet } = useGoogleAuth();

  return useMemo(() => {
    if (isConnected && address) {
      return { account: address, isVirtualWallet: false };
    }
    if (googleWallet) {
      return { account: googleWallet, isVirtualWallet: true };
    }
    return { account: null, isVirtualWallet: false };
  }, [address, isConnected, googleWallet]);
}
