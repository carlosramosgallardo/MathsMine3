'use client'

import { useLayoutEffect, useState } from 'react'
import DeadGate from '@/components/DeadGate'
import SectionFrame from '@/components/SectionFrame'
import TradeBoard from '@/components/TradeBoard'
import { useActiveWallet } from '@/lib/use-active-wallet'
import { useMm3Accent } from '@/lib/use-mm3-accent'

/**
 * Bare Trading board for the native Android WebView.
 * Same TradeBoard.jsx as /trading (orders, EXEC, Zero-Day drops, etc.).
 * Seeds wallet via ?mm3_gw=0x… before auth reads localStorage.
 */
function EmbedTradingInner() {
  const { account, isVirtualWallet } = useActiveWallet()
  const { frameAccent } = useMm3Accent()

  return (
    <DeadGate>
      <main className="mm3-trade-page w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
        <SectionFrame accent={frameAccent} id="trade-mm3-section-embed">
          <TradeBoard account={account} isVirtualWallet={isVirtualWallet} />
        </SectionFrame>
      </main>
    </DeadGate>
  )
}

export default function EmbedTradingPage() {
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add('mm3-native-embed', 'mm3-native-trading-embed')

    try {
      const params = new URLSearchParams(window.location.search)
      const gw = params.get('mm3_gw')
      if (gw && /^0x[a-fA-F0-9]{40}$/.test(gw)) {
        localStorage.setItem('mm3_gw', gw.toLowerCase())
      }
      if (params.has('mm3_gw') && window.history.replaceState) {
        params.delete('mm3_gw')
        const q = params.toString()
        const clean = window.location.pathname + (q ? `?${q}` : '') + window.location.hash
        window.history.replaceState(null, '', clean)
      }
    } catch {
      /* ignore */
    }

    setReady(true)
  }, [])

  if (!ready) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '40vh',
          background: '#070b0f',
          color: '#4ade80',
          fontFamily: 'Consolas, monospace',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        TRADING…
      </div>
    )
  }

  return <EmbedTradingInner />
}
