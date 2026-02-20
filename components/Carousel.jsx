'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/* ===== Deterministic color from wallet (same formula as Page) ===== */
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const hslToHex = (h, s, l) => {
  h = ((h % 360) + 360) % 360;
  s = clamp01(s / 100);
  l = clamp01(l / 100);
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
};
const colorFromAddress = (addr = '') => {
  const s = String(addr).toLowerCase().replace(/^0x/, '');
  if (!s) return null; // null => usaremos el fallback default
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const h = hash % 360;
  return hslToHex(h, 70, 55);
};
const hexWithAlpha = (hex, alphaHex) => {
  const h = hex?.startsWith('#') ? hex.slice(1) : hex;
  return h && h.length === 6 ? `#${h}${alphaHex}` : hex;
};

const DEFAULT_ACCENT = '#22d3ee';

export default function Carousel({
  children,
  className = '',
  initialIndex = 0,
  gapClass = 'gap-6',
  autoSnapOnMount = true,
  rememberKey = 'main-carousel',
  showNamedTabs = true,
  tabLabels = ['Play', 'Leaderboard', 'MM3 Value'],
  rightSlot = null,
  statusSlot = null,

  // Si hay wallet conectada -> color por wallet; si no -> azul por defecto
  walletAddress = '',
}) {
  const containerRef = useRef(null);
  const [index, setIndex] = useState(initialIndex);

  const slides = useMemo(() => {
    const arr = Array.isArray(children) ? children : [children];
    return arr.filter(Boolean);
  }, [children]);

  const tabAccent = useMemo(() => {
    const byWallet = walletAddress ? colorFromAddress(walletAddress) : null;
    return byWallet || DEFAULT_ACCENT;
  }, [walletAddress]);

  const accentSoft = useMemo(() => hexWithAlpha(tabAccent, '55'), [tabAccent]);
  const accentText = useMemo(() => hexWithAlpha(tabAccent, 'cc'), [tabAccent]);

  // restore last slide
  useEffect(() => {
    if (!rememberKey) return;
    const saved = Number(localStorage.getItem(rememberKey));
    if (Number.isFinite(saved) && saved >= 0 && saved < slides.length) setIndex(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rememberKey, slides.length]);

  // observe visible slide
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const slideEls = Array.from(el.querySelectorAll('[data-slide="true"]'));
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = Number(visible.target.getAttribute('data-index'));
          setIndex(idx);
          if (rememberKey) localStorage.setItem(rememberKey, String(idx));
        }
      },
      { root: el, threshold: [0.55] }
    );
    slideEls.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [slides.length, rememberKey]);

  const snapTo = (i, smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    const slide = el.querySelector(`[data-slide="true"][data-index="${i}"]`);
    if (slide) {
      el.scrollTo({
        left: slide.offsetLeft - el.offsetLeft,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  const prev = () => snapTo(Math.max(0, index - 1));
  const next = () => snapTo(Math.min(slides.length - 1, index + 1));

  // auto-snap on mount
  useEffect(() => {
    if (!autoSnapOnMount) return;
    const id = requestAnimationFrame(() => snapTo(index, false));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSnapOnMount, slides.length]);

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const safeLabels = tabLabels.slice(0, slides.length);
  const renderStatus = (i) => (typeof statusSlot === 'function' ? statusSlot(i) : statusSlot);

  // styles
  const activeStyle = { borderColor: tabAccent, color: tabAccent, boxShadow: `0 0 16px ${accentSoft}` };
  const inactiveStyle = { borderColor: accentSoft, color: accentText };

  const leftDisabled = index === 0;
  const rightDisabled = index === slides.length - 1;
  const arrowBaseStyle = { borderColor: accentSoft, color: accentText, boxShadow: `0 0 12px ${accentSoft}` };
  const arrowDisabledStyle = { borderColor: hexWithAlpha(tabAccent, '33'), color: hexWithAlpha(tabAccent, '66'), opacity: 0.6, cursor: 'not-allowed', boxShadow: 'none' };

  return (
    <div className={`relative w-full ${className}`}>
      {(showNamedTabs || rightSlot) && (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3" aria-label="Sections header">
          {showNamedTabs && safeLabels.length > 0 && (
            <div className="flex items-center gap-2" role="tablist" aria-label="Sections">
              {safeLabels.map((label, i) => {
                const isActive = i === index;
                return (
                  <button
                    key={label}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`mm3-slide-${i}`}
                    onClick={() => snapTo(i)}
                    className="text-xs sm:text-sm md:text-base rounded-xl px-3 py-1.5 border transition
                               bg-black/50 hover:bg-black/60 focus:outline-none focus:ring-2"
                    title={label}
                    style={isActive ? activeStyle : inactiveStyle}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
        </div>
      )}

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
              <div className="w-full max-w-3xl mx-auto px-4">
                {statusSlot && <div className="mb-3">{renderStatus(i)}</div>}
                {child}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2">
        <button
          onClick={prev}
          aria-label="Previous"
          aria-disabled={leftDisabled}
          disabled={leftDisabled}
          className="pointer-events-auto rounded-xl px-3 py-2 border bg-black/50 hover:bg-black/70 focus:outline-none focus:ring-2 transition"
          style={leftDisabled ? arrowDisabledStyle : arrowBaseStyle}
        >
          ←
        </button>
        <button
          onClick={next}
          aria-label="Next"
          aria-disabled={rightDisabled}
          disabled={rightDisabled}
          className="pointer-events-auto rounded-xl px-3 py-2 border bg-black/50 hover:bg-black/70 focus:outline-none focus:ring-2 transition"
          style={rightDisabled ? arrowDisabledStyle : arrowBaseStyle}
        >
          →
        </button>
      </div>
    </div>
  );
}
