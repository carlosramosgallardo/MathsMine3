'use client';

import { useEffect } from 'react';
import { useActiveWallet } from '@/lib/use-active-wallet';

export default function WalletBootstrap() {
  const { account, isVirtualWallet } = useActiveWallet();

  useEffect(() => {
    const wallet = String(account || '').toLowerCase();
    if (!wallet) return;

    // Google wallets are created server-side during login (google-auth-context).
    // Only Web3 wallets need bootstrapping here.
    if (isVirtualWallet) return;

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const res = await fetch('/api/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'wallet', wallet }),
        });
        if (!res.ok && !cancelled) {
          const { error } = await res.json().catch(() => ({}));
          if (error !== 'rate_limit') console.error('wallet bootstrap failed:', error);
        }
      } catch (err) {
        if (!cancelled) console.error('wallet bootstrap failed:', err);
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [account, isVirtualWallet]);

  return null;
}
