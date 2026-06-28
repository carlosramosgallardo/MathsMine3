'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  cpuTone,
  createPortalPerfSampler,
  memoryTone,
  perfTone,
} from '@/lib/portal-perf-monitor'

// On in every environment (prod included). Build with NEXT_PUBLIC_PORTAL_PERF=0 to hide.
const ENABLED = process.env.NEXT_PUBLIC_PORTAL_PERF !== '0'

function routeLabel(pathname) {
  if (!pathname || pathname === '/') return 'home'
  return pathname.replace(/^\//, '').split('/')[0] || 'home'
}

export default function PortalPerfOverlay() {
  const pathname = usePathname() || ''
  const [metrics, setMetrics] = useState({
    fps: 0,
    frameMs: 0,
    cpuLoad: 0,
    longTasks: 0,
    usedMb: null,
    limitMb: null,
  })

  const label = useMemo(() => routeLabel(pathname), [pathname])

  useEffect(() => {
    if (!ENABLED || typeof window === 'undefined') return undefined
    const sampler = createPortalPerfSampler({ onUpdate: setMetrics })
    sampler.start()
    return () => sampler.stop()
  }, [])

  if (!ENABLED) return null

  const fpsColor = perfTone(metrics.fps, { good: 52, warn: 32 })
  const cpuColor = cpuTone(metrics.cpuLoad)
  const memColor = memoryTone(metrics.usedMb, metrics.limitMb)
  const memLine = Number.isFinite(metrics.usedMb)
    ? `${Math.round(metrics.usedMb)}/${Math.round(metrics.limitMb)}M`
    : 'MEM n/a'

  return (
    <div
      className="fixed z-[48] pointer-events-none select-none font-mono leading-tight left-1 top-[108px] max-sm:portrait:top-[200px] sm:top-[122px] lg:top-[144px]"
      aria-hidden="true"
    >
      <div
        className="rounded border border-cyan-900/35 bg-black/72 px-1.5 py-1 backdrop-blur-[2px]"
        style={{ fontSize: '9px', letterSpacing: '0.04em', minWidth: '74px' }}
      >
        <div className="text-slate-500 truncate max-w-[88px]">{label}</div>
        <div style={{ color: fpsColor }}>
          {metrics.fps} fps · {metrics.frameMs.toFixed(1)}ms
        </div>
        <div style={{ color: cpuColor }}>
          cpu ~{metrics.cpuLoad}%
          {metrics.longTasks > 0 ? ` · lt${metrics.longTasks}` : ''}
        </div>
        <div style={{ color: memColor }}>{memLine}</div>
      </div>
    </div>
  )
}
