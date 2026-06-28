const TARGET_FRAME_MS = 1000 / 60

function readMemorySnapshot() {
  const mem = typeof performance !== 'undefined' ? performance.memory : null
  if (!mem) return { usedMb: null, limitMb: null, totalMb: null }
  return {
    usedMb: mem.usedJSHeapSize / 1048576,
    totalMb: mem.totalJSHeapSize / 1048576,
    limitMb: mem.jsHeapSizeLimit / 1048576,
  }
}

export function createPortalPerfSampler({ onUpdate, intervalMs = 600 } = {}) {
  let running = false
  let rafId = 0
  let frames = 0
  let frameMsSum = 0
  let lastFrameAt = 0
  let lastSampleAt = 0
  let longTaskCount = 0
  let longTaskObserver = null
  let sampleTimer = 0

  function onFrame(now) {
    if (!running) return
    if (lastFrameAt > 0) {
      frameMsSum += now - lastFrameAt
      frames += 1
    }
    lastFrameAt = now
    rafId = requestAnimationFrame(onFrame)
  }

  function emitSample() {
    const now = performance.now()
    const elapsed = Math.max(1, now - lastSampleAt)
    const avgFrameMs = frames > 0 ? frameMsSum / frames : 0
    const fps = frames > 0 ? (frames / elapsed) * 1000 : 0
    const cpuLoad = avgFrameMs > 0
      ? Math.min(150, Math.round((avgFrameMs / TARGET_FRAME_MS) * 100))
      : 0
    const memory = readMemorySnapshot()

    onUpdate?.({
      fps: Math.round(fps),
      frameMs: Math.round(avgFrameMs * 10) / 10,
      cpuLoad,
      longTasks: longTaskCount,
      ...memory,
      sampledAt: now,
    })

    frames = 0
    frameMsSum = 0
    longTaskCount = 0
    lastSampleAt = now
  }

  function scheduleSample() {
    if (!running) return
    sampleTimer = window.setTimeout(() => {
      emitSample()
      scheduleSample()
    }, intervalMs)
  }

  return {
    start() {
      if (running || typeof window === 'undefined') return
      running = true
      lastFrameAt = 0
      lastSampleAt = performance.now()
      rafId = requestAnimationFrame(onFrame)
      scheduleSample()

      if (typeof PerformanceObserver !== 'undefined') {
        try {
          longTaskObserver = new PerformanceObserver((list) => {
            longTaskCount += list.getEntries().length
          })
          longTaskObserver.observe({ type: 'longtask', buffered: true })
        } catch {
          longTaskObserver = null
        }
      }
    },
    stop() {
      running = false
      cancelAnimationFrame(rafId)
      window.clearTimeout(sampleTimer)
      longTaskObserver?.disconnect()
      longTaskObserver = null
    },
  }
}

export function perfTone(value, { good = 55, warn = 35 } = {}) {
  if (value >= good) return '#34d399'
  if (value >= warn) return '#fbbf24'
  return '#f87171'
}

export function cpuTone(loadPct) {
  if (loadPct <= 55) return '#34d399'
  if (loadPct <= 85) return '#fbbf24'
  return '#f87171'
}

export function memoryTone(usedMb, limitMb) {
  if (!Number.isFinite(usedMb) || !Number.isFinite(limitMb) || limitMb <= 0) return '#94a3b8'
  const ratio = usedMb / limitMb
  if (ratio <= 0.55) return '#34d399'
  if (ratio <= 0.78) return '#fbbf24'
  return '#f87171'
}
