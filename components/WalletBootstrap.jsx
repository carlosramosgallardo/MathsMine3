'use client';

import { useEffect } from 'react';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { signInWithWallet } from '@/lib/wallet-session-client';

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

      // One signature prompt (skipped entirely if a valid session is already
      // cached) — proves the caller actually controls this wallet's private
      // key. See 2026-07 security audit, phase 2.
      try {
        if (!cancelled) await signInWithWallet(wallet);
      } catch (err) {
        if (!cancelled) console.error('wallet session sign-in failed:', err);
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [account, isVirtualWallet]);

  return null;
}
