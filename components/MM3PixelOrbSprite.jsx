'use client';

import { useEffect, useRef } from 'react';

/**
 * MM3PixelOrbSprite (v2)
 * - Dibuja el PNG en pixel-art (downscale + upscale NN), SIN fondo.
 * - Color:
 *    * Positivo: paleta cyan/verde que pulsa unos segundos.
 *    * Negativo: paleta rojo/naranja que pulsa unos segundos.
 *    * Sin evento reciente: vuelve a negro.
 * - Movimiento: arriba ↔ abajo con zig-zag suave y aleatorio por tramo.
 * - No bloquea clics (pointer-events: none).
 */
export default function MM3PixelOrbSprite({
  src = '/mm3-token.png',  // PNG con transparencia
  tokenValue = 0,          // no imprescindible para color (usamos eventos), lo dejamos por si lo quieres usar luego
  minValue = 0,
  maxValue = 0.001,
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

  // máscara (pixelada) del PNG; no generamos tintes offscreen
  const maskRef = useRef(null);

  // progreso y anclajes
  const tRef = useRef(0);
  const dirRef = useRef(1);
  const startRef = useRef({ x: 0, y: 0 });
  const endRef   = useRef({ x: 0, y: 0 });

  // zig-zag params por tramo
  const ampRef   = useRef(40);   // amplitud px
  const freqRef  = useRef(1.5);  // ondas por tramo
  const phaseRef = useRef(0);    // fase inicial

  // color state
  const modeRef = useRef('neutral');             // 'neutral' | 'pos' | 'neg'
  const pulseStartRef = useRef(0);               // ms
  const lastEventRef = useRef(0);
  const PULSE_DURATION = 4200;                   // ms (pulso visible)
  const DECAY_AFTER    = 5200;                   // ms (vuelve a negro)

  // paletas (HSL) – 2 tonos por modo para pulsar entre ellos
  const POS = [{h: 190, s:100, l:60}, {h: 160, s:95, l:66}];   // cyan→verdoso
  const NEG = [{h: 355, s:85, l:58}, {h: 25,  s:95, l:60}];   // rojo→naranja
  const NEU = {h:0, s:0, l:0};

  const clamp01 = (v)=>Math.max(0, Math.min(1, v));
  const lerp = (a,b,t)=>a+(b-a)*t;

  const hsl = (o)=>`hsla(${o.h}, ${o.s}%, ${o.l}%, 1)`;
  const mixHsl = (a,b,t)=>({h:lerp(a.h,b.h,t), s:lerp(a.s,b.s,t), l:lerp(a.l,b.l,t)});

  // anclajes (centro de selectores; fallback centro-arriba → centro-abajo)
  const computeAnchors = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const centerOf = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    };
    let s=null, e=null;
    if (startSelector) { const el = document.querySelector(startSelector); if (el) s = centerOf(el); }
    if (endSelector)   { const el = document.querySelector(endSelector);   if (el) e = centerOf(el); }
    if (!s) s = { x: vw/2, y: Math.max(80, vh*0.18) };
    if (!e) e = { x: vw/2, y: vh - Math.max(80, vh*0.18) };
    startRef.current = s; endRef.current = e;
  };

  // nueva “semilla” de zigzag en cada cambio de tramo (cuando toca tope)
  const reseedZigzag = () => {
    const vw = window.innerWidth;
    ampRef.current   = 20 + Math.random()*Math.min(80, vw*0.06); // 20–~80 px
    freqRef.current  = 1 + Math.random()*2.2;                    // 1–3.2 ondas
    phaseRef.current = Math.random()*Math.PI*2;
  };

  // carga y crea máscara pixelada
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
      // el PNG ya tiene alpha, así que sirve como máscara
      sctx.drawImage(img, 0, 0, smallW, smallH);

      maskRef.current = small;
    };
    return () => { imgRef.current = null; maskRef.current = null; };
  }, [src, pixelCols]);

  // escucha eventos del juego (correcto => cambia color según reward)
  useEffect(() => {
    const onCorrect = (e) => {
      const reward = Number(e?.detail?.reward ?? 0);
      lastEventRef.current = performance.now();
      modeRef.current = reward > 0 ? 'pos' : (reward < 0 ? 'neg' : 'neutral');
      pulseStartRef.current = performance.now();
    };
    window.addEventListener('mm3-correct', onCorrect);
    return () => window.removeEventListener('mm3-correct', onCorrect);
  }, []);

  // canvas & animación
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

      // progreso y re-seed de zigzag en cambios de tramo
      tRef.current += (dirRef.current * dt) / durationMs;
      if (tRef.current >= 1) { tRef.current = 1; dirRef.current = -1; reseedZigzag(); }
      if (tRef.current <= 0) { tRef.current = 0; dirRef.current =  1; reseedZigzag(); }

      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      // posición base lineal + zig-zag
      const s = startRef.current, e = endRef.current;
      const tt = tRef.current;
      const xLin = s.x + (e.x - s.x)*tt;
      const yLin = s.y + (e.y - s.y)*tt;
      const A = ampRef.current, F = freqRef.current, P = phaseRef.current;
      const zig = Math.sin(tt * Math.PI * 2 * F + P) * A;
      const x = xLin + zig;    // zigzag en X
      const y = yLin;

      // color según modo/pulso y decaimiento
      let color = NEU;
      const since = performance.now() - pulseStartRef.current;
      if (modeRef.current !== 'neutral' && since <= DECAY_AFTER) {
        const palettes = modeRef.current === 'pos' ? POS : NEG;
        const u = (Math.sin((since / 300) * Math.PI) + 1) / 2; // 0..1 senoidal
        color = mixHsl(palettes[0], palettes[1], u);
        // si ya pasó el PULSE_DURATION, empieza a decaer hacia negro
        if (since > PULSE_DURATION) {
          const k = clamp01((since - PULSE_DURATION) / (DECAY_AFTER - PULSE_DURATION));
          color = mixHsl(color, NEU, k);
        }
      }

      // dibuja máscara pixelada escalada
      const mask = maskRef.current;
      if (mask) {
        const w = mask.width * grid;
        const h = mask.height * grid;
        const dx = Math.round(x - w/2);
        const dy = Math.round(y - h/2);

        // 1) dibuja el PNG pixelado (con su alpha) – solo importa su alpha
        ctx.drawImage(mask, dx, dy, w, h);

        // 2) colorea SOLO donde hay esos píxeles (source-atop)
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = hsl(color);
        ctx.fillRect(dx, dy, w, h);
        ctx.globalCompositeOperation = 'source-over';
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [grid, durationMs, startSelector, endSelector]);

  // anclajes tras un pequeño delay
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
