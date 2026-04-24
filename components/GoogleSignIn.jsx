'use client';

import { useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useGoogleAuth } from '@/lib/google-auth-context';
import { useAccount } from 'wagmi';

const G = '#4ade80';

const PRIVACY_TIP =
  'Sign in with Google — only an opaque game-ID is derived. ' +
  'No email, name, photo, or personal data is ever read, stored, or shown.';

function SignInButton({ onClick, busy, err, disabled }) {
  const label = busy ? '⟳' : err ? 'Error' : 'G· Play';
  const color  = err ? '#ef4444' : disabled ? G + '40' : G + 'cc';
  const border = err ? '#ef444450' : disabled ? G + '20' : G + '35';
  return (
    <button
      onClick={!busy && !disabled ? onClick : undefined}
      disabled={busy || disabled}
      title={disabled ? 'Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in' : PRIVACY_TIP}
      className="px-2 py-1 rounded font-mono text-[0.65rem] font-semibold border transition-all focus:outline-none disabled:cursor-not-allowed"
      style={{ color, borderColor: border, background: 'transparent' }}
      onMouseEnter={e => {
        if (!busy && !disabled && !err) {
          e.currentTarget.style.color = G;
          e.currentTarget.style.borderColor = G + '80';
          e.currentTarget.style.boxShadow = `0 0 10px ${G}30`;
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = color;
        e.currentTarget.style.borderColor = border;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {label}
    </button>
  );
}

/* ── Version with live OAuth (requires CLIENT_ID + GoogleOAuthProvider) ── */
function GoogleButtonWithAuth() {
  const { googleWallet, setGoogleSub } = useGoogleAuth();
  const { isConnected } = useAccount();
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState(false);

  const login = useGoogleLogin({
    scope: 'openid',
    onSuccess: async (res) => {
      try {
        setBusy(true);
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${res.access_token}` },
        });
        const { sub } = await r.json();
        await setGoogleSub(sub);
      } catch {
        setErr(true);
        setTimeout(() => setErr(false), 3000);
      } finally {
        setBusy(false);
      }
    },
    onError: () => { setErr(true); setTimeout(() => setErr(false), 3000); },
  });

  if (isConnected || googleWallet) return null;
  return <SignInButton onClick={login} busy={busy} err={err} />;
}

/* ── Placeholder shown when CLIENT_ID is not configured ── */
function GoogleButtonPlaceholder() {
  const { googleWallet } = useGoogleAuth();
  const { isConnected } = useAccount();
  if (isConnected || googleWallet) return null;
  return <SignInButton disabled />;
}

/* ── Exported component — always renders ── */
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export default function GoogleSignIn() {
  if (CLIENT_ID) {
    return (
      <GoogleOAuthProvider clientId={CLIENT_ID}>
        <GoogleButtonWithAuth />
      </GoogleOAuthProvider>
    );
  }
  return <GoogleButtonPlaceholder />;
}
