'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  cpuTone,
  createPortalPerfSampler,
  memoryTone,
  perfTone,
} from '@/lib/portal-perf-monitor'

const ENABLED = process.env.NEXT_PUBLIC_PORTAL_PERF !== '0'

export default function PortalPerfOverlay() {
  const [metrics, setMetrics] = useState({
    fps: 0,
    frameMs: 0,
    cpuLoad: 0,
    longTasks: 0,
    usedMb: null,
    limitMb: null,
  })

  useEffect(() => {
    if (!ENABLED || typeof window === 'undefined') return undefined
    const sampler = createPortalPerfSampler({ onUpdate: setMetrics })
    sampler.start()
    return () => sampler.stop()
  }, [])

  if (!ENABLED) return null

  const mobileTarget = typeof window !== 'undefined'
    && (window.innerWidth < 980 || (window.innerHeight > window.innerWidth && window.innerWidth < 820))
  const fpsColor  = perfTone(metrics.fps, mobileTarget ? { good: 28, warn: 22 } : { good: 52, warn: 32 })
  const cpuColor  = cpuTone(metrics.cpuLoad)
  const memColor  = memoryTone(metrics.usedMb, metrics.limitMb)
  const memStr    = Number.isFinite(metrics.usedMb) ? `${Math.round(metrics.usedMb)}M` : null

  return (
    <span
      className="shrink-0 font-mono leading-none pointer-events-none select-none"
      style={{ fontSize: '7px', letterSpacing: '0.04em' }}
      aria-hidden="true"
    >
      <span style={{ color: fpsColor }}>{metrics.fps}fps</span>
      <span className="text-slate-700"> · </span>
      <span style={{ color: cpuColor }}>{metrics.cpuLoad}%</span>
      {memStr && (
        <>
          <span className="text-slate-700"> · </span>
          <span style={{ color: memColor }}>{memStr}</span>
        </>
      )}
    </span>
  )
}
