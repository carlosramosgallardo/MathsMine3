'use client'

import { useLayoutEffect, useState } from 'react'
import DeadGate from '@/components/DeadGate'
import DisputesPanel from '@/components/DisputesPanel'
import PoolSqueezeList from '@/components/PoolSqueezeList'
import SectionFrame from '@/components/SectionFrame'
import { useActiveWallet } from '@/lib/use-active-wallet'
import { useI18n } from '@/lib/i18n-context'
import { useMm3Accent } from '@/lib/use-mm3-accent'

/**
 * Bare Squeezing UI for the native Android WebView.
 * Same PoolSqueezeList + DisputesPanel as /squeezing.
 * Seeds wallet via ?mm3_gw=0x… before auth reads localStorage.
 */
function EmbedSqueezingInner() {
  const { account } = useActiveWallet()
  const { language } = useI18n()
  const { frameAccent } = useMm3Accent()

  const handleWalletClick = (wallet) => {
    if (typeof window === 'undefined') return
    localStorage.setItem('mm3_leaderboard_wallet', wallet.toLowerCase())
    window.location.href = '/ranking'
  }

  const handlePoolClick = (poolCode) => {
    if (typeof window === 'undefined') return
    localStorage.setItem('mm3_leaderboard_pool', String(poolCode || '').toUpperCase())
    window.location.href = '/ranking'
  }

  const handleMarketBlockClick = (blockKey) => {
    if (typeof window === 'undefined' || !blockKey) return
    window.location.href = `/mining?block=${encodeURIComponent(blockKey)}`
  }

  return (
    <DeadGate>
      <main
        className="mm3-squeeze-page w-full px-2 py-1"
        style={{ '--mm3-accent': frameAccent }}
      >
        <div className="mx-auto w-full max-w-4xl">
          <PoolSqueezeList wallet={account?.toLowerCase() || ''} />
          <SectionFrame accent={frameAccent} id="squeeze-section-embed">
            <DisputesPanel
              wallet={account?.toLowerCase() || ''}
              poolCode=""
              language={language}
              onWalletClick={handleWalletClick}
              onPoolClick={handlePoolClick}
              onMarketBlockClick={handleMarketBlockClick}
            />
          </SectionFrame>
        </div>
      </main>
    </DeadGate>
  )
}

export default function EmbedSqueezingPage() {
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add('mm3-native-embed', 'mm3-native-squeezing-embed')

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
          color: '#fb7185',
          fontFamily: 'Consolas, monospace',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        SQUEEZING…
      </div>
    )
  }

  return <EmbedSqueezingInner />
}
