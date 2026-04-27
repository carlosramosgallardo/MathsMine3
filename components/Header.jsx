'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import NavLinks from '@/components/NavLinks'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import CurrencySwitcher from '@/components/CurrencySwitcher'
import AuthBar from '@/components/AuthBar'
import GlobalPulseBar from '@/components/GlobalPulseBar'
import MacroTicker from '@/components/MacroTicker'
import UtcClock from '@/components/UtcClock'
import { useSound } from '@/lib/sound-context'
import supabase from '@/lib/supabaseClient'

function SoundToggle() {
  const { enabled, toggleSound } = useSound()
  return (
    <button
      onClick={toggleSound}
      title={enabled ? 'Mute sounds' : 'Unmute sounds'}
      aria-label={enabled ? 'Mute sounds' : 'Unmute sounds'}
      className="flex items-center justify-center rounded-sm border border-cyan-500/20 bg-transparent px-1.5 py-1 text-slate-400 transition hover:border-cyan-400/50 hover:text-cyan-300"
    >
      {enabled ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <line x1="23" y1="9" x2="17" y2="15"/>
          <line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      )}
    </button>
  )
}

function Mm3Total() {
  const [value, setValue] = useState(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('token_value')
          .select('total_eth')
          .limit(1)
          .maybeSingle()
        if (error) throw error
        if (mounted) setValue(Number(data?.total_eth) || 0)
      } catch {}
    }

    load()
    const timer = setInterval(load, 15000)
    window.addEventListener('focus', load)
    window.addEventListener('mm3-db-updated', load)

    const channel = supabase
      .channel('mm3-header-total-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_sell_transactions' }, load)
      .subscribe()

    return () => {
      mounted = false
      clearInterval(timer)
      window.removeEventListener('focus', load)
      window.removeEventListener('mm3-db-updated', load)
      supabase.removeChannel(channel)
    }
  }, [])

  if (value === null) return null

  return (
    <Link
      href="/mm3-value"
      className="inline-flex items-baseline gap-0.5 font-mono text-cyan-300/90 transition hover:text-cyan-200"
      title="MM3 total value"
    >
      <span className="text-[0.65rem]">{value.toFixed(2)}</span>
      <span className="text-[0.48rem] uppercase tracking-[0.18em] text-cyan-300/55">MM3</span>
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
    <header className={`fixed top-0 left-0 right-0 z-50 bg-black/97 backdrop-blur-sm border-b border-cyan-900/30 ${pathname === '/trade-mm3' ? 'mm3-trade-header' : ''}`}>

      {/* MacroTicker — full-width strip, all sizes: 28px mobile / 34px desktop */}
      <div className="mm3-header-ticker flex h-7 sm:h-[34px] items-center overflow-hidden border-b border-green-400/20 bg-black/60">
        <MacroTicker />
      </div>

      {/* Identity row — mobile portrait: row 1 pulse+logo, row 2 right-side controls */}
      <div className="border-b border-cyan-900/15 overflow-x-auto no-scrollbar max-sm:portrait:overflow-visible">
        <div className="flex h-12 items-center justify-center gap-1.5 px-3 sm:h-14 sm:gap-2.5 sm:px-4 max-sm:portrait:h-auto max-sm:portrait:min-h-12 max-sm:portrait:flex-wrap max-sm:portrait:gap-x-2 max-sm:portrait:gap-y-1 max-sm:portrait:py-1.5">
          <GlobalPulseBar />
          <Link
            href="/"
            onClick={triggerHomeLoading}
            aria-label="MathsMine3 home"
            className="shrink-0 block focus:outline-none transition-transform duration-200 hover:scale-105 mx-0.5 sm:mx-1"
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

      {/* Wallet row — clock | 📜 | MM3 total | 🤖 | wallet data */}
      <div className="mm3-header-wallet-row flex h-7 items-center justify-center gap-1.5 sm:gap-2 border-b border-cyan-900/10 px-2 sm:px-4 overflow-x-auto no-scrollbar">
        <UtcClock className="font-mono text-[0.65rem] sm:text-[0.80rem] font-black tracking-[0.08em] sm:tracking-[0.14em] text-cyan-300 shrink-0" />
        <Link
          href="/manifesto"
          className="shrink-0 text-[0.82rem] leading-none transition hover:opacity-70"
          title="Manifesto"
        >
          📜
        </Link>
        <Mm3Total />
        <Link
          href="/ai-team"
          className="shrink-0 text-[0.82rem] leading-none transition hover:opacity-70"
          title="AI Team"
        >
          🤖
        </Link>
        <AuthBar mode="wallet" />
      </div>

      {/* Nav bar — 44px mobile / 52px desktop */}
      <nav className="mm3-header-nav h-11 sm:h-[52px] overflow-x-auto no-scrollbar px-3 sm:px-0">
        <div className="mm3-header-nav-inner mx-auto max-w-5xl h-full">
          <NavLinks className="h-full justify-start sm:justify-center" />
        </div>
      </nav>

    </header>
  )
}
