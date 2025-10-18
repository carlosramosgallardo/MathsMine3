'use client';

import { useEffect, useRef } from 'react';

/**
 * MM3PixelOrbSprite
 * - Usa una imagen del logo y la renderiza en pixel-art (downscale + upscale NN).
 * - Se mueve del elemento startSelector al endSelector (centro a centro).
 * - Sin estela: limpia el canvas cada frame.
 * - Color “tinte” varía con tokenValue (aplicado por 'multiply' sobre el sprite).
 *
 * Props:
 *  - src: ruta del logo (PNG con fondo transparente recomendado)
 *  - tokenValue, minValue, maxValue: para normalizar el tinte (0..1)
 *  - pixelCols: cuántas “celdas” en ancho tras el downscale (20–36 da buen look)
 *  - grid: tamaño del pixel final en pantalla (5–7 muy retro)
 *  - zIndex: capa visual (0 detrás del contenido)
 *  - startSelector, endSelector: selectores CSS de los puntos de anclaje
 *  - durationMs: tiempo del viaje arriba→abajo (luego invierte)
 */
export default function MM3PixelOrbSprite({
  src = '/mm3-token.png',
  tokenValue = 0,
  minValue = 0,
  maxValue = 0.001,
  pixelCols = 28,   // cuantas “celdas” de ancho tendrá el sprite
  grid = 6,         // tamaño del pixel final en px
  zIndex = 0,
  startSelector,
  endSelector,
  durationMs = 7000
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const imgRef = useRef(null);

  const offSmallRef = useRef(null); // canvas reducido (pixelado)
  const offTintRef  = useRef(null); // canvas con tinte aplicado

  const tRef = useRef(0);   // progreso 0..1
  const dirRef = useRef(1); // 1 bajando, -1 subiendo
  const startRef = useRef({ x: 0, y: 0 });
  const endRef   = useRef({ x: 0, y: 0 });

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a,b,t)=>a+(b-a)*t;

  // Normaliza a 0..1
  const energy = () => clamp01((tokenValue - minValue) / Math.max(1e-12, (maxValue - minValue)));

  // Color del tinte (hue cian→neón con energía)
  const tintHsl = () => {
    const e = energy();
    const h = lerp(190, 215, e);
    const l = lerp(58, 78, e);
    return { h, s: 100, l, a: 1 };
  };

  const hslString = ({h,s,l,a}) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

  const computeAnchors = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerOf = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
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
    if (!s) s = { x: vw/2, y: Math.max(80, vh*0.18) };
    if (!e) e = { x: vw/2, y: vh - Math.max(80, vh*0.18) };
    startRef.current = s;
    endRef.current = e;
  };

  // Carga del logo
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      imgRef.current = img;
      prepareOffscreens(); // inicializa buffers en cuanto carga
    };
    return () => { imgRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Prepara/actualiza offscreen canvases (pixelado + tinte)
  const prepareOffscreens = () => {
    const img = imgRef.current;
    if (!img) return;

    // 1) calculamos alto proporcional para pixelCols
    const aspect = img.height / img.width;
    const smallW = Math.max(8, pixelCols);
    const smallH = Math.max(8, Math.round(smallW * aspect));

    // canvas reducido
    const small = document.createElement('canvas');
    small.width = smallW;
    small.height = smallH;
    const sctx = small.getContext('2d', { alpha: true });
    sctx.imageSmoothingEnabled = false;
    // dibuja imagen original → tamaño reducido
    sctx.clearRect(0,0,smallW,smallH);
    sctx.drawImage(img, 0, 0, smallW, smallH);

    // 2) aplica tinte multiplicando (conserva luces/sombras metálicas)
    const tint = document.createElement('canvas');
    tint.width = smallW;
    tint.height = smallH;
    const tctx = tint.getContext('2d', { alpha: true });
    tctx.imageSmoothingEnabled = false;
    // copia base
    tctx.clearRect(0,0,smallW,smallH);
    tctx.drawImage(small, 0, 0);
    // capa de color
    tctx.globalCompositeOperation = 'multiply';
    tctx.fillStyle = hslString(tintHsl());
    tctx.fillRect(0,0,smallW,smallH);
    // restaura para usos futuros
    tctx.globalCompositeOperation = 'destination-over';
    // fondo transparente (no ennegrece nada)
    // (no dibujamos nada más debajo)

    offSmallRef.current = small;
    offTintRef.current = tint;
  };

  // Recalcular tinte cuando cambie el valor del token
  useEffect(() => {
    prepareOffscreens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenValue, minValue, maxValue, pixelCols]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = false;

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      computeAnchors();
    };
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    const loop = (t) => {
      const dt = t - last;
      last = t;

      // progreso
      tRef.current += (dirRef.current * dt) / durationMs;
      if (tRef.current >= 1) { tRef.current = 1; dirRef.current = -1; }
      if (tRef.current <= 0) { tRef.current = 0; dirRef.current = 1; }

      // limpiar completo (SIN estela, SIN oscurecer)
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const s = startRef.current, e = endRef.current;
      const x = lerp(s.x, e.x, tRef.current);
      const y = lerp(s.y, e.y, tRef.current);

      // pinta el sprite pixelado con nearest-neighbor
      const tint = offTintRef.current;
      if (tint) {
        const w = tint.width * grid;   // escala a pixel gordo
        const h = tint.height * grid;
        ctx.drawImage(tint, Math.round(x - w/2), Math.round(y - h/2), w, h);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [grid, durationMs, startSelector, endSelector]);

  // anclajes tras un pequeño delay (por si los elementos tardan)
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
