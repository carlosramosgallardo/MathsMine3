'use client';

import { useEffect, useRef } from 'react';

export default function MM3PixelOrbSprite({
  src = '/mm3-token.png',
  fixedColor = '#000000', // persistent color from DB (overrides trend color) -> se grisea
  trendPct = 0,           // fallback: gris por tendencia (oscuro=negativo, claro=positivo)
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
  jitterFreqHz = 0.4      // jitter frequency
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

  // Color override (se almacenará ya en gris)
  const colorHexRef = useRef(fixedColor);

  // --- utils ---
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const isHex = (v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test((v || '').replace('#',''));
  const normHex = (v) => (v.startsWith('#') ? v : `#${v}`);

  const hexToRgb = (hex) => {
    const h = normHex(hex).slice(1);
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    return { r, g, b };
  };
  const rgbToHex = (r, g, b) => {
    const to2 = (n) => n.toString(16).padStart(2, '0');
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  };
  // Convierte cualquier hex a su equivalente en escala de grises, manteniendo luminosidad “percibida”
  const hexToGrayHex = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    const y = Math.round(clamp(0.2126*r + 0.7152*g + 0.0722*b, 0, 255)); // luminancia
    return rgbToHex(y, y, y);
  };

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

  // Color SOLO en escala de grises:
  // 1) Si hay fixedColor válido -> lo convertimos a gris.
  // 2) Si no, usamos trend (cap ±0.5) para mapear a luma HSL 0%–100% con S=0%.
  const resolveFillColor = () => {
    const overrideHex = colorHexRef.current;
    if (isHex(overrideHex)) {
      return hexToGrayHex(normHex(overrideHex)); // gris del override
    }

    const cap = 0.5;
    const p = clamp(trendPct || 0, -cap, cap);
    const t = (p / cap + 1) / 2; // [-cap..cap] -> [0..1]
    // luz: 28% (negativo fuerte) -> 82% (positivo fuerte)
    const lightness = Math.round(lerp(0, 100, t));
    return `hsl(0 0% ${lightness}%)`; // saturación 0% => gris
  };

  // keep override in sync (y convertirlo a gris en cuanto cambie)
  useEffect(() => {
    colorHexRef.current = isHex(fixedColor) ? hexToGrayHex(normHex(fixedColor)) : fixedColor;
  }, [fixedColor]);

  // allow instant external color updates (y forzamos gris)
  useEffect(() => {
    const onDirectColor = (ev) => {
      const hex = ev?.detail?.color;
      if (isHex(hex)) colorHexRef.current = hexToGrayHex(normHex(hex));
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

      const ctx2 = ctxRef.current;
      if (!ctx2) return;

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
      ctx2.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const fill = resolveFillColor();
      const mask = maskRef.current;
      if (mask) {
        const w = mask.width * grid;
        const hpx = mask.height * grid;
        const cx = posRef.current.x + jx;
        const cy = posRef.current.y + jy;
        const dx2 = Math.round(cx - w / 2);
        const dy2 = Math.round(cy - hpx / 2);

        ctx2.drawImage(mask, dx2, dy2, w, hpx);
        ctx2.globalCompositeOperation = 'source-atop';
        ctx2.fillStyle = fill;
        ctx2.fillRect(dx2, dy2, w, hpx);
        ctx2.globalCompositeOperation = 'source-over';
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
    jitterFreqHz
  ]);

  // compute anchor after layout settles
  useEffect(() => {
    const id = setTimeout(() => computeAnchor(), 200);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex }} aria-hidden="true">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
