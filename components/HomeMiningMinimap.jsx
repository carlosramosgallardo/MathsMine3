'use client';

import { useEffect, useRef } from 'react';
import { colorFromAddress } from '@/lib/wallet-colors';
import {
  MINING_PORTAL_NODES,
  MINING_VISUAL_BLOCK_POSITIONS,
  placeMiningVisualBlock,
  getBlockMapId,
} from '@/lib/mining-visual-layout';
import { CRYPTO_COLOSSEUM_BOUNDS, MINING_CHAIN_NODE_POSITION } from '@/lib/mining-world-layout';

const WORLD_SIZE = 56;

function drawMap(canvas, snapshot) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const pad = 12;
  const cell = Math.min((rect.width - pad * 2) / WORLD_SIZE, (rect.height - pad * 2) / WORLD_SIZE);
  const width = cell * WORLD_SIZE;
  const height = cell * WORLD_SIZE;
  const ox = (rect.width - width) / 2;
  const oy = (rect.height - height) / 2;

  ctx.fillStyle = 'rgba(1, 9, 19, .9)';
  ctx.fillRect(ox, oy, width, height);
  ctx.strokeStyle = 'rgba(34, 211, 238, .10)';
  ctx.lineWidth = 1;
  for (let index = 0; index <= WORLD_SIZE; index += 4) {
    const p = index * cell;
    ctx.beginPath(); ctx.moveTo(ox + p, oy); ctx.lineTo(ox + p, oy + height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, oy + p); ctx.lineTo(ox + width, oy + p); ctx.stroke();
  }

  ctx.fillStyle = 'rgba(34, 211, 238, .24)';
  for (const [blockHex, pos] of MINING_VISUAL_BLOCK_POSITIONS) {
    if ((pos.mapId || getBlockMapId(blockHex)) !== '1') continue;
    ctx.fillRect(
      ox + (pos.col + .5) * cell,
      oy + (pos.row + .5) * cell,
      Math.max(.7, cell * .32),
      Math.max(.7, cell * .32),
    );
  }

  const arena = CRYPTO_COLOSSEUM_BOUNDS;
  ctx.fillStyle = 'rgba(248, 113, 113, .055)';
  ctx.strokeStyle = 'rgba(248, 113, 113, .42)';
  ctx.fillRect(ox + arena.minCol * cell, oy + arena.minRow * cell,
    (arena.maxCol - arena.minCol + 1) * cell, (arena.maxRow - arena.minRow + 1) * cell);
  ctx.strokeRect(ox + arena.minCol * cell, oy + arena.minRow * cell,
    (arena.maxCol - arena.minCol + 1) * cell, (arena.maxRow - arena.minRow + 1) * cell);

  for (const [blockHex, wallet] of snapshot.mined || []) {
    const pos = placeMiningVisualBlock(blockHex);
    if (!pos || (pos.mapId || getBlockMapId(blockHex)) !== '1') continue;
    ctx.fillStyle = colorFromAddress(wallet);
    ctx.globalAlpha = .82;
    ctx.fillRect(ox + pos.col * cell, oy + pos.row * cell, Math.max(1.4, cell), Math.max(1.4, cell));
  }
  ctx.globalAlpha = 1;

  const markets = (snapshot.markets || [])
    .map((emoji, index) => {
      const blockHex = snapshot.marketHexes?.[index];
      const pos = blockHex ? placeMiningVisualBlock(blockHex) : null;
      if (!pos || (pos.mapId || getBlockMapId(blockHex)) !== '1') return null;
      return { row: pos.row, col: pos.col, emoji };
    })
    .filter(Boolean);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.max(7, cell * 3.1)}px sans-serif`;
  for (const { row, col, emoji } of markets) {
    if (emoji) ctx.fillText(emoji, ox + (col + .5) * cell, oy + (row + .5) * cell);
    else {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(ox + col * cell - 1, oy + row * cell - 1, Math.max(2.5, cell + 1), Math.max(2.5, cell + 1));
    }
  }

  for (const portal of MINING_PORTAL_NODES) {
    ctx.shadowColor = portal.color;
    ctx.shadowBlur = 5;
    ctx.font = `${Math.max(8, cell * 3.4)}px sans-serif`;
    ctx.fillText(portal.emoji, ox + (portal.col + .5) * cell, oy + (portal.row + .5) * cell);
  }
  ctx.shadowBlur = 0;

  for (const [wallet, row, col] of snapshot.players || []) {
    if (!Number.isFinite(Number(row)) || !Number.isFinite(Number(col))) continue;
    ctx.fillStyle = colorFromAddress(wallet);
    ctx.strokeStyle = '#ecfeff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ox + (Number(col) + .5) * cell, oy + (Number(row) + .5) * cell, Math.max(2.4, cell * .9), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  const node = MINING_CHAIN_NODE_POSITION;
  ctx.fillStyle = '#fff4a3';
  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 9;
  ctx.fillRect(ox + node.col * cell - 2, oy + node.row * cell - 2, Math.max(5, cell + 3), Math.max(5, cell + 3));
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(34, 211, 238, .48)';
  ctx.strokeRect(ox, oy, width, height);
}

export default function HomeMiningMinimap({ language = 'en' }) {
  const canvasRef = useRef(null);
  const snapshotRef = useRef({ mined: [], markets: [], players: [] });

  useEffect(() => {
    let alive = true;
    const canvas = canvasRef.current;
    const render = () => canvas && drawMap(canvas, snapshotRef.current);
    render();
    const observer = new ResizeObserver(render);
    if (canvas) observer.observe(canvas);
    const load = () => {
      if (document.hidden) return;
      const minute = Math.floor(Date.now() / 60_000);
      fetch(`/api/home-minimap?minute=${minute}`)
        .then((response) => response.ok ? response.json() : Promise.reject())
        .then((data) => {
          if (!alive || !data?.ok) return;
          snapshotRef.current = data;
          render();
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 60_000);
    document.addEventListener('visibilitychange', load);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="mm3-home-minimap">
      <canvas ref={canvasRef} aria-label={language === 'es' ? 'Minimapa del mundo Mining' : 'Mining world minimap'} />
    </div>
  );
}
