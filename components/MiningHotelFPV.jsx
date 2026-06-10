'use client'

import { useEffect, useRef, useCallback } from 'react'
import { colorFromAddress } from '@/lib/wallet-colors'
import { MM3_BLOCK_GRID_ROWS, MM3_BLOCK_GRID_COLS, gridToBlockHex } from '@/lib/mm3-block-chain'

const ROWS = MM3_BLOCK_GRID_ROWS
const COLS = MM3_BLOCK_GRID_COLS
const C = '#22d3ee'

// ── World scale ───────────────────────────────────────────────────────────────
// Each grid cell = CELL_SIZE walking units. MOVE_SPD 0.16 world-units/frame
// at 60fps → ~2.5s to cross a cell (CELL_SIZE/0.16 = 25 frames ≈ 0.4s/room).
const CELL_SIZE = 4
const WORLD_W   = COLS * CELL_SIZE   // 112
const WORLD_H   = ROWS * CELL_SIZE   // 112

// ── Renderer constants ────────────────────────────────────────────────────────
const STRIP_W  = 3
const FOV      = Math.PI / 2
// PROJ_DIST in grid-cell units. With CELL_SIZE=4, a wall at room-center
// (perpDist=0.5 grid units) gives wallH = H*0.65/0.5 ≈ 1.3H (fills screen).
const PROJ_DIST = 0.65
const MOVE_SPD  = 0.16   // world units per frame
const TURN_SPD  = 0.038

// Doorways: the center DOOR_FRAC fraction of each cell-boundary wall is
// transparent (passage between rooms). Solid portions form the "pillars".
const DOOR_FRAC = 0.45

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const c = (hex || '#0a1525').replace('#', '').padStart(6, '0')
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)]
}

function wallRgb(cell, dist, side) {
  let [r, g, b] = cell?.owner
    ? hexToRgb(cell.color)
    : cell?.isMarket ? hexToRgb(cell.color || C) : [10, 18, 36]
  // side shading + depth fog (dist in grid-cell units)
  const f = (side === 1 ? 0.68 : 1.0) * Math.max(0.06, 1 - dist * 0.10)
  return [Math.round(r*f), Math.round(g*f), Math.round(b*f)]
}

// World position → grid cell indices
function worldToGrid(wx, wy) {
  return { row: Math.floor(wy / CELL_SIZE), col: Math.floor(wx / CELL_SIZE) }
}

// ── DDA raycaster with doorways ───────────────────────────────────────────────
// Operates in fractional grid-cell space (world ÷ CELL_SIZE).
// At each cell boundary the ray checks whether the hit-point falls in the
// center DOOR_FRAC of the wall edge (door = transparent) or in the outer
// sections (solid wall pillar). Solid hits stop the DDA and return the wall.
function castRay(wx, wy, angle, cellMap) {
  const px = wx / CELL_SIZE   // fractional grid-cell X
  const py = wy / CELL_SIZE   // fractional grid-cell Y
  const dx = Math.cos(angle), dy = Math.sin(angle)
  let mx = Math.floor(px), my = Math.floor(py)
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1
  const ddx = Math.abs(dx) < 1e-7 ? 1e30 : Math.abs(1 / dx)
  const ddy = Math.abs(dy) < 1e-7 ? 1e30 : Math.abs(1 / dy)
  let sdx = (dx < 0 ? px - mx : mx + 1 - px) * ddx
  let sdy = (dy < 0 ? py - my : my + 1 - py) * ddy
  let side = 0, perpDist = 0

  const MAX_STEPS = (ROWS + COLS) * 2
  for (let step = 0; step < MAX_STEPS; step++) {
    if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; perpDist = sdx - ddx }
    else           { sdy += ddy; my += sy; side = 1; perpDist = sdy - ddy }
    perpDist = Math.max(0.05, perpDist)

    // World border → solid boundary
    if (mx < 0 || mx >= COLS || my < 0 || my >= ROWS) {
      return { perpDist, cell: null, side }
    }

    // Hit position along the wall (fractional within the cell, 0..1).
    // For side=0 (vertical X-boundary): hitY = py + perpDist * dy
    // For side=1 (horizontal Y-boundary): hitX = px + perpDist * dx
    const hitFrac = ((side === 0
      ? py + perpDist * dy
      : px + perpDist * dx) % 1.0 + 1.0) % 1.0

    const lo = (1 - DOOR_FRAC) / 2   // 0.275 — start of door opening
    const hi = (1 + DOOR_FRAC) / 2   // 0.725 — end of door opening

    if (hitFrac < lo || hitFrac > hi) {
      // Solid wall pillar — stop here
      return { perpDist, cell: cellMap.get(`${my},${mx}`) || null, side }
    }
    // Door opening — ray continues into the next room
  }

  return { perpDist: ROWS + COLS, cell: null, side: 0 }
}

