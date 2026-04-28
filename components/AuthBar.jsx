'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google'
import { usePathname } from 'next/navigation'
import { useGoogleAuth } from '@/lib/google-auth-context'
import { colorFromAddress } from '@/lib/wallet-colors'
import supabase from '@/lib/supabaseClient'
import { useI18n } from '@/lib/i18n-context'
import { useCurrency } from '@/lib/currency-context'
import { formatMoney } from '@/lib/sell-offer'
import { clampRankLevel, getRankTier } from '@/lib/ranks'
import { normalizeWalletDecorations } from '@/lib/wallet-decorations'
import UtcClock from '@/components/UtcClock'

/* ── Icons ── */
function GoogleIcon({ size = 13, dim = false }) {
  const o = dim ? 0.35 : 1
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ opacity: o }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function WalletIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M16 12h2"/>
      <path d="M2 10h20"/>
    </svg>
  )
}

function PowerIcon({ connected = false, size = 15 }) {
  const color = connected ? '#22d3ee' : '#475569'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      style={{
        filter: connected
          ? 'drop-shadow(0 0 3px rgba(34,211,238,0.8)) drop-shadow(0 0 8px rgba(34,211,238,0.4))'
          : 'none',
        transition: 'filter 0.15s, stroke 0.15s',
      }}
    >
      <line x1="12" y1="2" x2="12" y2="12" />
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    </svg>
  )
}

/* ── Notify helper ── */
function notify(msg, type = 'info') {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type } }))
}

