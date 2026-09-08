/** Coalesce render requests without running a permanent animation loop. */
export function createFrameInvalidator(render, getFps = () => 30) {
  let pending = false
  let disposed = false
  let raf = null
  let lastFrame = -Infinity
  const schedule = () => {
    if (!disposed && pending && raf === null && !document.hidden) {
      raf = requestAnimationFrame(flush)
    }
  }
  const flush = (now) => {
    raf = null
    if (disposed || document.hidden) return
    if (now - lastFrame < 1000 / getFps() - 0.5) {
      schedule()
      return
    }
    pending = false
    lastFrame = now
    render()
  }
  const request = () => {
    pending = true
    schedule()
  }
  const visibility = () => {
    if (raf !== null) cancelAnimationFrame(raf)
    raf = null
    lastFrame = -Infinity
    if (!document.hidden) request()
  }
  document.addEventListener('visibilitychange', visibility)
  return {
    request,
    dispose() {
      disposed = true
      if (raf !== null) cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', visibility)
    },
  }
}
