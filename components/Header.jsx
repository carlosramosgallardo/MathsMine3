'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NavLinks from '@/components/NavLinks'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import CurrencySwitcher from '@/components/CurrencySwitcher'
import AuthBar from '@/components/AuthBar'
import GlobalPulseBar from '@/components/GlobalPulseBar'
import MacroTicker from '@/components/MacroTicker'
import { useSound } from '@/lib/sound-context'

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

      {/* Identity row — world left, logo centered, controls right */}
      <div className="border-b border-cyan-900/15">
        <div className="mm3-header-identity-inner mx-auto w-full max-w-5xl px-2 sm:px-4">
          <div className="mm3-header-identity-row grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-2 sm:h-14 sm:gap-3">
            <div className="mm3-header-side-shell mm3-header-world-panel justify-self-end min-w-0">
              <GlobalPulseBar />
            </div>

            {/* On portrait mobile: flex row centred. On sm+: display:contents so children slot into the parent grid normally */}
            <div className="mm3-header-logo-controls-row flex items-center justify-center gap-3 sm:contents">
              <div className="mm3-header-logo-slot shrink-0">
                <Link
                  href="/"
                  onClick={triggerHomeLoading}
                  aria-label="MathsMine3 home"
                  className="group block focus:outline-none transition-transform duration-200 hover:scale-105"
                >
                  <Image src="/og-image.jpg" alt="MM3" width={38} height={38} priority />
                </Link>
              </div>

              <div className="mm3-header-side-shell mm3-header-user-panel justify-self-start">
                <CurrencySwitcher />
                <LanguageSwitcher />
                <SoundToggle />
                <AuthBar mode="controls" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet row — centered wallet info block */}
      <div className="mm3-header-wallet-row flex h-7 items-center justify-center border-b border-cyan-900/10 px-2 sm:px-4">
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
