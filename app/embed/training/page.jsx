'use client'

import { useLayoutEffect, useState } from 'react'
import DeadGate from '@/components/DeadGate'
import HomePageClient from '@/components/HomePageClient'

/**
 * Bare Training board for the native Android WebView.
 * Same Board.jsx loop as /training (countdown, drops, drill slots, revive).
 * Seeds wallet via ?mm3_gw=0x… before auth reads localStorage.
 */
export default function EmbedTrainingPage() {
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add('mm3-native-embed', 'mm3-native-training-embed')

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
          color: '#f59e0b',
          fontFamily: 'Consolas, monospace',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        TRAINING…
      </div>
    )
  }

  return (
    <DeadGate>
      <HomePageClient />
    </DeadGate>
  )
}
