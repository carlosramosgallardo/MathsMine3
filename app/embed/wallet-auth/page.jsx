'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { signInWithWallet } from '@/lib/wallet-session-client';

const APP_SCHEME = 'xyz.mathsmine3.app';

export default function WalletAuthEmbedPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [status, setStatus] = useState('Connect a wallet to sign in to MathsMine3 native.');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('mm3-native-embed');
  }, []);

  const finishNative = (token, wallet) => {
    const target = `${APP_SCHEME}://auth?token=${encodeURIComponent(token)}&wallet=${encodeURIComponent(wallet)}`;
    window.location.href = target;
  };

  const handleSignIn = async () => {
    if (!address) return;
    setBusy(true);
    setStatus('Requesting signature…');
    try {
      const token = await signInWithWallet(address);
      setStatus('Success — returning to the app…');
      finishNative(token, address.toLowerCase());
    } catch (e) {
      setStatus(e?.message || 'Sign-in failed');
      setBusy(false);
    }
  };

  useEffect(() => {
    if (isConnected && address && !busy) {
      handleSignIn();
    }
  }, [isConnected, address]);

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#070b0f',
      color: '#e2e8f0',
      fontFamily: 'Consolas, monospace',
      padding: 24,
    }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <h1 style={{ fontSize: 18, marginBottom: 12 }}>MathsMine3 · Wallet sign-in</h1>
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>{status}</p>
        {!isConnected && (
          <button
            type="button"
            disabled={busy || connectors.length === 0}
            onClick={() => connect({ connector: connectors[0] })}
            style={{
              background: '#22d3ee',
              color: '#041018',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 8,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Connect wallet
          </button>
        )}
        {isConnected && (
          <button
            type="button"
            onClick={() => disconnect()}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: '8px 12px',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
