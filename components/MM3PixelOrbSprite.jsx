'use client';

import { useEffect, useRef } from 'react';

export default function MM3PixelOrbSprite({
  src = '/mm3-token.png',
  fixedColor = '#808080',   // exact persistent color from DB
  pixelCols = 28,
  grid = 6,
  zIndex = 20,

  // Anchors & bounds
  startSelector,                   // usually your top logo
  boundarySelector = 'header, nav, [data-orb-boundary]',

  // Legacy/compat
  endSelector,
  durationMs = 14000,

  // Drift tuning
  hoverRadiusPx = 120,
  driftIntervalMs = 2800,
  maxDriftSpeedPx = 120,
  jitterAmpPx = 10,
  jitterFreqHz = 0.4,

  // Safety margins
  marginPx = 8
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const ctxRef = useRef(null);

  const imgRef = useRef(null);
  const maskRef = useRef(null);

  // Motion state
  const anchorRef = useRef({ x: 0, y: 0 });
  const boundsRef = useRef({ left: 0, top: 0, right: 0, bottom: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const lastPickRef = useRef(0);
  const phaseRef = useRef(Math.random() * Math.PI * 2);

  // Utils
  const normHex = (v) => (v?.startsWith?.('#') ? v : `#${v || ''}`);
  const isHex = (v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test((v || '').replace('#', ''));
  const resolveFillColor = () => (isHex(fixedColor) ? normHex(fixedColor) : '#808080');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const findCenter = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const computeBoundsAndAnchor = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Find logo (startSelector)
    let logoCenter = null;
    if (startSelector) {
      const el = document.querySelector(startSelector);
      if (el) logoCenter = findCenter(el);
    }
    if (!logoCenter) logoCenter = { x: vw / 2, y: Math.max(80, vh * 0.18) };

    // Find boundary (header/nav) to prevent going below menu
    let boundaryRect = null;
    const boundaryEl = document.querySelector(boundarySelector);
    if (boundaryEl) boundaryRect = boundaryEl.getBoundingClientRect();

    // If header not found, assume a shallow cap (~25% vh or 160px)
    const bottomCap = boundaryRect
      ? Math.round(boundaryRect.bottom)
      : Math.round(Math.min(vh * 0.25, 160));

    // Allowed rectangle (center-based; further adjusted by sprite size while drawing)
    boundsRef.current = {
      left: marginPx,
      right: vw - marginPx,
      top: marginPx,
      bottom: Math.max(marginPx + 1, bottomCap - marginPx), // never below the menu
    };

    // Blend anchor between logo and header (if any), so it floats "between" them
    let blended = { ...logoCenter };
    if (boundaryRect) {
      const navCenter = { x: boundaryRect.left + boundaryRect.width / 2, y: boundaryRect.top + boundaryRect.height / 2 };
      const wLogo = 0.6, wNav = 0.4;
      blended = { x: wLogo * logoCenter.x + wNav * navCenter.x, y: wLogo * logoCenter.y + wNav * navCenter.y };
    }
    anchorRef.current = blended;

    // First placement
    if (posRef.current.x === 0 && posRef.current.y === 0) {
      posRef.current = { x: blended.x, y: blended.y };
      targetRef.current = randomTargetNearAnchor();
      lastPickRef.current = performance.now();
    }
  };

  const clampCenterToBounds = (cx, cy, spriteW, spriteH) => {
    // Ensure the whole sprite remains visible and never goes below the cap
    const halfW = spriteW / 2;
    const halfH = spriteH / 2;
    const { left, right, top, bottom } = boundsRef.current;

    const minX = left + halfW;
    const maxX = right - halfW;
    const minY = top + halfH;
    const maxY = bottom - halfH;

    return {
      x: clamp(cx, minX, maxX),
      y: clamp(cy, minY, maxY),
    };
  };

  const randomTargetNearAnchor = () => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.7) * hoverRadiusPx; // biased toward close range
    const cand = {
      x: anchorRef.current.x + Math.cos(a) * r,
      y: anchorRef.current.y + Math.sin(a) * r,
    };

    // Clamp candidate to bounds (approximate with a nominal sprite size; refined on draw)
    const approxW = (maskRef.current?.width || pixelCols) * grid;
    const approxH = (maskRef.current?.height || pixelCols) * grid;
    return clampCenterToBounds(cand.x, cand.y, approxW, approxH);
  };

  // Load image & build pixel mask
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
      // Recompute bounds/anchor with the new mask available
      computeBoundsAndAnchor();
    };
    return () => {
      imgRef.current = null;
      maskRef.current = null;
    };
  }, [src, pixelCols, grid]);

  // Canvas + animation
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
      computeBoundsAndAnchor();
    };

    const onScroll = () => {
      // For sticky headers: recompute anchor/bounds in case the header moved
      computeBoundsAndAnchor();
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });

    let last = performance.now();
    const loop = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      // Periodically pick new target within bounds near anchor
      if (now - lastPickRef.current >= driftIntervalMs) {
        targetRef.current = randomTargetNearAnchor();
        lastPickRef.current = now;
      }

      // Move toward target with capped speed
      const { x: px, y: py } = posRef.current;
      const { x: tx, y: ty } = targetRef.current;
      const dx = tx - px, dy = ty - py;
      const dist = Math.hypot(dx, dy);
      const maxStep = maxDriftSpeedPx * dt;
      if (dist > 1e-4) {
        const step = Math.min(dist, maxStep);
        posRef.current = { x: px + (dx / dist) * step, y: py + (dy / dist) * step };
      }

      // Jitter
      phaseRef.current += dt * (Math.PI * 2 * jitterFreqHz);
      const jx = Math.sin(phaseRef.current) * jitterAmpPx;
      const jy = Math.cos(phaseRef.current * 0.9) * (jitterAmpPx * 0.6);

      const m = maskRef.current;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      if (!m) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const w = m.width * grid;
      const h = m.height * grid;

      // Clamp center so the sprite stays fully visible and above the menu
      const clampedCenter = clampCenterToBounds(posRef.current.x + jx, posRef.current.y + jy, w, h);

      const dx2 = Math.round(clampedCenter.x - w / 2);
      const dy2 = Math.round(clampedCenter.y - h / 2);

      // Draw + exact DB color fill
      ctx.drawImage(m, dx2, dy2, w, h);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = resolveFillColor();
      ctx.fillRect(dx2, dy2, w, h);
      ctx.globalCompositeOperation = 'source-over';

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      ctxRef.current = null;
    };
  }, [
    grid,
    fixedColor,
    hoverRadiusPx,
    driftIntervalMs,
    maxDriftSpeedPx,
    jitterAmpPx,
    jitterFreqHz,
    boundarySelector,
    marginPx
  ]);

  // Initial layout pass
  useEffect(() => {
    const id = setTimeout(() => computeBoundsAndAnchor(), 200);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex }} aria-hidden="true">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