/* ── Connected state — same visual for both auth methods ── */
function ConnectedBar({ address, isRealWallet, onDisconnect, mode = 'full' }) {
  const walletColor = useMemo(() => colorFromAddress(address), [address])
  const visibleAddress = useMemo(() => (!address ? '' : address.slice(-5)), [address])
  const pathname = usePathname()
  const { t } = useI18n()
  const { currency } = useCurrency()
  const [walletSummary, setWalletSummary] = useState(null)
  const disconnectLockRef = useRef(false)

  useEffect(() => {
    if (!address) return undefined;
    let mounted = true;
    const wallet = address.toLowerCase();
    const source = isRealWallet ? 'wallet' : 'google';

    const beat = async () => {
      if (!mounted) return;
      await supabase
        .from('mm3_wallet_presence')
        .upsert({ wallet, source, last_seen: new Date().toISOString() }, { onConflict: 'wallet' });
    };

    beat().then(() => {
      if (typeof window !== 'undefined')
        window.dispatchEvent(new CustomEvent('mm3-presence-changed'));
    });
    const timer = setInterval(beat, 25_000);

    return () => {
      mounted = false;
      clearInterval(timer);
      // Expire presence immediately so Leaderboard shows offline without waiting 90s
      supabase
        .from('mm3_wallet_presence')
        .upsert(
          { wallet, source, last_seen: new Date(Date.now() - 120_000).toISOString() },
          { onConflict: 'wallet' }
        )
        .then(() => {
          if (typeof window !== 'undefined')
            window.dispatchEvent(new CustomEvent('mm3-presence-changed'));
        })
        .catch(() => {});
    };
  }, [address, isRealWallet]);

  useEffect(() => {
    if (!address || mode !== 'wallet') {
      setWalletSummary(null)
      return undefined
    }

    let mounted = true
    const wallet = address.toLowerCase()

    const loadSummary = async () => {
      try {
        const [{ data: leaderboardRow }, { data: progressRow }, { data: allLeaderboardRows }, { data: allProgressRows }] = await Promise.all([
          supabase
            .from('leaderboard_data')
            .select('wallet, total_eth')
            .eq('wallet', wallet)
            .maybeSingle(),
          supabase
            .from('player_progress')
            .select('level, mm3_sold, cny_earned, eur_earned, usd_earned, wallet_emojis')
            .eq('wallet', wallet)
            .maybeSingle(),
          supabase
            .from('leaderboard_data')
            .select('wallet, total_eth'),
          supabase
            .from('player_progress')
            .select('wallet, level'),
        ])

        if (!mounted) return

        const level = clampRankLevel(progressRow?.level ?? 0)
        const tier = getRankTier(level)
        const totalMm3 = Number(leaderboardRow?.total_eth) || 0
        const soldMm3 = Number(progressRow?.mm3_sold) || 0
        const availableMm3 = Math.max(0, totalMm3 - soldMm3)
        let position = null
        if (Array.isArray(allLeaderboardRows)) {
          const levelByWallet = new Map(
            (allProgressRows || []).map((entry) => [
              String(entry.wallet || '').toLowerCase(),
              clampRankLevel(entry.level ?? 0),
            ])
          )

          const progressByWallet = new Map(
            (allProgressRows || []).map((entry) => [
              String(entry.wallet || '').toLowerCase(),
              {
                level: clampRankLevel(entry.level ?? 0),
                mm3Sold: Number(entry.mm3_sold) || 0,
              },
            ])
          )

          const ranked = allLeaderboardRows
            .map((entry) => {
              const normalizedWallet = String(entry.wallet || '').toLowerCase()
              const progress = progressByWallet.get(normalizedWallet) || { level: 0, mm3Sold: 0 }
              const total = Number(entry.total_eth) || 0
              return {
                wallet: normalizedWallet,
                total,
                availableMm3: total - progress.mm3Sold,
                level: progress.level,
              }
            })
            .sort((a, b) => {
              if (b.level !== a.level) return b.level - a.level
              if (b.availableMm3 !== a.availableMm3) return b.availableMm3 - a.availableMm3
              return a.wallet.localeCompare(b.wallet)
            })
          const foundIndex = ranked.findIndex((entry) => entry.wallet === wallet)
          position = foundIndex >= 0 ? foundIndex + 1 : null
        }

        setWalletSummary({
          position,
          level,
          tier,
          availableMm3,
          funds: {
            EUR: Number(progressRow?.eur_earned) || 0,
            USD: Number(progressRow?.usd_earned) || 0,
            CNY: Number(progressRow?.cny_earned) || 0,
          },
          emojis: normalizeWalletDecorations(progressRow?.wallet_emojis),
        })
      } catch {}
    }

    loadSummary()
    const onDbUpdated = (event) => {
      const detailWallet = String(event?.detail?.wallet || '').toLowerCase()
      if (!detailWallet || detailWallet === wallet) loadSummary()
    }
    window.addEventListener('mm3-db-updated', onDbUpdated)
    window.addEventListener('mm3-correct', onDbUpdated)
    return () => {
      mounted = false
      window.removeEventListener('mm3-db-updated', onDbUpdated)
      window.removeEventListener('mm3-correct', onDbUpdated)
    }
  }, [address, mode])

  const copyAddress = async () => {
    if (!address || typeof navigator === 'undefined') return
    if (pathname === '/ranking') {
      window.dispatchEvent(new CustomEvent('mm3-leaderboard-toggle-wallet', { detail: { wallet: address } }))
      return
    }
    localStorage.setItem('mm3_leaderboard_wallet', String(address).toLowerCase())
    window.location.href = '/ranking'
  }

  const handleDisconnect = () => {
    if (disconnectLockRef.current) return
    disconnectLockRef.current = true
    try {
      onDisconnect?.()
    } finally {
      setTimeout(() => {
        disconnectLockRef.current = false
      }, 1200)
    }
  }

  const btn = `flex h-7 sm:h-9 items-center rounded-md px-1.5 sm:px-2 text-[0.82rem] sm:text-[0.90rem] font-mono font-semibold border transition-all duration-150 focus:outline-none whitespace-nowrap`
  const active = `border-transparent text-cyan-300 hover:border-transparent hover:bg-cyan-950/20 hover:shadow-none`
  const moneyValue = walletSummary ? walletSummary.funds[currency] || 0 : 0
  const mm3Compact = walletSummary ? Number(walletSummary.availableMm3 || 0).toFixed(2) : '0.00'

  return (
    <div className={`flex items-center ${mode === 'wallet' ? 'gap-1 sm:gap-1.5' : 'gap-1.5'}`}>
      {mode !== 'controls' && (
        <button
          type="button"
          onClick={copyAddress}
          className={`flex items-center rounded-md border border-transparent font-mono tracking-wide transition hover:bg-cyan-950/20 focus:border-transparent focus:outline-none focus:ring-0 active:border-transparent ${mode === 'wallet' ? 'min-h-5 px-1 py-0.5 text-[0.70rem] sm:px-1.5 sm:text-[0.82rem]' : 'h-9 px-2 text-[0.80rem] sm:text-[0.6rem]'}`}
          style={{ color: walletColor, textShadow: `0 0 10px ${walletColor}33` }}
          title={`${t('leaderboard.toggleMyWallet')}: ${address}`}
        >
          {mode === 'wallet' ? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              {walletSummary?.position ? (
                <span className="font-mono text-[0.60rem] font-black text-slate-500 sm:text-[0.65rem]">#{walletSummary.position}</span>
              ) : null}
              <span className="max-w-[13ch] truncate sm:max-w-[24ch]">{visibleAddress}</span>
              {walletSummary ? (
                <>
                  <span title={`${t('leaderboard.level')}: ${walletSummary.level}`} className="font-mono text-amber-400/90">{walletSummary.level}</span>
                  <span title={walletSummary.tier.label} className="text-[0.82rem]">{walletSummary.tier.emoji}</span>
                  <span title={`${t('leaderboard.mm3Earned')}: ${walletSummary.availableMm3.toFixed(8)}`} className="inline-flex items-baseline gap-0.5 text-cyan-300/90">
                    <span>{mm3Compact}</span>
                    <span className="text-[0.48rem] uppercase tracking-[0.1em] text-cyan-300/55">MM3</span>
                  </span>
                  <span title={`${t('leaderboard.sellValue')}: ${formatMoney(moneyValue, currency)}`} className="text-emerald-300/90">{`${{ EUR: '€', USD: '$', CNY: '¥' }[currency] || ''}${Number(moneyValue).toFixed(2)}`}</span>
                </>
              ) : null}
            </div>
          ) : visibleAddress}
        </button>
      )}
      {mode === 'wallet' ? null : (
        <button
          onClick={handleDisconnect}
          title={t('wallet.disconnect')}
          aria-label={t('wallet.disconnect')}
          className="group flex h-7 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-md border border-transparent transition-all duration-150 focus:outline-none hover:border-rose-500/30 hover:bg-rose-950/25"
        >
          <PowerIcon connected size={15} />
        </button>
      )}
    </div>
  )
}

