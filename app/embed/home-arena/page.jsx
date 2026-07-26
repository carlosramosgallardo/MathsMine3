'use client'

import HomeMiningScene from '@/components/HomeMiningScene'

/**
 * Bare arena for the native Android home carousel WebView.
 * Same Three.js lineup/textures/avatars as the portal home — no chrome.
 */
export default function HomeArenaEmbedPage() {
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
