'use client';

import { useEffect, useRef, useState } from 'react';

export default function MM3PixelOrbSprite({
  src = '/mm3-token.png',
  fixedColor = '#000000',
  trendPct = 0,
  pixelCols = 28,
  grid = 6,
  zIndex = 20,
  startSelector,
  endSelector,          // keep for API compatibility
  durationMs = 14000,   // keep for API compatibility
  hoverRadiusPx = 120,
  driftIntervalMs = 2800,
  maxDriftSpeedPx = 120,
  jitterAmpPx = 10,
  jitterFreqHz = 0.4,

  // click control (desde page.jsx)
  isClickable = false,
  onClickActive = () => {},
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const ctxRef = useRef(null);

  const imgRef = useRef(null);
  const maskRef = useRef(null);

  const anchorRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const lastPickRef = useRef(0);
  const phaseRef = useRef(Math.random() * Math.PI * 2);
  const colorHexRef = useRef(fixedColor);

  // rect actualizado del sprite para colocar el botón
  const [orbRect, setOrbRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // utils
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
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
    if (!s) s = { x: vw / 2, y: Math.max(80, vh * 0.18) };
    anchorRef.current = s;

    if (posRef.current.x === 0 && posRef.current.y === 0) {
      posRef.current = { x: s.x, y: s.y };
      targetRef.current = randomTargetNearAnchor();
      lastPickRef.current = performance.now();
    }
  };

  const randomTargetNearAnchor = () => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.7) * hoverRadiusPx;
    return {
      x: anchorRef.current.x + Math.cos(a) * r,
      y: anchorRef.current.y + Math.sin(a) * r,
    };
  };

  const resolveFillColor = () => {
    const overrideHex = colorHexRef.current;
    if (isHex(overrideHex)) return normHex(overrideHex);

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

  useEffect(() => {
    colorHexRef.current = fixedColor;
  }, [fixedColor]);

  useEffect(() => {
    const onDirectColor = (ev) => {
      const hex = ev?.detail?.color;
      if (isHex(hex)) colorHexRef.current = normHex(hex);
    };
    window.addEventListener('mm3-orb-color', onDirectColor);
    return () => window.removeEventListener('mm3-orb-color', onDirectColor);
  }, []);

  // cargar imagen -> máscara pixelada
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

  // canvas + animación hover
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
      const dt = dtMs / 1000;

      const ctx = ctxRef.current;
      if (!ctx) return;

      if (now - lastPickRef.current >= driftIntervalMs) {
        targetRef.current = randomTargetNearAnchor();
        lastPickRef.current = now;
      }

      const { x: px, y: py } = posRef.current;
      const { x: tx, y: ty } = targetRef.current;
      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.hypot(dx, dy);
      const maxStep = maxDriftSpeedPx * dt;
      if (dist > 0.0001) {
        const step = Math.min(dist, maxStep);
        posRef.current = { x: px + (dx / dist) * step, y: py + (dy / dist) * step };
      }

      phaseRef.current += dt * (Math.PI * 2 * jitterFreqHz);
      const jx = Math.sin(phaseRef.current) * jitterAmpPx;
      const jy = Math.cos(phaseRef.current * 0.9) * (jitterAmpPx * 0.6);

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

        // dibuja sprite + tinte
        ctx.drawImage(mask, dx2, dy2, w, hpx);
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = fill;
        ctx.fillRect(dx2, dy2, w, hpx);
        ctx.globalCompositeOperation = 'source-over';

        // publicar rect (CSS px) para el botón invisible
        setOrbRect({ x: dx2, y: dy2, w, h: hpx });

        // glow solo visual cuando está clicable
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
        setOrbRect({ x: 0, y: 0, w: 0, h: 0 });
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
    isClickable,
  ]);

  useEffect(() => {
    const id = setTimeout(() => computeAnchor(), 200);
    return () => clearTimeout(id);
  }, []);

  const handleClick = () => {
    if (isClickable && typeof onClickActive === 'function') onClickActive();
  };

  // ⚠️ El canvas no capta eventos; el botón sí, y solo existe cuando es clicable
  return (
    <div className="fixed inset-0" style={{ zIndex }}>
      <canvas ref={canvasRef} className="w-full h-full pointer-events-none" />
      {isClickable && orbRect.w > 0 && orbRect.h > 0 && (
        <button
          type="button"
          aria-label="Open a random math card"
          title="Open a random math card"
          onClick={handleClick}
          style={{
            position: 'absolute',
            left: `${orbRect.x}px`,
            top: `${orbRect.y}px`,
            width: `${orbRect.w}px`,
            height: `${orbRect.h}px`,
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
          }}
        />
      )}
    </div>
  );
}
