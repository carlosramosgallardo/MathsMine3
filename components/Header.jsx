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

export default function Header() {
  const pathname = usePathname()

  const triggerHomeLoading = () => {
    if (typeof window === 'undefined' || pathname === '/') return
    window.dispatchEvent(new CustomEvent('mm3-route-loading', { detail: { href: '/', label: 'play' } }))
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/97 backdrop-blur-sm border-b border-cyan-900/30">

      {/* MacroTicker — full-width strip, all sizes: 28px mobile / 34px desktop */}
      <div className="flex h-7 sm:h-[34px] items-center overflow-hidden border-b border-green-400/20 bg-black/60">
        <MacroTicker />
      </div>

      {/* Identity row — left/right panels + logo absolutely centered */}
      <div className="border-b border-cyan-900/15">
        <div className="mx-auto w-full max-w-5xl px-2 sm:px-4">
          <div className="mm3-header-identity-row relative flex items-center h-12 sm:h-14">

            {/* Left: game global data — CYAN panel */}
            <div className="mm3-header-world-panel flex items-center rounded-md border border-cyan-400/40 bg-cyan-950/15 px-1 sm:px-1.5 py-1 shadow-[0_0_12px_rgba(34,211,238,0.1)]">
              <GlobalPulseBar />
            </div>

            {/* Logo — absolutely centered, matches Board logo exactly */}
            <div className="mm3-header-logo-slot absolute left-1/2 -translate-x-1/2">
              <Link
                href="/"
                onClick={triggerHomeLoading}
                aria-label="MathsMine3 home"
                className="group block w-11 h-11 rounded-full overflow-hidden focus:outline-none transition-transform duration-200 hover:scale-110"
                style={{
                  border: '2px solid rgba(34,211,238,0.5)',
                  boxShadow: '0 0 14px rgba(34,211,238,0.35), 0 0 28px rgba(34,211,238,0.15)',
                }}
              >
                <Image src="/og-image.jpg" alt="MM3" width={44} height={44} className="rounded-full w-full h-full object-cover" priority />
              </Link>
            </div>

            {/* Right: user config — EMERALD panel */}
            <div className="mm3-header-user-panel ml-auto flex items-center rounded-md border border-emerald-400/40 bg-emerald-950/15 px-1 sm:px-1.5 py-1 shadow-[0_0_12px_rgba(74,222,128,0.1)]">
              <CurrencySwitcher />
              <LanguageSwitcher />
              <AuthBar mode="controls" />
            </div>

          </div>
        </div>
      </div>

      {/* Wallet row — always reserved, shows address only when connected */}
      <div className="h-6 flex items-center justify-center border-b border-cyan-900/10">
        <AuthBar mode="wallet" />
      </div>

      {/* Nav bar — 44px mobile / 52px desktop */}
      <nav className="h-11 sm:h-[52px] overflow-x-auto no-scrollbar px-3 sm:px-0">
        <div className="mx-auto max-w-5xl h-full">
          <NavLinks className="h-full justify-start sm:justify-center" />
        </div>
      </nav>

    </header>
  )
}
