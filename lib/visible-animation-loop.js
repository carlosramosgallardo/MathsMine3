/** A bounded animation loop that releases its RAF while the page is hidden. */
export function startVisibleAnimationLoop(frame, { fps = 30, onPause = () => {} } = {}) {
  let raf = 0
  let stopped = false
  let lastTime = null
  const interval = 1000 / fps
  const tick = (now) => {
    if (stopped || document.hidden) return
    raf = requestAnimationFrame(tick)
    if (lastTime !== null && now - lastTime < interval - 0.5) return
    // Preserve the remainder so 60 Hz displays can deliver an even 30 fps.
    lastTime = lastTime === null ? now : now - (Math.max(0, now - lastTime - interval) % interval)
    frame(now)
  }
  const visibility = () => {
    cancelAnimationFrame(raf)
    lastTime = null
    if (document.hidden) onPause()
    else if (!stopped) raf = requestAnimationFrame(tick)
  }
  document.addEventListener('visibilitychange', visibility)
  visibility()
  return () => {
    stopped = true
    cancelAnimationFrame(raf)
    document.removeEventListener('visibilitychange', visibility)
  }
}
