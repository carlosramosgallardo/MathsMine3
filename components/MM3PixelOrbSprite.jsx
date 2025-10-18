'use client';

import { useEffect, useRef, useMemo } from 'react';

export default function MM3PixelOrbSprite({
  src = '/mm3-token.png',
  fixedColor = '#000000', // persistent color from DB (overrides trend color)
  trendPct = 0,           // fallback: green/red by trend when no fixedColor
  pixelCols = 28,
  grid = 6,
  zIndex = 20,
  startSelector,          // hover anchor (usually your top logo)
  endSelector,            // unused now, kept for API compatibility
  durationMs = 14000,     // unused for hover travel; kept for compatibility
  // Hover tuning:
  hoverRadiusPx = 120,    // max distance from anchor
  driftIntervalMs = 2800, // how often we pick a new drift target
  maxDriftSpeedPx = 120,  // max speed toward target (px/s)
  jitterAmpPx = 10,       // small sine jitter amplitude
  jitterFreqHz = 0.4,     // jitter frequency

  // --- NUEVO: click control ---
  isClickable = false,        // habilitado por la página solo tras acierto
  onClickActive = () => {},   // handler que navega a /learn-math
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const ctxRef = useRef(null);

  const imgRef = useRef(null);
  const maskRef = useRef(null);

  // Anchor near which we hover
  const anchorRef = useRef({ x: 0, y: 0 });

  // Hover position and target
  const posRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const lastPickRef = useRef(0);

  // Jitter phase
  const phaseRef = useRef(Math.random() * Math.PI * 2);

  // Color override
  const colorHexRef = useRef(fixedColor);

  // Último rectángulo dibujado (para hit-test)
  const drawRectRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // --- utils ---
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clamp01 = (x) => clamp(x, 0, 1);
  const isHex = (v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v.replace('#',''));
  const normHex = (v) => (v.startsWith('#') ? v : `#${v}`);
  const lerp = (a, b, t) => a + (b - a) * t;

  const hslStr = (h, s, l) => `hsla(${h}, ${s}%, ${l}%, 1)`;

  const computeAnchor = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerOf = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    let s = null;
    if (startSelector) {
      const el = document.querySelector(startSelector);
      if (el) s = centerOf(el);
    }
    if (!s) s = { x: vw / 2, y: Math.max(80, vh * 0.18) }; // top-ish fallback
    anchorRef.current = s;

    // If first time, initialize pos and target near anchor
    if (posRef.current.x === 0 && posRef.current.y === 0) {
      posRef.current = { x: s.x, y: s.y };
      targetRef.current = randomTargetNearAnchor();
      lastPickRef.current = performance.now();
    }
  };

  const randomTargetNearAnchor = () => {
    // Pick a polar offset within [0, hoverRadiusPx], bias slightly toward smaller radii
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.7) * hoverRadiusPx;
    const ax = anchorRef.current.x + Math.cos(a) * r;
    const ay = anchorRef.current.y + Math.sin(a) * r;
    return { x: ax, y: ay };
  };

  const resolveFillColor = () => {
    // 1) explicit fixedColor override
    const overrideHex = colorHexRef.current;
    if (isHex(overrideHex)) return normHex(overrideHex);

    // 2) trend-based fallback (green for negative, red for positive)
    const cap = 0.5;
    const p = Math.max(-cap, Math.min(cap, trendPct || 0));
    let h, s, l;
    if (p >= 0) {
      const t = p / cap;
      h = lerp(12, 0, t);
      s = lerp(80, 95, t);
      l = lerp(58, 56, t);
    } else {
      const t = (-p) / cap;
      h = lerp(120, 95, t);
      s = lerp(70, 95, t);
      l = lerp(58, 60, t);
    }
    return hslStr(h, s, l);
  };

  // keep override in sync
  useEffect(() => {
    colorHexRef.current = fixedColor;
  }, [fixedColor]);

  // allow instant external color updates
  useEffect(() => {
    const onDirectColor = (ev) => {
      const hex = ev?.detail?.color;
      if (isHex(hex)) colorHexRef.current = normHex(hex);
    };
    window.addEventListener('mm3-orb-color', onDirectColor);
    return () => window.removeEventListener('mm3-orb-color', onDirectColor);
  }, []);

  // load image and create pixelated mask
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      imgRef.current = img;

      const aspect = img.height / img.width || 1;
      const smallW = Math.max(8, pixelCols);
      const smallH = Math.max(8, Math.round(smallW * aspect));

      const small = document.createElement('canvas');
      small.width = smallW;
      small.height = smallH;
      const sctx = small.getContext('2d', { alpha: true });
      sctx.imageSmoothingEnabled = false;
      sctx.clearRect(0, 0, smallW, smallH);
      sctx.drawImage(img, 0, 0, smallW, smallH);
      maskRef.current = small;
    };
    return () => {
      imgRef.current = null;
      maskRef.current = null;
    };
  }, [src, pixelCols]);

  // canvas + hover animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = false;
    ctxRef.current = ctx;

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      computeAnchor();
    };

    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    const loop = (now) => {
      const dtMs = now - last;
      last = now;
      const dt = dtMs / 1000; // seconds

      const ctx = ctxRef.current;
      if (!ctx) return;

      // Periodically pick a new target near the anchor
      if (now - lastPickRef.current >= driftIntervalMs) {
        targetRef.current = randomTargetNearAnchor();
        lastPickRef.current = now;
      }

      // Smoothly move pos toward target, capped by maxDriftSpeedPx
      const { x: px, y: py } = posRef.current;
      const { x: tx, y: ty } = targetRef.current;
      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.hypot(dx, dy);
      const maxStep = maxDriftSpeedPx * dt;
      if (dist > 0.0001) {
        const step = Math.min(dist, maxStep);
        const nx = px + (dx / dist) * step;
        const ny = py + (dy / dist) * step;
        posRef.current = { x: nx, y: ny };
      }

      // Gentle jitter
      phaseRef.current += dt * (Math.PI * 2 * jitterFreqHz);
      const jx = Math.sin(phaseRef.current) * jitterAmpPx;
      const jy = Math.cos(phaseRef.current * 0.9) * (jitterAmpPx * 0.6);

      // Clear and draw
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const fill = resolveFillColor();
      const mask = maskRef.current;
      if (mask) {
        const w = mask.width * grid;
        const hpx = mask.height * grid;
        const cx = posRef.current.x + jx;
        const cy = posRef.current.y + jy;
        const dx2 = Math.round(cx - w / 2);
        const dy2 = Math.round(cy - hpx / 2);

        // guardar rect para hit-test
        drawRectRef.current = { x: dx2, y: dy2, w, h: hpx };

        // dibujar sprite + tinte
        ctx.drawImage(mask, dx2, dy2, w, hpx);
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = fill;
        ctx.fillRect(dx2, dy2, w, hpx);
        ctx.globalCompositeOperation = 'source-over';

        // Glow opcional cuando está clicable
        if (isClickable) {
          ctx.save();
          ctx.shadowBlur = 18;
          ctx.shadowColor = 'rgba(255,255,255,0.25)';
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(dx2 - 2, dy2 - 2, w + 4, hpx + 4);
          ctx.restore();
        }
      } else {
        // si aún no hay máscara, no hay área clicable
        drawRectRef.current = { x: 0, y: 0, w: 0, h: 0 };
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      ctxRef.current = null;
    };
  }, [
    grid,
    trendPct,
    hoverRadiusPx,
    driftIntervalMs,
    maxDriftSpeedPx,
    jitterAmpPx,
    jitterFreqHz,
    isClickable, // para que el glow responda en caliente
  ]);

  // compute anchor after layout settles
  useEffect(() => {
    const id = setTimeout(() => computeAnchor(), 200);
    return () => clearTimeout(id);
  }, []);

  // --- click handling con hit-test ---
  const handleClick = (e) => {
    if (!isClickable) return;
    const rect = (canvasRef.current || {}).getBoundingClientRect?.();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x, y, w, h } = drawRectRef.current || {};
    if (w > 0 && h > 0) {
      const inside = mx >= x && mx <= x + w && my >= y && my <= y + h;
      if (inside && typeof onClickActive === 'function') {
        onClickActive();
      }
    }
  };

  const wrapperClass = useMemo(
    () =>
      [
        'fixed inset-0',
        isClickable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none cursor-default',
      ].join(' '),
    [isClickable]
  );

  return (
    <div
      className={wrapperClass}
      style={{ zIndex }}
      aria-hidden={!isClickable ? 'true' : 'false'}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