// ── Minimap ───────────────────────────────────────────────────────────────────
function drawMinimap(ctx, gridRow, gridCol, angle, cellMap, presenceMap, myWallet, W, H) {
  const SZ = Math.min(100, W * 0.16)
  const CS = SZ / ROWS
  const MX = W - SZ - 10, MY = H - SZ - 10

  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.fillRect(MX-1, MY-1, SZ+2, SZ+2)

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = cellMap.get(`${r},${c}`)
      ctx.fillStyle = cell?.owner ? cell.color+'99' : cell?.isMarket ? C+'44' : '#0a1a2a'
      ctx.fillRect(MX + c*CS, MY + r*CS, Math.ceil(CS), Math.ceil(CS))
    }
  }

  // View cone from current cell center
  const pvx = MX + gridCol*CS + CS/2
  const pvy = MY + gridRow*CS + CS/2
  const cl  = SZ * 0.28
  ctx.strokeStyle = C+'cc'; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pvx, pvy); ctx.lineTo(pvx + Math.cos(angle - FOV/2)*cl, pvy + Math.sin(angle - FOV/2)*cl)
  ctx.moveTo(pvx, pvy); ctx.lineTo(pvx + Math.cos(angle + FOV/2)*cl, pvy + Math.sin(angle + FOV/2)*cl)
  ctx.stroke()

  // Presence dots
  for (const [w, pres] of Object.entries(presenceMap || {})) {
    if (pres.row == null) continue
    const isMe = w.toLowerCase() === (myWallet || '').toLowerCase()
    ctx.fillStyle = isMe ? C : colorFromAddress(w)
    ctx.beginPath()
    ctx.arc(MX+(pres.col??0)*CS+CS/2, MY+(pres.row??0)*CS+CS/2, isMe ? CS*1.5 : CS*0.9, 0, Math.PI*2)
    ctx.fill()
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
// mode: 'fpv' — first person | 'tpv' — third person (camera 1.5 cells back)
export default function MiningHotelFPV({
  cellMap, presenceMap, myWallet, myColor,
  initRow, initCol, onPositionChange, es, mode = 'tpv',
}) {
  const canvasRef    = useRef(null)
  const containerRef = useRef(null)
  const keysRef      = useRef({ w:false, s:false, a:false, d:false, q:false, e:false })
  // Player position stored in WORLD units (0..WORLD_W, 0..WORLD_H)
  const playerRef    = useRef({
    x: ((initCol ?? 14) + 0.5) * CELL_SIZE,
    y: ((initRow ?? 14) + 0.5) * CELL_SIZE,
    angle: 0,
  })
  const animRef     = useRef(null)
  const renderRef   = useRef(null)
  const lastCellRef = useRef({ row: initRow ?? 14, col: initCol ?? 14 })

  useEffect(() => {
    playerRef.current.x = ((initCol ?? 14) + 0.5) * CELL_SIZE
    playerRef.current.y = ((initRow ?? 14) + 0.5) * CELL_SIZE
  }, [initRow, initCol])

  // ── Render ──────────────────────────────────────────────────────────────────
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    if (!W || !H) return

    const { x: px, y: py, angle } = playerRef.current
    const isTPV = mode === 'tpv'

    // TPV: camera pulled 1.5 grid-cells back from the player (in world units)
    const CAM_BACK_W = isTPV ? 1.5 * CELL_SIZE : 0
    const camX = px - Math.cos(angle) * CAM_BACK_W
    const camY = py - Math.sin(angle) * CAM_BACK_W

    // Horizon raised in TPV for elevated-camera perspective
    const horizon = H * (isTPV ? 0.38 : 0.5)
    const strips  = Math.ceil(W / STRIP_W)

    // Ceiling
    const cg = ctx.createLinearGradient(0, 0, 0, horizon)
    cg.addColorStop(0, '#020307'); cg.addColorStop(1, '#06091c')
    ctx.fillStyle = cg; ctx.fillRect(0, 0, W, horizon)

    // Floor with subtle perspective lines
    const fg = ctx.createLinearGradient(0, horizon, 0, H)
    fg.addColorStop(0, '#08101e'); fg.addColorStop(1, '#030609')
    ctx.fillStyle = fg; ctx.fillRect(0, horizon, W, H - horizon)
    const lineStep = Math.max(2, Math.round((H - horizon) / 10))
    for (let fy = Math.round(horizon); fy < H; fy += lineStep) {
      ctx.fillStyle = 'rgba(34,211,238,0.03)'
      ctx.fillRect(0, fy, W, 1)
    }

    // Wall columns
    for (let col = 0; col < strips; col++) {
      const rayAngle = angle - FOV/2 + (col + 0.5) * FOV / strips
      const { perpDist, cell, side } = castRay(camX, camY, rayAngle, cellMap)
      const dist  = perpDist * Math.cos(rayAngle - angle)  // fisheye fix
      const wallH = Math.min(H * 1.8, (H * PROJ_DIST) / Math.max(0.01, dist))
      const wTop  = Math.round(horizon - wallH / 2)
      const [r,g,b] = wallRgb(cell, dist, side)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(col * STRIP_W, wTop, STRIP_W, wallH)
      // CRT scanlines on wall
      ctx.fillStyle = 'rgba(0,0,0,0.14)'
      for (let sy = wTop; sy < wTop + wallH; sy += 4) ctx.fillRect(col * STRIP_W, sy, STRIP_W, 1)
    }

    // Emoji on the first solid wall the PLAYER faces (cast from player, not camera)
    const { cell: fwdCell, perpDist: fwdDist } = castRay(px, py, angle, cellMap)
    if (fwdCell?.emoji) {
      const sz = Math.max(14, Math.round(H * PROJ_DIST / Math.max(0.05, fwdDist) * (isTPV ? 0.4 : 0.55)))
      ctx.font = `${sz}px serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.globalAlpha = Math.min(1, Math.max(0.3, 1 - fwdDist * 0.18))
      ctx.fillText(fwdCell.emoji, W/2, horizon)
      ctx.globalAlpha = 1
    }

    // ── TPV avatar sprite ───────────────────────────────────────────────────────
    if (isTPV) {
      // Avatar sits at 1.5 grid-cell units from camera in world space
      const spriteDist = CAM_BACK_W / CELL_SIZE  // = 1.5 grid units
      const spriteH = Math.round(H * PROJ_DIST / spriteDist * 1.05)
      const spriteW = Math.round(spriteH * 0.5)
      const cx = W / 2
      const baseY = Math.round(horizon - spriteH * 0.85)
      const ac = myColor || C
      ctx.globalAlpha = 0.92
      ctx.fillStyle = ac
      // Body
      ctx.fillRect(cx - spriteW * 0.3, baseY + Math.round(spriteH*0.38), Math.round(spriteW*0.6), Math.round(spriteH*0.55))
      // Head
      ctx.beginPath()
      ctx.arc(cx, baseY + Math.round(spriteH*0.24), Math.round(spriteW*0.34), 0, Math.PI*2)
      ctx.fill()
      ctx.globalAlpha = 1
      // Floor shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.ellipse(cx, horizon + 3, Math.round(spriteW*0.45), 4, 0, 0, Math.PI*2)
      ctx.fill()
    }

    // ── FPV crosshair ───────────────────────────────────────────────────────────
    if (!isTPV) {
      ctx.strokeStyle = C+'88'; ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(W/2-9, horizon); ctx.lineTo(W/2+9, horizon)
      ctx.moveTo(W/2, horizon-9); ctx.lineTo(W/2, horizon+9)
      ctx.stroke()
    }

    // ── HUD ────────────────────────────────────────────────────────────────────
    const { row: gridRow, col: gridCol } = worldToGrid(px, py)
    const curCell = cellMap.get(`${gridRow},${gridCol}`)
    const hex = gridToBlockHex(gridRow, gridCol)
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillStyle = C+'bb'; ctx.font = 'bold 11px monospace'
    ctx.fillText(hex, 10, 10)
    if (curCell?.owner) {
      ctx.fillStyle = curCell.color; ctx.font = '10px monospace'
      ctx.fillText(`${curCell.owner.slice(0,8)}…${curCell.owner.slice(-4)}`, 10, 25)
    }
    const title = es ? (fwdCell?.titleEs||fwdCell?.titleEn) : (fwdCell?.titleEn||fwdCell?.titleEs)
    if (title) { ctx.fillStyle = '#94a3b8'; ctx.font = '10px monospace'; ctx.fillText(`→ ${title}`, 10, 40) }
    ctx.textAlign = 'right'; ctx.fillStyle = '#1e293b'; ctx.font = '9px monospace'
    ctx.fillText(es ? 'WASD/↑↓←→·mover  QE·girar' : 'WASD/arrows·move  QE·turn', W-10, 10)

    drawMinimap(ctx, gridRow, gridCol, angle, cellMap, presenceMap, myWallet, W, H)
  }, [cellMap, presenceMap, myWallet, myColor, es, mode])

  useEffect(() => { renderRef.current = renderFrame }, [renderFrame])

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current
    if (!canvas || !container) return
    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      canvas.width = Math.round(width); canvas.height = Math.round(height)
      renderRef.current?.()
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(container)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { renderRef.current?.() }, [cellMap, presenceMap, mode])

  // Keyboard
  useEffect(() => {
    const dn = (e) => {
      const k = keysRef.current
      if (e.key==='w'||e.key==='W'||e.key==='ArrowUp')    { k.w=true; e.preventDefault() }
      if (e.key==='s'||e.key==='S'||e.key==='ArrowDown')  { k.s=true; e.preventDefault() }
      if (e.key==='a'||e.key==='A')                          k.a=true
      if (e.key==='d'||e.key==='D')                          k.d=true
      if (e.key==='q'||e.key==='Q'||e.key==='ArrowLeft')  { k.q=true; e.preventDefault() }
      if (e.key==='e'||e.key==='E'||e.key==='ArrowRight') { k.e=true; e.preventDefault() }
    }
    const up = (e) => {
      const k = keysRef.current
      if (e.key==='w'||e.key==='W'||e.key==='ArrowUp')    k.w=false
      if (e.key==='s'||e.key==='S'||e.key==='ArrowDown')  k.s=false
      if (e.key==='a'||e.key==='A')                        k.a=false
      if (e.key==='d'||e.key==='D')                        k.d=false
      if (e.key==='q'||e.key==='Q'||e.key==='ArrowLeft')  k.q=false
      if (e.key==='e'||e.key==='E'||e.key==='ArrowRight') k.e=false
    }
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [])

  // Game loop — smooth movement in world-unit space
  useEffect(() => {
    const loop = () => {
      const k = keysRef.current, p = playerRef.current
      let moved = false

      if (k.q) { p.angle -= TURN_SPD; moved = true }
      if (k.e) { p.angle += TURN_SPD; moved = true }

      const fwd = (k.w ? 1 : 0) - (k.s ? 1 : 0)
      const str = (k.d ? 1 : 0) - (k.a ? 1 : 0)
      if (fwd || str) {
        const nx = p.x + (Math.cos(p.angle)*fwd + Math.cos(p.angle + Math.PI/2)*str) * MOVE_SPD
        const ny = p.y + (Math.sin(p.angle)*fwd + Math.sin(p.angle + Math.PI/2)*str) * MOVE_SPD
        const BORDER = 0.5
        if (nx > BORDER && nx < WORLD_W - BORDER) p.x = nx
        if (ny > BORDER && ny < WORLD_H - BORDER) p.y = ny
        moved = true
      }

      if (moved) {
        renderRef.current?.()
        const { row: newRow, col: newCol } = worldToGrid(p.x, p.y)
        const last = lastCellRef.current
        if (newRow !== last.row || newCol !== last.col) {
          lastCellRef.current = { row: newRow, col: newCol }
          onPositionChange?.(newRow, newCol)
        }
      }
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [onPositionChange])

  const dpadBtn = (key, label) => ({
    onPointerDown:  (e) => { e.preventDefault(); keysRef.current[key] = true },
    onPointerUp:    (e) => { e.preventDefault(); keysRef.current[key] = false },
    onPointerLeave: ()  => { keysRef.current[key] = false },
    style: {
      width:44, height:44, background:'rgba(34,211,238,0.07)',
      border:'1px solid #22d3ee33', borderRadius:8,
      color:'#22d3ee99', fontSize:'1.1rem', cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center',
      userSelect:'none', fontFamily:'monospace', touchAction:'none',
    },
    children: label,
  })

  return (
    <div ref={containerRef} style={{ width:'100%', height:'100%', position:'relative', background:'#030508' }}>
      <canvas ref={canvasRef} tabIndex={0}
        style={{ display:'block', width:'100%', height:'100%', outline:'none' }}
      />
      <div style={{ position:'absolute', bottom:16, left:16, display:'flex', flexDirection:'column', gap:3, pointerEvents:'auto' }}>
        <div style={{ display:'flex', justifyContent:'center' }}><button {...dpadBtn('w','▲')} /></div>
        <div style={{ display:'flex', gap:3 }}>
          <button {...dpadBtn('q','◄')} />
          <button {...dpadBtn('s','▼')} />
          <button {...dpadBtn('e','►')} />
        </div>
        <div style={{ display:'flex', gap:3, justifyContent:'center' }}>
          <button {...dpadBtn('a','⇐')} />
          <button {...dpadBtn('d','⇒')} />
        </div>
      </div>
    </div>
  )
}
