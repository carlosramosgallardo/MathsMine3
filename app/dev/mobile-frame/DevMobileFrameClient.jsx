'use client'

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  DEV_PORTAL_PREVIEW_ROUTES,
  MOBILE_PREVIEW_VIEWPORT,
  withMobilePreviewQuery,
} from '@/lib/mobile-preview'

const { width: FRAME_W, height: FRAME_H } = MOBILE_PREVIEW_VIEWPORT

export default function DevMobileFramePage() {
  const params = useSearchParams()
  const initialPath = params.get('path') || '/mining'
  const [path, setPath] = useState(initialPath)

  const iframeSrc = useMemo(() => {
    if (typeof window === 'undefined') {
      return withMobilePreviewQuery(path, 'http://localhost:3000')
    }
    return withMobilePreviewQuery(path, window.location.origin)
  }, [path])

  const go = useCallback((nextPath) => {
    setPath(nextPath)
  }, [])

  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center font-mono text-sm text-slate-500">
        Dev only.
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center gap-3 bg-[#030609] px-3 py-5 font-mono text-[11px] text-slate-500"
      style={{ minHeight: '100dvh' }}
    >
      <div className="text-center">
        <p className="text-cyan-400/90 text-xs tracking-wide">
          Android vertical · {FRAME_W}×{FRAME_H} · un solo <span className="text-cyan-300">npm run dev</span>
        </p>
        <p className="mt-1 text-[10px] text-slate-600">
          Navega dentro del marco; el modo móvil se mantiene en toda la sesión del iframe.
        </p>
      </div>

      <nav className="flex max-w-[min(100%,720px)] flex-wrap items-center justify-center gap-1.5">
        {DEV_PORTAL_PREVIEW_ROUTES.map(({ path: routePath, label }) => (
          <button
            key={routePath}
            type="button"
            onClick={() => go(routePath)}
            className={`border px-2 py-1 text-[10px] tracking-wide transition-colors ${
              path === routePath
                ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200'
                : 'border-cyan-900/30 bg-black/40 text-slate-400 hover:border-cyan-800/50 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <iframe
        key={iframeSrc}
        title="MM3 mobile preview"
        src={iframeSrc}
        width={FRAME_W}
        height={FRAME_H}
        allow="autoplay; fullscreen"
        className="shrink-0 rounded border border-cyan-900/40 bg-black shadow-[0_0_40px_rgba(34,211,238,.08)]"
        style={{ width: FRAME_W, height: FRAME_H, maxWidth: '100%' }}
      />

      <p className="max-w-lg text-center leading-relaxed text-slate-600">
        PC: esta página · iframe:{' '}
        <a
          href={iframeSrc}
          className="text-cyan-400/80 underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {iframeSrc}
        </a>
      </p>
    </div>
  )
}
