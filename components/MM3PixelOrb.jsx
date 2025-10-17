'use client';

import { useEffect, useRef } from 'react';

/**
 * MM3PixelOrb
 * - Un único logo pixelado (círculo + "M") que se mueve y rebota.
 * - Color/energía reacciona al valor del token (tokenValue).
 * - Explosión de píxeles al evento global 'mm3-correct' (detail.reward).
 *
 * Props:
 *  - tokenValue: number (valor actual del token)
 *  - minValue:   number (mínimo esperado para normalizar)
 *  - maxValue:   number (máximo esperado para normalizar)
 *  - grid:       number (tamaño de celda en px; estética 8-bit)
 *  - zIndex:     number (capa; 0 = fondo)
 */
export default function MM3PixelOrb({
  tokenValue = 0,
  minValue = 0,
  maxValue = 0.001,
  grid = 6,
  zIndex = 0,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Estado interno
  const orbRef = useRef({
    x: 200, y: 200, vx: 0.25, vy: 0.18, // posiciones/velocidades en px/ms
    size: 22, // radio en “celdas” (no px)
  });
  const energyRef = useRef(0.3); // 0..1
  const particlesRef = useRef([]);
  const hueBaseRef = useRef(190); // cian-azulado base

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a,b,t)=>a+(b-a)*t;

  // Normaliza energía por valor del token
  const setEnergyFromToken = (v) => {
    const e = clamp01((v - minValue) / Math.max(1e-12, (maxValue - minValue)));
    // easing suave para no pegar saltos
    energyRef.current = lerp(energyRef.current, e, 0.15);
    // hue base cambia levemente con la energía (190→190+25)
    hueBaseRef.current = lerp(190, 215, energyRef.current);
  };

  // Dibuja el orbe MM3 en el contexto a partir de un patrón pixelado
  // Patrón: anillo circular + "M" central pixelada (estética retro)
  const drawMM3 = (ctx, cx, cy, gridPx, sizeCells, fillStyle) => {
    const R = sizeCells;         // radio exterior en celdas
    const rRing = R - 2;         // grosor del anillo
    const inner = R - 5;         // radio interior para la "M"

    // 1) Anillo (círculo pixelado)
    for (let iy = -R; iy <= R; iy++) {
      for (let ix = -R; ix <= R; ix++) {
        const d = Math.sqrt(ix*ix + iy*iy);
        // píxel si está en el anillo [R-1..R] o [R-2..R-1] según aliasing
        if ((d <= R && d >= R-1.2) || (d <= rRing && d >= rRing-1.2)) {
          ctx.fillStyle = fillStyle(0.85);
          ctx.fillRect(
            Math.floor((cx + ix) * gridPx),
            Math.floor((cy + iy) * gridPx),
            gridPx, gridPx
          );
        }
      }
    }

    // 2) "M" pixelada (simétrica). Base en “inner” y trazos verticales/diagonales.
    const stroke = 2; // grosor en celdas
    const h = inner;  // altura hasta el borde interior
    const w = Math.floor(inner * 0.9);

    const drawVBar = (x0, y0, hCells) => {
      for (let y = 0; y < hCells; y++) {
        for (let s = 0; s < stroke; s++) {
          ctx.fillStyle = fillStyle(1.0);
          ctx.fillRect(Math.floor((cx + x0 + s) * gridPx), Math.floor((cy + y0 + y) * gridPx), gridPx, gridPx);
        }
      }
    };
    const drawDiag = (x0, y0, dx, dy, length) => {
      for (let i = 0; i < length; i++) {
        for (let s = 0; s < stroke; s++) {
          ctx.fillStyle = fillStyle(1.0);
          ctx.fillRect(Math.floor((cx + x0 + i*dx + (dx===0? s:0)) * gridPx), Math.floor((cy + y0 + i*dy + (dy===0? s:0)) * gridPx), gridPx, gridPx);
        }
      }
    };

    // Estructura de la M:
    // |\
    // | \
    // |  \
    // |  /
    // | /
    // |/
    const topY = -Math.floor(h * 0.6);
    const baseY = Math.floor(h * 0.6);
    const leftX = -Math.floor(w * 0.6);
    const rightX = Math.floor(w * 0.6);

    // Barras verticales izquierda/derecha
    drawVBar(leftX, topY, baseY - topY);
    drawVBar(rightX - stroke, topY, baseY - topY);

    // Diagonales hacia el centro (punta de la M)
    const diagLen = Math.max(6, Math.floor((rightX - leftX) * 0.45));
    drawDiag(leftX + stroke, topY, 1, 1, diagLen);
    drawDiag(rightX - stroke*2, topY, -1, 1, diagLen);

    // Añade una “pestaña” inferior tipo “3” sutil (marca MM3) con 3 bloques
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = fillStyle(0.95);
      ctx.fillRect(
        Math.floor((cx + rightX - stroke - i) * gridPx),
        Math.floor((cy + baseY - 2 - (i===1?1:0)) * gridPx),
        gridPx, gridPx
      );
    }
  };

  // Explosión
  const spawnBurst = (xPx, yPx, gridPx, power = 1) => {
    const arr = particlesRef.current;
    const n = 40 + Math.floor(60 * power);
    const hue = hueBaseRef.current;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.7 + Math.random() * 2.2) * (0.6 + power * 0.8);
      arr.push({
        x: xPx, y: yPx,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        maxLife: 500 + Math.random() * 400,
        hue,
      });
    }
  };

  // Evento externo: acierto
  useEffect(() => {
    const onCorrect = (e) => {
      const reward = Math.abs(e?.detail?.reward ?? 0);
      // potencia relativa al rango usado
      const power = clamp01(maxValue > 0 ? reward / maxValue : 0.2);
      const c = canvasRef.current;
      if (!c) return;
      const { x, y } = orbRef.current;
      spawnBurst(x, y, grid, Math.max(0.2, power));
    };
    window.addEventListener('mm3-correct', onCorrect);
    return () => window.removeEventListener('mm3-correct', onCorrect);
  }, [maxValue, grid]);

  // Reacción al valor del token
  useEffect(() => {
    setEnergyFromToken(tokenValue);
  }, [tokenValue]);

  // Animación
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = false;

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(48, t - last); // ms
      last = t;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // Fondo: negro con ligera persistencia para estela (muy sutil)
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, 0, w, h);

      // Actualiza energía → color/velocidad
      const E = energyRef.current;
      const gridPx = grid;
      const speedScale = 0.08 + E * 0.18; // px/ms
      const glow = 0.6 + E * 0.4;        // brillo relativo

      // Mover orbe
      const orb = orbRef.current;
      orb.x += orb.vx * (dt / (1 / speedScale));
      orb.y += orb.vy * (dt / (1 / speedScale));

      // Rebote en bordes respetando tamaño del orbe
      const pad = (orb.size + 1) * gridPx;
      if (orb.x < pad) { orb.x = pad; orb.vx *= -1; }
      if (orb.x > w - pad) { orb.x = w - pad; orb.vx *= -1; }
      if (orb.y < pad) { orb.y = pad; orb.vy *= -1; }
      if (orb.y > h - pad) { orb.y = h - pad; orb.vy *= -1; }

      // Función de color (HSL → rgba string)
      const hue = hueBaseRef.current;
      const fillStyle = (alpha = 1.0) => `hsla(${hue}, 100%, ${lerp(55, 75, E)}%, ${alpha * glow})`;

      // Dibuja el orbe MM3 (en coordenadas de “celdas”, centrado en x/gridPx)
      drawMM3(ctx, orb.x / gridPx, orb.y / gridPx, gridPx, orb.size, fillStyle);

      // Partículas
      particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife);
      for (const p of particlesRef.current) {
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // leve gravedad suave
        p.vy += 0.0006 * dt;

        const k = 1 - (p.life / p.maxLife);
        const s = Math.max(2, Math.round(gridPx * (0.7 + 0.8 * k)));
        ctx.fillStyle = `hsla(${p.hue}, 100%, ${lerp(45, 75, E)}%, ${Math.max(0, 0.2 + 0.8 * k)})`;
        ctx.fillRect(
          Math.floor(p.x / s) * s,
          Math.floor(p.y / s) * s,
          s, s
        );
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [grid, minValue, maxValue]);

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex }} aria-hidden="true">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
