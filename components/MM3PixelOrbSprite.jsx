'use client';

import { useEffect, useRef } from 'react';

export default function MM3PixelOrbSprite({
  src = '/mm3-token.png',
  tokenValue = 0,     // reservado por si quieres usarlo
  trendPct = 0,       // +0.12 = +12% semanal (más rojo), -0.08 = -8% (más verde)
  pixelCols = 28,
  grid = 6,
  zIndex = 20,
  startSelector,
  endSelector,
  durationMs = 7000
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const imgRef = useRef(null);
  const maskRef = useRef(null);

  const tRef = useRef(0);
  const dirRef = useRef(1);
  const startRef = useRef({ x: 0, y: 0 });
  const endRef   = useRef({ x: 0, y: 0 });

  // zig-zag
  const ampRef   = useRef(40);
  const freqRef  = useRef(1.5);
  const phaseRef = useRef(0);

  const lerp = (a,b,t)=>a+(b-a)*t;

  const hslStr = (h,s,l)=>`hsla(${h}, ${s}%, ${l}%, 1)`;

  const computeAnchors = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const centerOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; };
    let sEl=null, eEl=null;
    if (startSelector) { const el = document.querySelector(startSelector); if (el) sEl = centerOf(el); }
    if (endSelector)   { const el = document.querySelector(endSelector);   if (el) eEl = centerOf(el); }
    if (!sEl) sEl = { x: vw/2, y: Math.max(80, vh*0.18) };
    if (!eEl) eEl = { x: vw/2, y: vh - Math.max(80, vh*0.18) };
    startRef.current = sEl; endRef.current = eEl;
  };

  const reseedZigzag = () => {
    const vw = window.innerWidth;
    ampRef.current   = 20 + Math.random()*Math.min(80, vw*0.06);
    freqRef.current  = 1 + Math.random()*2.2;
    phaseRef.current = Math.random()*Math.PI*2;
  };

  // Carga PNG y crea máscara pixelada
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      imgRef.current = img;
      const aspect = img.height / img.width;
      const smallW = Math.max(8, pixelCols);
      const smallH = Math.max(8, Math.round(smallW * aspect));

      const small = document.createElement('canvas');
      small.width = smallW; small.height = smallH;
      const sctx = small.getContext('2d', { alpha: true });
      sctx.imageSmoothingEnabled = false;
      sctx.clearRect(0,0,smallW,smallH);
      sctx.drawImage(img, 0, 0, smallW, smallH);
      maskRef.current = small;
    };
    return () => { imgRef.current = null; maskRef.current = null; };
  }, [src, pixelCols]);

  // Canvas + animación
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = false;

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width  = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      computeAnchors();
    };
    resize();
    window.addEventListener('resize', resize);
    reseedZigzag();

    let last = performance.now();
    const loop = (now) => {
      const dt = now - last; last = now;

      tRef.current += (dirRef.current * dt) / durationMs;
      if (tRef.current >= 1) { tRef.current = 1; dirRef.current = -1; reseedZigzag(); }
      if (tRef.current <= 0) { tRef.current = 0; dirRef.current =  1; reseedZigzag(); }

      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      // posición con zig-zag
      const sAnchor = startRef.current, eAnchor = endRef.current;
      const tt = tRef.current;
      const xLin = sAnchor.x + (eAnchor.x - sAnchor.x)*tt;
      const yLin = sAnchor.y + (eAnchor.y - sAnchor.y)*tt;
      const x = xLin + Math.sin(tt * Math.PI * 2 * freqRef.current + phaseRef.current) * ampRef.current;
      const y = yLin;

      // ---- Color constante según tendencia semanal ----
      // tendencia positiva => más ROJO; negativa => más VERDE.
      const cap = 0.5;
      const p = Math.max(-cap, Math.min(cap, trendPct || 0)); // clamp
      let hue, sat, lig;
      if (p >= 0) {
        // ROJO (de salmón -> rojo intenso)
        const t = p / cap;      // 0..1
        hue = lerp(12, 0, t);   // 12→0
        sat = lerp(80, 95, t);  // 80→95
        lig = lerp(58, 56, t);  // 58→56
      } else {
        // VERDE (de lima suave -> verde profundo)
        const t = (-p) / cap;   // 0..1
        hue = lerp(120, 95, t); // 120→95
        sat = lerp(70, 95, t);  // 70→95
        lig = lerp(58, 60, t);  // 58→60
      }
      const fill = hslStr(hue, sat, lig);

      // dibuja máscara pixelada escalada y la colorea
      const mask = maskRef.current;
      if (mask) {
        const w = mask.width * grid;
        const hpx = mask.height * grid;
        const dx = Math.round(x - w/2);
        const dy = Math.round(y - hpx/2);

        ctx.drawImage(mask, dx, dy, w, hpx);        // usa alpha del PNG
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = fill;
        ctx.fillRect(dx, dy, w, hpx);               // color constante
        ctx.globalCompositeOperation = 'source-over';
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [grid, durationMs, startSelector, endSelector, trendPct]);

  // anclajes tras pequeño delay
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
