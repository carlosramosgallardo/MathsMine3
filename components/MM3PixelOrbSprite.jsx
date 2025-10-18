'use client';

import { useEffect, useRef } from 'react';

export default function MM3PixelOrbSprite({
  src = '/mm3-token.png',
  fixedColor = '#808080',     // ← pásame aquí el gris de BBDD (#000..#fff)
  pixelCols = 28,
  grid = 6,
  zIndex = 20,
  startSelector,
  hoverRadiusPx = 120,
  driftIntervalMs = 2800,
  maxDriftSpeedPx = 120,
  jitterAmpPx = 10,
  jitterFreqHz = 0.4
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);

  const anchorRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const lastPickRef = useRef(0);
  const phaseRef = useRef(Math.random() * Math.PI * 2);

  // utils
  const normHex = (v: string) => (v?.startsWith('#') ? v : `#${v || ''}`);
  const isHex = (v: any) =>
    typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test((v || '').replace('#', ''));

  const resolveFillColor = () =>
    isHex(fixedColor) ? normHex(fixedColor) : '#808080';

  const computeAnchor = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerOf = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    let s: { x: number; y: number } | null = null;
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

  // carga imagen y máscara pixelada
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
      const sctx = small.getContext('2d', { alpha: true })!;
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
    if (!ctx) return;
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
    const loop = (now: number) => {
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

      const m = maskRef.current;
      if (!m) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const w = m.width * grid;
      const hpx = m.height * grid;
      const cx = posRef.current.x + jx;
      const cy = posRef.current.y + jy;
      const dx2 = Math.round(cx - w / 2);
      const dy2 = Math.round(cy - hpx / 2);

      ctx.drawImage(m, dx2, dy2, w, hpx);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = resolveFillColor(); // ← pinta el gris de BBDD
      ctx.fillRect(dx2, dy2, w, hpx);
      ctx.globalCompositeOperation = 'source-over';

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      ctxRef.current = null;
    };
  }, [grid, hoverRadiusPx, driftIntervalMs, maxDriftSpeedPx, jitterAmpPx, jitterFreqHz, fixedColor]);

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
