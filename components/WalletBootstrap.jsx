'use client';

import { useEffect } from 'react';
import { getAccount } from 'wagmi/actions';
import { useActiveWallet } from '@/lib/use-active-wallet';
import {
  getSessionToken,
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

    // Google wallets mint session during loginWithGoogle — no personal_sign.
    if (isVirtualWallet) return;

    // Already signed in for this wallet — squeeze/trade reuse the cached session.
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

      const connected = getAccount(wagmiConfig);
      const connector = connected.connector;
      const isWc = !!(
        connector
        && (connector.type === 'walletConnect'
          || /walletconnect|ronin/i.test(`${connector.id || ''} ${connector.name || ''}`))
      );

      // One personal_sign at connect time (not mid-squeeze/EXEC).
      // Give WC a moment to finish the connect handshake first.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mm3-toast', {
          detail: {
            msg: language === 'es'
              ? 'Firma el mensaje en tu wallet para entrar (una sola vez)'
              : 'Sign the wallet message to enter (one time)',
            type: 'info',
          },
        }));
      }
      await new Promise((r) => setTimeout(r, isWc ? 900 : 300));
      if (cancelled) return;

      // Some wallets (esp. WC) can still be hydrating right after connect —
      // retry briefly before showing an error toast.
      const retryDelaysMs = isWc ? [2000, 4000] : [];
      for (let attempt = 0; ; attempt += 1) {
        try {
          await signInWithWallet(wallet);
          return;
        } catch (err) {
          if (cancelled) return;
          const code = err?.message || '';
          const isTransientLock = code === 'wallet_locked' && attempt < retryDelaysMs.length;
          if (isTransientLock) {
            console.warn(`wallet session sign-in retry ${attempt + 1}:`, code);
            await new Promise((r) => setTimeout(r, retryDelaysMs[attempt]));
            if (cancelled) return;
            continue;
          }
          console.error('wallet session sign-in failed:', code || err);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('mm3-toast', {
              detail: {
                msg: walletSignErrorMessage(code, language),
                type: 'error',
              },
            }));
          }
          return;
        }
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [account, isVirtualWallet, language]);

  return null;
}
