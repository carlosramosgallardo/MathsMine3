'use client';

import { useEffect, useRef } from 'react';

export default function MM3PixelOrbSprite({
  src = '/mm3-token.png',
  // No usamos fixedColor para pintar (se mantiene por compatibilidad):
  fixedColor = null,
  // NUEVO: valor MM3 en [-1, 1] => -1 negro, 1 blanco
  mm3 = 0,
  // compat: si no pasas mm3, usamos trendPct (lo clampamos a [-1,1])
  trendPct = 0,
  pixelCols = 28,
  grid = 6,
  zIndex = 20,
  startSelector,
  endSelector,
  durationMs = 14000,
  hoverRadiusPx = 120,
  driftIntervalMs = 2800,
  maxDriftSpeedPx = 120,
  jitterAmpPx = 10,
  jitterFreqHz = 0.4
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

  // guardamos el último color “anunciado” para poder emitirlo a otros componentes si quieres
  const lastGrayHexRef = useRef('#808080');

  // --- utils ---
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const normHex = (v) => (v?.startsWith?.('#') ? v : `#${v || ''}`);
  const isHex = (v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test((v || '').replace('#',''));
  const hexToRgb = (hex) => {
    const h = normHex(hex).slice(1);
    return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
  };
  const rgbToHex = (r,g,b) => {
    const to2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2,'0');
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  };
  const toGrayHex = (hex) => {
    if (!isHex(hex)) return '#808080';
    const { r,g,b } = hexToRgb(hex);
    const y = 0.2126*r + 0.7152*g + 0.0722*b;
    return rgbToHex(y,y,y);
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
    return { x: anchorRef.current.x + Math.cos(a) * r, y: anchorRef.current.y + Math.sin(a) * r };
  };

  // === Color SOLO según MM3 en escala de grises ===
  // - mm3 en [-1,1] → lightness 0..100
  // - si no viene mm3, usamos trendPct (asumido -1..1; se clamp).
  const resolveFillColor = () => {
    const mm3Scalar = Number.isFinite(mm3) ? clamp(mm3, -1, 1) : clamp(trendPct || 0, -1, 1);
    // map [-1..1] -> [0..1]
    const t = (mm3Scalar + 1) / 2;
    const lightness = Math.round(lerp(0, 100, t)); // 0 negro, 100 blanco
    const hsl = `hsl(0 0% ${lightness}%)`;
    // También guardamos una versión hex (para emitirla a otros componentes si se desea)
    const y = Math.round(255 * t);
    lastGrayHexRef.current = rgbToHex(y, y, y);
    return hsl;
  };

  // Si algún componente externo emite un color, lo convertimos a gris y lo
  // re-emitimos como gris para mantener coherencia (no pintamos con él aquí).
  useEffect(() => {
    const onDirectColor = (ev) => {
      const hex = ev?.detail?.color;
      if (isHex(hex)) {
        const gray = toGrayHex(normHex(hex));
        window.dispatchEvent(new CustomEvent('mm3-orb-color', { detail: { color: gray } }));
      }
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
      const dt = (now - last) / 1000;
      last = now;

      if (now - lastPickRef.current >= driftIntervalMs) {
        targetRef.current = randomTargetNearAnchor();
        lastPickRef.current = now;
      }

      const { x: px, y: py } = posRef.current;
      const { x: tx, y: ty } = targetRef.current;
      const dx = tx - px, dy = ty - py;
      const dist = Math.hypot(dx, dy);
      const maxStep = maxDriftSpeedPx * dt;
      if (dist > 0.0001) {
        const step = Math.min(dist, maxStep);
        posRef.current = { x: px + (dx / dist) * step, y: py + (dy / dist) * step };
      }

      phaseRef.current += dt * (Math.PI * 2 * jitterFreqHz);
      const jx = Math.sin(phaseRef.current) * jitterAmpPx;
      const jy = Math.cos(phaseRef.current * 0.9) * (jitterAmpPx * 0.6);

      const ctx2 = ctxRef.current;
      const mask = maskRef.current;
      if (!ctx2 || !mask) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      ctx2.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const w = mask.width * grid;
      const hpx = mask.height * grid;
      const cx = posRef.current.x + jx;
      const cy = posRef.current.y + jy;
      const dx2 = Math.round(cx - w / 2);
      const dy2 = Math.round(cy - hpx / 2);

      ctx2.drawImage(mask, dx2, dy2, w, hpx);
      ctx2.globalCompositeOperation = 'source-atop';
      ctx2.fillStyle = resolveFillColor(); // <- SOLO gris por MM3
      ctx2.fillRect(dx2, dy2, w, hpx);
      ctx2.globalCompositeOperation = 'source-over';

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
    mm3,
    trendPct,
    hoverRadiusPx,
    driftIntervalMs,
    maxDriftSpeedPx,
    jitterAmpPx,
    jitterFreqHz
  ]);

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
