'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export default function Carousel({
  children,
  className = '',
  initialIndex = 0,
  gapClass = 'gap-6',
  autoSnapOnMount = true,
  rememberKey = 'main-carousel',
  showNamedTabs = true,
  tabLabels = ['Game', 'Leaderboard', 'MM3 Value'],
  rightSlot = null,
}) {
  const containerRef = useRef(null)
  const [index, setIndex] = useState(initialIndex)

  const slides = useMemo(() => {
    const arr = Array.isArray(children) ? children : [children]
    return arr.filter(Boolean)
  }, [children])

  // restore last slide
  useEffect(() => {
    if (!rememberKey) return
    const saved = Number(localStorage.getItem(rememberKey))
    if (Number.isFinite(saved) && saved >= 0 && saved < slides.length) setIndex(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rememberKey, slides.length])

  // observe visible slide
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const slideEls = Array.from(el.querySelectorAll('[data-slide="true"]'))
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) {
          const idx = Number(visible.target.getAttribute('data-index'))
          setIndex(idx)
          if (rememberKey) localStorage.setItem(rememberKey, String(idx))
        }
      },
      { root: el, threshold: [0.55] }
    )

    slideEls.forEach((s) => obs.observe(s))
    return () => obs.disconnect()
  }, [slides.length, rememberKey])

  const snapTo = (i, smooth = true) => {
    const el = containerRef.current
    if (!el) return
    const slide = el.querySelector(`[data-slide="true"][data-index="${i}"]`)
    if (slide) {
      el.scrollTo({
        left: slide.offsetLeft - el.offsetLeft,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  }

  const prev = () => snapTo(Math.max(0, index - 1))
  const next = () => snapTo(Math.min(slides.length - 1, index + 1))

  // auto-snap on mount
  useEffect(() => {
    if (!autoSnapOnMount) return
    const id = requestAnimationFrame(() => snapTo(index, false))
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSnapOnMount, slides.length])

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const safeLabels = tabLabels.slice(0, slides.length)

  return (
    <div className={`relative w-full ${className}`}>
      {/* centered header: tabs + rightSlot together */}
      {(showNamedTabs || rightSlot) && (
        <div
          className="mb-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3"
          aria-label="Sections header"
        >
          {showNamedTabs && safeLabels.length > 0 && (
            <div className="flex items-center gap-2" role="tablist" aria-label="Sections">
              {safeLabels.map((label, i) => (
                <button
                  key={label}
                  role="tab"
                  aria-selected={i === index}
                  aria-controls={`mm3-slide-${i}`}
                  onClick={() => snapTo(i)}
                  className={`text-xs sm:text-sm md:text-base rounded-xl px-3 py-1.5 border transition
                    ${i === index
                      ? 'border-cyan-300/80 bg-black/70'
                      : 'border-slate-500/40 bg-black/40 hover:bg-black/60'
                    }`}
                  title={label}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* rightSlot rendered inline so all 5 look centered as one group */}
          {rightSlot && (
            <div className="flex items-center gap-2">
              {rightSlot}
            </div>
          )}
        </div>
      )}

      {/* viewport */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
        aria-roledescription="carousel"
        aria-label="MM3 sections"
      >
        <div className={`flex ${gapClass} w-full`}>
          {slides.map((child, i) => (
            <section
              key={i}
              id={`mm3-slide-${i}`}
              data-slide="true"
              data-index={i}
              className="snap-center shrink-0 w-full"
              aria-roledescription="slide"
              aria-label={`Slide ${i + 1} of ${slides.length}`}
            >
              <div className="w-full max-w-3xl mx-auto px-4">{child}</div>
            </section>
          ))}
        </div>
      </div>

      {/* arrows */}
      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2">
        <button
          onClick={prev}
          className="pointer-events-auto rounded-xl px-3 py-2 border border-slate-500/50 bg-black/50 hover:bg-black/70"
          aria-label="Previous"
        >
          ←
        </button>
        <button
          onClick={next}
          className="pointer-events-auto rounded-xl px-3 py-2 border border-slate-500/50 bg-black/50 hover:bg-black/70"
          aria-label="Next"
        >
          →
        </button>
      </div>
    </div>
  )
}
