'use client'

import { useLayoutEffect, useMemo, useState } from 'react'
import HomeWorldMinimap from '@/components/HomeWorldMinimap'

/**
 * Bare world minimap for the Android home nonagon core toggle.
 * Tap closes back to the native logo + polygon (via MM3NativeMinimap.close).
 */
export default function HomeMinimapEmbedPage() {
  const [es, setEs] = useState(false)

  useLayoutEffect(() => {
    document.documentElement.classList.add('mm3-native-embed', 'mm3-native-minimap-embed')
    try {
      const params = new URLSearchParams(window.location.search)
      const fromQuery = (params.get('lang') || '').toLowerCase()
      const fromLs = (localStorage.getItem('mm3-language') || localStorage.getItem('mm3_lang') || '').toLowerCase()
      const fromNative = (window.__MM3_NATIVE_LANG__ || '').toLowerCase()
      const lang = fromQuery || fromLs || fromNative
      setEs(lang.startsWith('es') || (!lang && (navigator.language || '').startsWith('es')))
    } catch {
      setEs(false)
    }
  }, [])

  const title = useMemo(
    () => (es ? 'Mostrar logo MM3' : 'Show MM3 logo'),
    [es],
  )

  const close = () => {
    try {
      window.MM3NativeMinimap?.close?.()
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={close}
      title={title}
      aria-label={title}
      className="mm3-home-minimap-embed"
      style={{
        position: 'fixed',
        inset: 0,
        margin: 0,
        padding: 8,
        border: 0,
        background: '#01070e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <style>{`
        .mm3-home-minimap-embed .mm3-home-worldmap {
          width: min(100%, 420px) !important;
          max-width: 100% !important;
          height: auto !important;
          display: block !important;
        }
      `}</style>
      <HomeWorldMinimap es={es} />
    </button>
  )
}