/* ── Split connect double-button ── */
function SplitConnectButton({ onGoogleClick, onWalletClick, googleBusy, walletBusy, err, noGoogle }) {
  const [hoverG, setHoverG] = useState(false)
  const [hoverW, setHoverW] = useState(false)

  const PRIVACY_TIP = 'Sign in with Google — only an opaque game-ID is derived. No email, name, or personal data is ever stored.'
  const googleTitle = noGoogle ? 'Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in' : PRIVACY_TIP
  const googleLabel = googleBusy ? '⟳' : err ? '!' : null
  const handleWalletClick = (event) => {
    if (walletBusy) return
    event.preventDefault()
    event.stopPropagation()
    onWalletClick?.();
  }

  return (
    <div
      className="flex h-7 sm:h-9 items-center overflow-hidden rounded-md"
      style={{ border: `1px solid transparent` }}
    >
      {/* Google half */}
      <button
        type="button"
        onClick={!noGoogle && !googleBusy ? onGoogleClick : undefined}
        disabled={noGoogle || googleBusy}
        title={googleTitle}
        className="flex h-full items-center justify-center px-2.5 transition-colors duration-150 disabled:cursor-not-allowed focus:outline-none"
        style={{
          borderRight: `1px solid transparent`,
          background: hoverG && !noGoogle && !googleBusy ? 'rgba(34,211,238,0.08)' : 'transparent',
        }}
        onMouseEnter={() => setHoverG(true)}
        onMouseLeave={() => setHoverG(false)}
      >
        {googleLabel
          ? <span className="font-mono text-[0.88rem] font-bold" style={{ color: err ? '#ef4444' : '#22d3ee' }}>{googleLabel}</span>
          : <GoogleIcon dim={noGoogle} />
        }
      </button>

      {/* Wallet half */}
      <button
        type="button"
        onClick={handleWalletClick}
        title="Connect a crypto wallet to play and mine MM3"
        disabled={walletBusy}
        className="relative z-10 flex h-full min-w-10 items-center justify-center px-2.5 transition-colors duration-150 focus:outline-none disabled:cursor-not-allowed"
        style={{ background: hoverW && !walletBusy ? 'rgba(34,211,238,0.08)' : 'transparent' }}
        onMouseEnter={() => setHoverW(true)}
        onMouseLeave={() => setHoverW(false)}
      >
        {walletBusy ? <span className="font-mono text-[0.88rem] font-bold text-cyan-400">⟳</span> : <PowerIcon connected={false} size={14} />}
      </button>
    </div>
  )
}

