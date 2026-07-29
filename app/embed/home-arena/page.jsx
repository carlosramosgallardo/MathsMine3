'use client'

import { useEffect } from 'react'
import HomeMiningScene from '@/components/HomeMiningScene'

/**
 * Bare arena for the native Android home carousel WebView.
 * Same Three.js lineup/textures/avatars as the portal home — no chrome.
 */
export default function HomeArenaEmbedPage() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const params = url.searchParams
      const gw = params.get('mm3_gw')
      if (gw && /^0x[a-fA-F0-9]{40}$/.test(gw)) {
        localStorage.setItem('mm3_gw', gw.toLowerCase())
        window.__MM3_NATIVE_GW__ = gw.toLowerCase()
        window.dispatchEvent(new CustomEvent('mm3-native-session', { detail: { gw: gw.toLowerCase() } }))
      }
      if (params.has('mm3_gw') && window.history.replaceState) {
        params.delete('mm3_gw')
        const next = `${url.pathname}${params.toString() ? `?${params.toString()}` : ''}${url.hash || ''}`
        window.history.replaceState({}, '', next)
      }
    } catch {}
  }, [])

  return (
    <div
      className="mm3-home-arena-embed"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#070b0f',
        overflow: 'hidden',
      }}
    >
      <style>{`
        .mm3-home-arena-embed .mm3-home-arena {
          width: 100vw !important;
          height: 100vh !important;
          min-height: 100vh !important;
        }
        .mm3-home-arena-embed canvas {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
        }
      `}</style>
      <HomeMiningScene />
    </div>
  )
}
