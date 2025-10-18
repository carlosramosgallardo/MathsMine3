'use client';

import { useEffect, useRef } from 'react';

export default function MM3PixelOrbSprite({
  src = '/mm3-token.png',
  fixedColor = '#000000', // persistent color from DB (overrides trend color)
  trendPct = 0,           // +0.12 => redder, -0.08 => greener
  pixelCols = 28,
  grid = 6,
  zIndex = 20,
  startSelector,
  endSelector,
  durationMs = 7000
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const ctxRef = useRef(null);

  const imgRef = useRef(null);      // original image
  const maskRef = useRef(null);     // downscaled (pixelated) alpha mask

  const tRef = useRef(0);
  const dirRef = useRef(1);
  const startRef = useRef({ x: 0, y: 0 });
  const endRef = useRef({ x: 0, y: 0 });

  // zig-zag
  const ampRef = useRef(40);
  const freqRef = useRef(1.5);
  const phaseRef = useRef(0);

  // runtime color override (e.g., from window 'mm3-orb-color' event)
  const colorHexRef = useRef(fixedColor);

  // --- utils ---
  const lerp = (a, b, t) => a + (b - a) * t;
  const isValidHex = (v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v.replace('#', ''));
  const normalizeHex = (v) => (v.startsWith('#') ? v : `#${v}`);

  const hslStr = (h, s, l) => `hsla(${h}, ${s}%, ${l}%, 1)`;

  const computeAnchors = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerOf = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    let s = null, e = null;
    if (startSelector) {
      const el = document.querySelector(startSelector);
      if (el) s = centerOf(el);
    }
    if (endSelector) {
      const el = document.querySelector(endSelector);
      if (el) e = centerOf(el);
    }
    if (!s) s = { x: vw / 2, y: Math.max(80, vh * 0.18) };
    if (!e) e = { x: vw / 2, y: vh - Math.max(80, vh * 0.18) };
    startRef.current = s;
    endRef.current = e;
  };

  const reseedZigzag = () => {
    const vw = window.innerWidth;
    ampRef.current = 20 + Math.random() * Math.min(80, vw * 0.06);
    freqRef.current = 1 + Math.random() * 2.2;
    phaseRef.current = Math.random() * Math.PI * 2;
  };

  const resolveFillColor = () => {
    // 1) explicit hex override (event or prop)
    const overrideHex = colorHexRef.current;
    if (isValidHex(overrideHex)) {
      return normalizeHex(overrideHex);
    }

    // 2) derive from trend percentage (green for negative, red for positive)
    const cap = 0.5; // clamp +/-50%
    const p = Math.max(-cap, Math.min(cap, trendPct || 0));
    let h, s, l;
    if (p >= 0) {
      // toward RED
      const t = p / cap;       // 0..1
      h = lerp(12, 0, t);      // 12→0
      s = lerp(80, 95, t);     // 80→95
      l = lerp(58, 56, t);     // 58→56
    } else {
      // toward GREEN
      const t = (-p) / cap;    // 0..1
      h = lerp(120, 95, t);    // 120→95
      s = lerp(70, 95, t);     // 70→95
      l = lerp(58, 60, t);     // 58→60
    }
    return hslStr(h, s, l);
  };

  // keep override color in sync with prop changes
  useEffect(() => {
    colorHexRef.current = fixedColor;
  }, [fixedColor]);

  // listen to external instant color updates: window.dispatchEvent(new CustomEvent('mm3-orb-color', { detail: { color: '#RRGGBB' } }))
  useEffect(() => {
    const onDirectColor = (ev) => {
      const hex = ev?.detail?.color;
      if (isValidHex(hex)) {
        colorHexRef.current = normalizeHex(hex);
      }
    };
    window.addEventListener('mm3-orb-color', onDirectColor);
    return () => window.removeEventListener('mm3-orb-color', onDirectColor);
  }, []);

  // load PNG and build pixelated mask
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

  // canvas + animation
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
      computeAnchors();
    };

    resize();
    window.addEventListener('resize', resize);
    reseedZigzag();

    let last = performance.now();
    const loop = (now) => {
      const dt = now - last;
      last = now;

      tRef.current += (dirRef.current * dt) / durationMs;
      if (tRef.current >= 1) {
        tRef.current = 1;
        dirRef.current = -1;
        reseedZigzag();
      }
      if (tRef.current <= 0) {
        tRef.current = 0;
        dirRef.current = 1;
        reseedZigzag();
      }

      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      // position with zig-zag
      const s = startRef.current;
      const e = endRef.current;
      const tt = tRef.current;
      const xLin = s.x + (e.x - s.x) * tt;
      const yLin = s.y + (e.y - s.y) * tt;
      const x =
        xLin + Math.sin(tt * Math.PI * 2 * freqRef.current + phaseRef.current) * ampRef.current;
      const y = yLin;

      // color (fixed hex overrides trend-based HSL)
      const fill = resolveFillColor();

      // draw pixelated mask and tint it
      const mask = maskRef.current;
      if (mask) {
        const w = mask.width * grid;
        const hpx = mask.height * grid;
        const dx = Math.round(x - w / 2);
        const dy = Math.round(y - hpx / 2);

        // draw the mask's alpha
        ctx.drawImage(mask, dx, dy, w, hpx);

        // color the drawn area
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = fill;
        ctx.fillRect(dx, dy, w, hpx);
        ctx.globalCompositeOperation = 'source-over';
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      ctxRef.current = null;
    };
  }, [grid, durationMs, startSelector, endSelector, trendPct]); // color changes are read from refs each frame

  // compute anchors after a short delay (for layout to settle)
  useEffect(() => {
    const id = setTimeout(() => computeAnchors(), 200);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex }} aria-hidden="true">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
