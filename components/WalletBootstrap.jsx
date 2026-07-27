'use client';

import { useEffect } from 'react';
import { getAccount } from 'wagmi/actions';
import { useActiveWallet } from '@/lib/use-active-wallet';
import {
  getSessionToken,
  shouldAutoPromptWalletSign,
  signInWithWallet,
  walletSignErrorMessage,
} from '@/lib/wallet-session-client';
import { useI18n } from '@/lib/i18n-context';
import { wagmiConfig } from '@/lib/wagmi-core';

export default function WalletBootstrap() {
  const { account, isVirtualWallet } = useActiveWallet();
  const { language } = useI18n();

  useEffect(() => {
    const wallet = String(account || '').toLowerCase();
    if (!wallet) return;

    // Google wallets are created server-side during login (google-auth-context).
    // Only Web3 wallets need bootstrapping here.
    if (isVirtualWallet) return;

    // Already have a portal session — don't re-prompt on every page.
    if (getSessionToken(wallet)) return;

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

      if (cancelled) return;

      // MetaMask injected: auto sign-in is fine.
      // Ronin / WalletConnect: defer until the user acts (EXEC / accept) — immediate
      // personal_sign after connect often hits Ronin's "Login session has expired".
      const connected = getAccount(wagmiConfig);
      if (!shouldAutoPromptWalletSign(connected.connector)) {
        return;
      }

      await new Promise((r) => setTimeout(r, 250));
      if (cancelled) return;

      try {
        await signInWithWallet(wallet);
      } catch (err) {
        if (cancelled) return;
        const code = err?.message || '';
        console.error('wallet session sign-in failed:', code || err);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mm3-toast', {
            detail: {
              msg: walletSignErrorMessage(code, language),
              type: 'error',
            },
          }));
        }
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [account, isVirtualWallet, language]);

  return null;
}
