'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import NavLinks from '@/components/NavLinks'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import CurrencySwitcher from '@/components/CurrencySwitcher'
import GlobalPulseBar from '@/components/GlobalPulseBar'
import MacroTicker from '@/components/MacroTicker'
import UtcClock from '@/components/UtcClock'
import { useSound } from '@/lib/sound-context'
import supabase from '@/lib/supabaseClient'
import { formatCompactNum } from '@/lib/sell-offer'
import { useActiveWallet } from '@/lib/use-active-wallet'
import { loadDailyTaskProgress } from '@/lib/daily-tasks'

// Deferred: AuthBar statically imports @web3modal — loading it lazily keeps
// the 1.4 MB walletconnect chunk out of the initial page bundle.
const AuthBar = dynamic(() => import('@/components/AuthBar'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-1.5">
      <div className="h-7 w-16 rounded border border-cyan-900/40 bg-cyan-950/10 animate-pulse" />
      <div className="h-7 w-14 rounded border border-cyan-900/40 bg-cyan-950/10 animate-pulse" />
    </div>
  ),
})

function SoundToggle() {
  const { enabled, toggleSound } = useSound()
  return (
    <button
      onClick={toggleSound}
      title={enabled ? 'Mute sounds' : 'Unmute sounds'}
      aria-label={enabled ? 'Mute sounds' : 'Unmute sounds'}
      className="flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center border-0 bg-transparent px-1.5 py-1 text-slate-400 transition hover:text-cyan-300"
    >
      {enabled ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      )}
    </button>
  )
}

function Mm3Total() {
  const [value, setValue] = useState(null)
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const res = await fetch('/api/token-value')
        if (!res.ok) throw new Error('fetch failed')
        const json = await res.json()
        if (mounted) setValue(Number(json?.total_eth ?? json?.value) || 0)
      } catch {}
    }

    load()
    const timer = setInterval(load, 60_000)
    window.addEventListener('focus', load)
    window.addEventListener('mm3-db-updated', load)

    return () => {
      mounted = false
      clearInterval(timer)
      window.removeEventListener('focus', load)
      window.removeEventListener('mm3-db-updated', load)
    }
  }, [pathname])

  if (value === null) return null

  return (
    <Link
      href="/mm3-value"
      className="inline-flex items-baseline gap-0.5 font-mono text-cyan-300/90 transition hover:text-cyan-200"
      title="MM3 total value"
    >
      <span className="text-[0.80rem] font-semibold">{formatCompactNum(value)}</span>
      <span className="text-[0.52rem] uppercase tracking-[0.18em] text-cyan-300/55">MM3</span>
    </Link>
  )
}

function DailyTaskLink() {
  const { account } = useActiveWallet()
  const [pendingRewards, setPendingRewards] = useState(0)

  useEffect(() => {
    let mounted = true
    const wallet = String(account || '').toLowerCase()

    if (!wallet) {
      setPendingRewards(0)
      return undefined
    }

    const load = async () => {
      try {
        const state = await loadDailyTaskProgress(supabase, wallet)
        if (mounted) setPendingRewards(state.pendingRewards || 0)
      } catch {
        if (mounted) setPendingRewards(0)
      }
    }

    load()
    const timer = setInterval(load, 120_000)
    window.addEventListener('focus', load)
    window.addEventListener('mm3-db-updated', load)

    return () => {
      mounted = false
      clearInterval(timer)
      window.removeEventListener('focus', load)
      window.removeEventListener('mm3-db-updated', load)
    }
  }, [account])

  const count = Math.max(0, Number(pendingRewards) || 0)

  return (
    <Link
      href="/daily-tasks"
      className="relative shrink-0 px-1 text-[0.82rem] leading-none transition hover:opacity-70"
      title={count > 0 ? `${count} daily task reward${count === 1 ? '' : 's'} ready · Daily Tasks` : 'Daily Tasks'}
      aria-label={count > 0 ? `Daily Tasks, ${count} daily task reward${count === 1 ? '' : 's'} ready` : 'Daily Tasks'}
    >
      <span aria-hidden="true">🎯</span>
      {count > 0 ? (
        <span className="absolute -right-1.5 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-cyan-200 bg-fuchsia-500 px-1 font-mono text-[0.56rem] font-black leading-none text-white shadow-[0_0_8px_rgba(217,70,239,0.75)]">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </Link>
  )
}

export default function Header() {
  const pathname = usePathname()

  const triggerHomeLoading = () => {
    if (typeof window === 'undefined' || pathname === '/') return
    window.dispatchEvent(new CustomEvent('mm3-route-loading', { detail: { href: '/', label: 'play' } }))
  }

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 bg-black/97 backdrop-blur-sm border-b border-cyan-900/30 ${pathname === '/trading' ? 'mm3-trade-header' : ''}`}>
      <div className="mm3-header-ticker flex h-7 sm:h-[34px] items-center overflow-hidden border-b border-green-400/20 bg-black/60">
        <MacroTicker />
      </div>

      <div className="relative z-[90] border-b border-cyan-900/15 overflow-visible">
        <div className="flex h-12 items-center justify-center gap-1.5 px-3 sm:h-14 sm:gap-2.5 sm:px-4 max-sm:portrait:h-auto max-sm:portrait:min-h-12 max-sm:portrait:flex-wrap max-sm:portrait:gap-x-2 max-sm:portrait:gap-y-1 max-sm:portrait:py-1.5">
          <GlobalPulseBar />
          <Link
            href="/"
            onClick={triggerHomeLoading}
            aria-label="MathsMine3 home"
            className="shrink-0 block focus:outline-none transition-opacity duration-150 hover:opacity-85 mx-0.5 sm:mx-1"
          >
            <Image src="/og-image.jpg" alt="MM3" width={38} height={38} priority />
          </Link>
          <div aria-hidden="true" className="hidden basis-full max-sm:portrait:block max-sm:portrait:h-0" />
          <div className="contents max-sm:portrait:flex max-sm:portrait:w-full max-sm:portrait:items-center max-sm:portrait:justify-center max-sm:portrait:gap-2">
            <CurrencySwitcher />
            <LanguageSwitcher />
            <SoundToggle />
            <AuthBar mode="controls" />
          </div>
        </div>
      </div>

      <div className="mm3-header-wallet-row relative z-[40] flex h-7 items-center justify-center gap-1.5 sm:gap-2 border-b border-cyan-900/10 px-2 sm:px-4 overflow-x-auto no-scrollbar">
        <UtcClock className="font-mono text-[0.65rem] sm:text-[0.80rem] font-black tracking-[0.08em] sm:tracking-[0.14em] text-cyan-300 shrink-0" />
        <DailyTaskLink />
        <Mm3Total />
        <AuthBar mode="wallet" />
      </div>

    </header>
  )
}
