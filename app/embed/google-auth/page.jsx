'use client';

import { useEffect, useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { signInWithGoogle } from '@/lib/wallet-session-client';

const APP_SCHEME = 'xyz.mathsmine3.app';
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

/**
 * Bare Google OAuth for the native Android app.
 * Uses the same Web client ID as the portal — no Android SHA-1 client required.
 * On success: create-account + session → deep link back into the app.
 */
function GoogleAuthInner() {
  const [status, setStatus] = useState('Sign in with Google to continue in MathsMine3.');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('mm3-native-embed');
  }, []);

  const finishNative = (token, wallet) => {
    const target =
      `${APP_SCHEME}://auth` +
      `?kind=google` +
      `&token=${encodeURIComponent(token)}` +
      `&wallet=${encodeURIComponent(wallet)}`;
    window.location.href = target;
  };

  const complete = async (accessToken) => {
    setBusy(true);
    setStatus('Creating wallet…');
    try {
      const res = await fetch('/api/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'google', access_token: accessToken }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'create_account_failed');
      const wallet = String(body.wallet || '').toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(wallet)) throw new Error('invalid_wallet');
      setStatus('Creating session…');
      const token = await signInWithGoogle(accessToken, wallet);
      setStatus('Success — returning to the app…');
      finishNative(token, wallet);
    } catch (e) {
      setStatus(e?.message || 'Google sign-in failed');
      setBusy(false);
    }
  };

  const googleLogin = useGoogleLogin({
    scope: 'openid email profile',
    onSuccess: async (res) => {
      if (!res?.access_token) {
        setStatus('No access token from Google');
        return;
      }
      await complete(res.access_token);
    },
    onError: () => setStatus('Google sign-in cancelled or failed'),
  });

  if (!CLIENT_ID) {
    return (
      <p style={{ color: '#f87171', fontFamily: 'monospace', fontSize: 12 }}>
        NEXT_PUBLIC_GOOGLE_CLIENT_ID missing
      </p>
    );
  }

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
        <h1 style={{ fontSize: 18, marginBottom: 12 }}>MathsMine3 · Google</h1>
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>{status}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => googleLogin()}
          style={{
            background: '#22d3ee',
            color: '#041018',
            border: 'none',
            padding: '10px 16px',
            borderRadius: 8,
            fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? '…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}

export default function GoogleAuthEmbedPage() {
  if (!CLIENT_ID) {
    return (
      <div style={{ padding: 24, background: '#070b0f', color: '#f87171', minHeight: '100dvh' }}>
        NEXT_PUBLIC_GOOGLE_CLIENT_ID missing
      </div>
    );
  }
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <GoogleAuthInner />
    </GoogleOAuthProvider>
  );
}
