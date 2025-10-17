'use client';

import { useEffect, useRef } from 'react';

/**
 * MM3PixelOrb (versión “logo único” sin estela)
 *
 * Props:
 *  - tokenValue: número actual del token (para color)
 *  - minValue, maxValue: rango esperado para normalizar energía/color
 *  - grid: tamaño de celda (px) para el look 8-bit (5–7 suele ir bien)
 *  - sizeCells: radio del anillo en celdas (más pequeño = logo más pequeño)
 *  - zIndex: capa (ponlo 0 para fondo; tu <main> debe tener z-10 o mayor)
 *  - startSelector: CSS selector del logo superior (opcional)
 *  - endSelector: CSS selector del logo inferior (opcional)
 */
export default function MM3PixelOrb({
  tokenValue = 0,
  minValue = 0,
  maxValue = 0.001,
  grid = 6,
  sizeCells = 12,     // más pequeño que antes (antes ~22)
  zIndex = 0,
  startSelector,
  endSelector,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const tRef = useRef(0);       // progreso 0..1
  const dirRef = useRef(1);     // 1: bajando, -1: subiendo
  const startRef = useRef({ x: 0, y: 0 });
  const endRef   = useRef({ x: 0, y: 0 });
  const energyRef = useRef(0.3);  // 0..1
  const hueRef = useRef(190);     // base cyan

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a,b,t) => a + (b - a) * t;

  // Normaliza energía/tono por valor del token (no oscurece nada)
  const updateEnergy = (v) => {
    const e = clamp01((v - minValue) / Math.max(1e-12, (maxValue - minValue)));
    energyRef.current = lerp(energyRef.current, e, 0.2);
    // hue 190→215 (más brillante con más valor)
    hueRef.current = lerp(190, 215, energyRef.current);
  };

  // Busca posiciones de inicio/fin a partir de selectores (centro del elemento)
  const computeAnchors = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const getCenter = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    let start = null;
    let end = null;
    if (startSelector) {
      const el = document.querySelector(startSelector);
      if (el) start = getCenter(el);
    }
    if (endSelector) {
      const el = document.querySelector(endSelector);
      if (el) end = getCenter(el);
    }

    // Fallback: centro-arriba → centro-abajo (con margen)
    if (!start) start = { x: vw / 2, y: Math.max(80, vh * 0.18) };
    if (!end)   end   = { x: vw / 2, y: vh - Math.max(80, vh * 0.18) };

    startRef.current = start;
    endRef.current = end;
  };

  // Dibuja el logo MM3 en pixel-art (anillo + “M/Ζ” central)
  const drawMM3 = (ctx, cxPx, cyPx, gridPx, Rcells, colorFn) => {
    const R = Rcells;
    const ringInner = R - 2;      // anillo exterior
    const ringInner2 = R - 3.5;   // anillo interior fino

    // Círculo/anillo en píxeles
    for (let iy = -R; iy <= R; iy++) {
      for (let ix = -R; ix <= R; ix++) {
        const d = Math.hypot(ix, iy);
        const onOuter = d <= R && d >= R - 1.1;
        const onInner = d <= ringInner && d >= ringInner - 1.1;
        if (onOuter || onInner) {
          ctx.fillStyle = colorFn(0.95);
          ctx.fillRect(
            Math.floor((cxPx / gridPx + ix) * gridPx),
            Math.floor((cyPx / gridPx + iy) * gridPx),
            gridPx, gridPx
          );
        }
      }
    }

    // “M” con pata derecha quebrada (guiño al logo)
    const stroke = 2;                   // grosor
    const h = Math.floor(R * 0.9);      // alto útil
    const w = Math.floor(R * 0.9);      // ancho útil
    const topY = -Math.floor(h * 0.6);
    const baseY = Math.floor(h * 0.6);
    const leftX = -Math.floor(w * 0.55);
    const rightX = Math.floor(w * 0.55);

    const px = (x, y, a = 1) => {
      ctx.fillStyle = colorFn(a);
      ctx.fillRect(
        Math.floor((cxPx / gridPx + x) * gridPx),
        Math.floor((cyPx / gridPx + y) * gridPx),
        gridPx, gridPx
      );
    };

    // Barras verticales izquierda y derecha
    for (let y = topY; y <= baseY; y++) for (let s = 0; s < stroke; s++) px(leftX + s, y, 1);
    for (let y = topY; y <= baseY; y++) for (let s = 0; s < stroke; s++) px(rightX - s, y, 1);

    // Diagonales hacia centro (punta de la M)
    const diagLen = Math.max(6, Math.floor((rightX - leftX) * 0.45));
    for (let i = 0; i < diagLen; i++) {
      for (let s = 0; s < stroke; s++) {
        px(leftX + stroke + i, topY + i, 1);
        px(rightX - stroke - i, topY + i, 1);
      }
    }

    // Pata derecha “quebrada” tipo Ζ/2
    for (let i = 0; i < Math.floor(diagLen * 0.6); i++) px(rightX - i, Math.floor(topY * 0.05) + i, 0.95);
    for (let i = 0; i < Math.floor(diagLen * 0.45); i++) px(rightX - Math.floor(diagLen * 0.6) + i, baseY - i, 0.95);

    // Pequeños “vias” (puntos) como guiño PCB (muy sutiles)
    const vias = [
      { x: leftX - 2, y: topY + 2 }, { x: rightX + 2, y: topY + 4 },
      { x: leftX - 1, y: baseY - 3 }, { x: rightX + 1, y: baseY - 2 },
    ];
    vias.forEach(v => px(v.x, v.y, 0.75));
  };

  useEffect(() => {
    updateEnergy(tokenValue);
  }, [tokenValue]);

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
    const durationMs = 7000; // tiempo de viaje top→bottom

    const loop = (t) => {
      const dt = t - last;
      last = t;

      // actualizar progreso (sin easing para un movimiento limpio)
      tRef.current += (dirRef.current * dt) / durationMs;
      if (tRef.current >= 1) { tRef.current = 1; dirRef.current = -1; }
      if (tRef.current <= 0) { tRef.current = 0; dirRef.current = 1; }

      // limpiar completamente (sin estela, sin oscurecer nada)
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      // posición actual por lerp
      const s = startRef.current, e = endRef.current;
      const x = lerp(s.x, e.x, tRef.current);
      const y = lerp(s.y, e.y, tRef.current);

      const E = energyRef.current;
      const hue = hueRef.current;
      const colorFn = (a = 1) => `hsla(${hue}, 100%, ${lerp(60, 78, E)}%, ${a})`;

      // dibuja el logo
      drawMM3(ctx, x, y, grid, sizeCells, colorFn);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [grid, sizeCells, minValue, maxValue, startSelector, endSelector]);

  // Recalcula anclajes también al montar, tras un tick (por si los logos cargan tarde)
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