/* ── Inner bar — requires GoogleOAuthProvider in tree ── */
function AuthBarWithGoogle({ mode = 'full' }) {
  const { address, isConnected } = useAccount()
  const { open } = useWeb3Modal()
  const { disconnect } = useDisconnect()
  const { googleWallet, setGoogleSub, signOut: googleSignOut } = useGoogleAuth()
  const { t } = useI18n()
  const [googleBusy, setGoogleBusy] = useState(false)
  const [walletBusy, setWalletBusy] = useState(false)
  const [err, setErr] = useState(false)
  const walletModalLockRef = useRef(false)

  const googleLogin = useGoogleLogin({
    scope: 'openid',
    onSuccess: async (res) => {
      setGoogleBusy(true)
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${res.access_token}` },
        })
        const { sub } = await r.json()
        await setGoogleSub(sub)
      } catch { setErr(true); setTimeout(() => setErr(false), 3000) }
      finally { setGoogleBusy(false) }
    },
    onError: () => { setErr(true); setTimeout(() => setErr(false), 3000) },
  })

  if (isConnected) {
    return <ConnectedBar address={address} isRealWallet onDisconnect={disconnect} mode={mode} />
  }
  if (googleWallet) {
    return <ConnectedBar address={googleWallet} isRealWallet={false} onDisconnect={googleSignOut} mode={mode} />
  }
  if (mode === 'wallet') return null
  const openWalletModal = async () => {
    if (walletModalLockRef.current) return
    walletModalLockRef.current = true
    setWalletBusy(true)
    try {
      await open?.({ view: 'Connect' });
    } catch (error) {
      console.error('wallet modal open:', error);
      notify(t('wallet.walletModalFailed'), 'error');
    } finally {
      setTimeout(() => {
        walletModalLockRef.current = false
        setWalletBusy(false)
      }, 900)
    }
  };
  return (
    <SplitConnectButton
      onGoogleClick={googleLogin}
      onWalletClick={openWalletModal}
      googleBusy={googleBusy}
      walletBusy={walletBusy}
      err={err}
    />
  )
}

/* ── Fallback when no CLIENT_ID ── */
function AuthBarWalletOnly({ mode = 'full' }) {
  const { address, isConnected } = useAccount()
  const { open } = useWeb3Modal()
  const { disconnect } = useDisconnect()
  const { googleWallet, signOut: googleSignOut } = useGoogleAuth()
  const { t } = useI18n()
  const [walletBusy, setWalletBusy] = useState(false)
  const walletModalLockRef = useRef(false)

  if (isConnected) {
    return <ConnectedBar address={address} isRealWallet onDisconnect={disconnect} mode={mode} />
  }
  if (googleWallet) {
    return <ConnectedBar address={googleWallet} isRealWallet={false} onDisconnect={googleSignOut} mode={mode} />
  }
  if (mode === 'wallet') return null
  const openWalletModal = async () => {
    if (walletModalLockRef.current) return
    walletModalLockRef.current = true
    setWalletBusy(true)
    try {
      await open?.({ view: 'Connect' });
    } catch (error) {
      console.error('wallet modal open:', error);
      notify(t('wallet.walletModalFailed'), 'error');
    } finally {
      setTimeout(() => {
        walletModalLockRef.current = false
        setWalletBusy(false)
      }, 900)
    }
  };
  return (
    <SplitConnectButton
      onWalletClick={openWalletModal}
      walletBusy={walletBusy}
      googleBusy={false}
      noGoogle
    />
  )
}

/* ── Export ── */
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

export default function AuthBar({ mode = 'full' }) {
  // wallet mode never shows the Google login button (returns null when disconnected),
  // so it doesn't need GoogleOAuthProvider — avoids injecting the GSI script twice.
  if (CLIENT_ID && mode !== 'wallet') {
    return (
      <GoogleOAuthProvider clientId={CLIENT_ID}>
        <AuthBarWithGoogle mode={mode} />
      </GoogleOAuthProvider>
    )
  }
  return <AuthBarWalletOnly mode={mode} />
}
