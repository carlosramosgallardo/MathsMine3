'use client'

import { useEffect, useRef, useCallback } from 'react'
import { colorFromAddress } from '@/lib/wallet-colors'
import { MM3_BLOCK_GRID_ROWS, MM3_BLOCK_GRID_COLS, gridToBlockHex } from '@/lib/mm3-block-chain'

const ROWS = MM3_BLOCK_GRID_ROWS
const COLS = MM3_BLOCK_GRID_COLS
const C    = '#22d3ee'

const CELL_SIZE  = 4
const WORLD_W    = COLS * CELL_SIZE
const WORLD_H    = ROWS * CELL_SIZE
const STRIP_W    = 3
const FOV        = Math.PI / 2
const PROJ_DIST  = 0.65
const MOVE_SPD   = 0.16
const TURN_SPD   = 0.038
const DOOR_FRAC  = 0.45

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const c = (hex || '#000').replace('#', '').padStart(6, '0')
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)]
}

function wallRgb(cell, dist, side) {
  const [r, g, b] = cell?.owner ? hexToRgb(cell.color)
    : cell?.isMarket ? hexToRgb(cell.color || C) : [10, 18, 36]
  const f = (side === 1 ? 0.68 : 1.0) * Math.max(0.06, 1 - dist * 0.10)
  return [Math.round(r*f), Math.round(g*f), Math.round(b*f)]
}

function worldToGrid(wx, wy) {
  return { row: Math.floor(wy / CELL_SIZE), col: Math.floor(wx / CELL_SIZE) }
}

// ── DDA with doorways ─────────────────────────────────────────────────────────
// Center DOOR_FRAC of each cell-edge is transparent (passage). Solid outer
// sections form "pillars" between rooms. All coords in fractional grid units.
function castRay(wx, wy, angle, cellMap) {
  const px = wx / CELL_SIZE, py = wy / CELL_SIZE
  const dx = Math.cos(angle), dy = Math.sin(angle)
  let mx = Math.floor(px), my = Math.floor(py)
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1
  const ddx = Math.abs(dx) < 1e-7 ? 1e30 : Math.abs(1/dx)
  const ddy = Math.abs(dy) < 1e-7 ? 1e30 : Math.abs(1/dy)
  let sdx = (dx<0 ? px-mx : mx+1-px) * ddx
  let sdy = (dy<0 ? py-my : my+1-py) * ddy
  let side = 0, perpDist = 0

  for (let step = 0; step < (ROWS+COLS)*2; step++) {
    if (sdx < sdy) { sdx+=ddx; mx+=sx; side=0; perpDist=sdx-ddx }
    else           { sdy+=ddy; my+=sy; side=1; perpDist=sdy-ddy }
    perpDist = Math.max(0.05, perpDist)
    if (mx<0||mx>=COLS||my<0||my>=ROWS) return { perpDist, cell:null, side, mx, my }
    const hitFrac = (((side===0 ? py+perpDist*dy : px+perpDist*dx) % 1.0)+1.0) % 1.0
    const lo = (1-DOOR_FRAC)/2, hi = (1+DOOR_FRAC)/2
    if (hitFrac < lo || hitFrac > hi) {
      return { perpDist, cell: cellMap.get(`${my},${mx}`) || null, side, mx, my }
    }
  }
  return { perpDist: ROWS+COLS, cell:null, side:0, mx:-1, my:-1 }
}

// ── Minimap ───────────────────────────────────────────────────────────────────
function drawMinimap(ctx, gridRow, gridCol, angle, cellMap, presenceMap, myWallet, W, H) {
  const SZ = Math.min(110, W * 0.18), CS = SZ / ROWS
  const MX = W-SZ-10, MY = H-SZ-10
  ctx.fillStyle = 'rgba(0,0,0,0.82)'
  ctx.fillRect(MX-1, MY-1, SZ+2, SZ+2)
  for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) {
    const cell = cellMap.get(`${r},${c}`)
    ctx.fillStyle = cell?.owner ? cell.color+'aa' : cell?.isMarket ? C+'55' : '#081420'
    ctx.fillRect(MX+c*CS, MY+r*CS, Math.ceil(CS), Math.ceil(CS))
  }
  // Current cell highlight
  ctx.strokeStyle = C+'99'; ctx.lineWidth = 0.5
  ctx.strokeRect(MX+gridCol*CS, MY+gridRow*CS, Math.ceil(CS), Math.ceil(CS))
  // FOV cone
  const pvx=MX+gridCol*CS+CS/2, pvy=MY+gridRow*CS+CS/2, cl=SZ*0.3
  ctx.strokeStyle = C+'cc'; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pvx,pvy); ctx.lineTo(pvx+Math.cos(angle-FOV/2)*cl, pvy+Math.sin(angle-FOV/2)*cl)
  ctx.moveTo(pvx,pvy); ctx.lineTo(pvx+Math.cos(angle+FOV/2)*cl, pvy+Math.sin(angle+FOV/2)*cl)
  ctx.stroke()
  // Presence dots
  for (const [w,p] of Object.entries(presenceMap||{})) {
    if (p.row==null) continue
    const isMe = w.toLowerCase()===(myWallet||'').toLowerCase()
    ctx.fillStyle = isMe ? C : colorFromAddress(w)
    ctx.beginPath(); ctx.arc(MX+(p.col??0)*CS+CS/2, MY+(p.row??0)*CS+CS/2, isMe?CS*1.6:CS, 0, Math.PI*2); ctx.fill()
  }
  // Label
  ctx.fillStyle = '#1e3a4a'; ctx.font = `${Math.max(6, Math.round(CS*2.2))}px monospace`
  ctx.textAlign='center'; ctx.textBaseline='top'
  ctx.fillText('MAP', MX+SZ/2, MY+1)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MiningHotelFPV({
  cellMap, presenceMap, myWallet, myColor,
  initRow, initCol, onPositionChange, onFacingChange, es, mode = 'tpv',
}) {
  const canvasRef    = useRef(null)
  const containerRef = useRef(null)
  const keysRef      = useRef({ w:false, s:false, a:false, d:false, q:false, e:false })
  const playerRef    = useRef({
    x: ((initCol??14)+0.5)*CELL_SIZE,
    y: ((initRow??14)+0.5)*CELL_SIZE,
    angle: 0,
  })
  const walkDistRef  = useRef(0)
  const notifRef     = useRef(null)   // { text, color, startedAt }
  const facingKeyRef = useRef(null)
  const cellMapRef   = useRef(cellMap)
  const esRef        = useRef(es)
  const animRef      = useRef(null)
  const renderRef    = useRef(null)
  const lastCellRef  = useRef({ row: initRow??14, col: initCol??14 })

  useEffect(() => { cellMapRef.current = cellMap }, [cellMap])
  useEffect(() => { esRef.current = es }, [es])
  useEffect(() => {
    playerRef.current.x = ((initCol??14)+0.5)*CELL_SIZE
    playerRef.current.y = ((initRow??14)+0.5)*CELL_SIZE
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

    // Head bob (FPV only) — subtle oscillation on walk distance
    const bob = isTPV ? 0 : Math.sin(walkDistRef.current * 0.12) * 0.03 * CELL_SIZE

    const CAM_BACK_W = isTPV ? 1.5*CELL_SIZE : 0
    const camX = px - Math.cos(angle)*CAM_BACK_W
    const camY = py - Math.sin(angle)*CAM_BACK_W + bob

    const horizon = H * (isTPV ? 0.38 : 0.5)
    const strips  = Math.ceil(W / STRIP_W)

    // Atmospheric tinting from current room color
    const { row: gr, col: gc } = worldToGrid(px, py)
    const currentCell = cellMap.get(`${gr},${gc}`)
    const [ar, ag, ab] = currentCell?.color ? hexToRgb(currentCell.color) : [0, 0, 0]
    const ATMO = 0.14

    // Ceiling
    const cg = ctx.createLinearGradient(0, 0, 0, horizon)
    cg.addColorStop(0, `rgb(${Math.round(2+ar*ATMO)},${Math.round(3+ag*ATMO)},${Math.round(7+ab*ATMO)})`)
    cg.addColorStop(1, `rgb(${Math.round(6+ar*ATMO)},${Math.round(9+ag*ATMO)},${Math.round(28+ab*ATMO)})`)
    ctx.fillStyle = cg; ctx.fillRect(0, 0, W, horizon)

    // Floor with perspective lines
    const fg = ctx.createLinearGradient(0, horizon, 0, H)
    fg.addColorStop(0, `rgb(${Math.round(8+ar*ATMO)},${Math.round(14+ag*ATMO)},${Math.round(30+ab*ATMO)})`)
    fg.addColorStop(1, `rgb(${Math.round(2+ar*ATMO*0.5)},${Math.round(5+ag*ATMO*0.5)},${Math.round(9+ab*ATMO*0.5)})`)
    ctx.fillStyle = fg; ctx.fillRect(0, horizon, W, H-horizon)
    const lStep = Math.max(2, Math.round((H-horizon)/10))
    for (let fy=Math.round(horizon); fy<H; fy+=lStep) {
      ctx.fillStyle = `rgba(${Math.round(34+ar*0.15)},${Math.round(180+ag*0.05)},${Math.round(200+ab*0.05)},0.04)`
      ctx.fillRect(0, fy, W, 1)
    }

    // Wall strips
    for (let col=0; col<strips; col++) {
      const ra = angle - FOV/2 + (col+0.5)*FOV/strips
      const { perpDist, cell, side } = castRay(camX, camY, ra, cellMap)
      const dist = perpDist * Math.cos(ra - angle)
      const wallH = Math.min(H*1.8, H*PROJ_DIST/Math.max(0.01,dist))
      const wTop  = Math.round(horizon - wallH/2)
      const [rw,gw,bw] = wallRgb(cell, dist, side)
      ctx.fillStyle = `rgb(${rw},${gw},${bw})`
      ctx.fillRect(col*STRIP_W, wTop, STRIP_W, wallH)
      // CRT scanlines
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      for (let sy=wTop; sy<wTop+wallH; sy+=4) ctx.fillRect(col*STRIP_W, sy, STRIP_W, 1)
    }

    // Forward wall data (from player position, not camera)
    const { cell: fwdCell, perpDist: fwdDist, mx: fwdMx, my: fwdMy } = castRay(px, py, angle, cellMap)
    const fwdHex = fwdMx>=0 && fwdMy>=0 ? (fwdCell?.blockHex || gridToBlockHex(fwdMy, fwdMx)) : null

    // Emoji centered on forward wall face
    if (fwdCell?.emoji) {
      const sz = Math.max(16, Math.round(H*PROJ_DIST/Math.max(0.1,fwdDist)*(isTPV?0.42:0.58)))
      ctx.font = `${sz}px serif`
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.globalAlpha = Math.min(1, Math.max(0.2, 1 - fwdDist*0.15))
      ctx.fillText(fwdCell.emoji, W/2, horizon)
      ctx.globalAlpha = 1
    }

    // Hex label on forward wall face (scales with distance, very subtle)
    if (fwdHex && fwdDist < 3.5) {
      const labelAlpha = Math.max(0, (3.5-fwdDist)/3.5) * 0.45
      const wH = Math.min(H*1.8, H*PROJ_DIST/Math.max(0.1,fwdDist))
      const fontSize = Math.max(7, Math.round(12*PROJ_DIST/Math.max(0.3,fwdDist)))
      ctx.globalAlpha = labelAlpha
      ctx.font = `bold ${fontSize}px monospace`
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillStyle = fwdCell?.color || C
      ctx.fillText(fwdHex, W/2, horizon - wH*0.28)
      ctx.globalAlpha = 1
    }

    // Inspect prompt (when very close to a wall)
    if (fwdDist < 0.85 && fwdCell !== undefined) {
      ctx.font = '11px monospace'
      ctx.textAlign='center'; ctx.textBaseline='top'
      ctx.fillStyle = C+'bb'
      ctx.fillText(es ? '[ ↵ VER DETALLE ]' : '[ ↵ INSPECT ]', W/2, horizon+18)
    }

    // TPV avatar sprite
    if (isTPV) {
      const sd = CAM_BACK_W/CELL_SIZE
      const sh = Math.round(H*PROJ_DIST/sd*1.05)
      const sw = Math.round(sh*0.5)
      const cx = W/2, by = Math.round(horizon - sh*0.85)
      const ac = myColor || C
      ctx.globalAlpha = 0.92
      ctx.fillStyle = ac
      ctx.fillRect(cx-sw*0.3, by+Math.round(sh*0.38), Math.round(sw*0.6), Math.round(sh*0.55))
      ctx.beginPath(); ctx.arc(cx, by+Math.round(sh*0.24), Math.round(sw*0.34), 0, Math.PI*2); ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath(); ctx.ellipse(cx, horizon+3, Math.round(sw*0.45), 4, 0, 0, Math.PI*2); ctx.fill()
    }

    // FPV crosshair
    if (!isTPV) {
      ctx.strokeStyle = C+'55'; ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(W/2-8, horizon); ctx.lineTo(W/2+8, horizon)
      ctx.moveTo(W/2, horizon-8); ctx.lineTo(W/2, horizon+8)
      ctx.stroke()
    }

    // Room entry notification (fade-in then fade-out)
    const notif = notifRef.current
    if (notif) {
      const elapsed = Date.now() - notif.startedAt
      const fadeMs = 2800
      if (elapsed < fadeMs) {
        const t = elapsed / fadeMs
        const alpha = t < 0.12 ? t/0.12 : t < 0.7 ? 1 : 1-(t-0.7)/0.3
        ctx.globalAlpha = alpha
        ctx.font = 'bold 12px monospace'
        ctx.textAlign = 'center'
        const tw = Math.min(ctx.measureText(notif.text).width + 28, W*0.7)
        const bx = W/2 - tw/2, by = horizon - 64, bh = 24
        ctx.fillStyle = 'rgba(0,0,0,0.78)'
        ctx.fillRect(bx, by, tw, bh)
        ctx.strokeStyle = notif.color
        ctx.lineWidth = 1; ctx.strokeRect(bx, by, tw, bh)
        ctx.fillStyle = notif.color
        ctx.textBaseline = 'middle'
        ctx.fillText(notif.text, W/2, by+bh/2)
        ctx.globalAlpha = 1
      } else {
        notifRef.current = null
      }
    }

    // Top-left HUD
    ctx.textAlign='left'; ctx.textBaseline='top'
    const curHex = gridToBlockHex(gr, gc)
    ctx.fillStyle = C+'88'; ctx.font = 'bold 10px monospace'
    ctx.fillText(curHex, 10, 10)
    if (currentCell?.owner) {
      ctx.fillStyle = currentCell.color+'88'; ctx.font = '9px monospace'
      ctx.fillText(`${currentCell.owner.slice(0,6)}…${currentCell.owner.slice(-4)}`, 10, 22)
    }
    ctx.textAlign='right'; ctx.fillStyle = '#152230'; ctx.font = '8px monospace'
    ctx.fillText(es ? 'WASD/↑↓←→·mover  QE·girar' : 'WASD/arrows·move  QE·turn', W-10, 10)

    drawMinimap(ctx, gr, gc, angle, cellMap, presenceMap, myWallet, W, H)
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

  // Game loop
  useEffect(() => {
    const loop = () => {
      const k = keysRef.current, p = playerRef.current
      let needsRender = false

      // Rotation
      if (k.q) { p.angle -= TURN_SPD; needsRender = true }
      if (k.e) { p.angle += TURN_SPD; needsRender = true }

      // Translation
      const fwd = (k.w?1:0)-(k.s?1:0)
      const str = (k.d?1:0)-(k.a?1:0)
      if (fwd || str) {
        const nx = p.x + (Math.cos(p.angle)*fwd + Math.cos(p.angle+Math.PI/2)*str)*MOVE_SPD
        const ny = p.y + (Math.sin(p.angle)*fwd + Math.sin(p.angle+Math.PI/2)*str)*MOVE_SPD
        if (nx>0.5 && nx<WORLD_W-0.5) p.x = nx
        if (ny>0.5 && ny<WORLD_H-0.5) p.y = ny
        walkDistRef.current += MOVE_SPD
        needsRender = true

        // Room entry detection
        const { row: newRow, col: newCol } = worldToGrid(p.x, p.y)
        const last = lastCellRef.current
        if (newRow !== last.row || newCol !== last.col) {
          lastCellRef.current = { row: newRow, col: newCol }
          onPositionChange?.(newRow, newCol)
          const entered = cellMapRef.current.get(`${newRow},${newCol}`)
          const hex = gridToBlockHex(newRow, newCol)
          const loc = esRef.current
          const title = loc ? (entered?.titleEs||entered?.titleEn||'') : (entered?.titleEn||entered?.titleEs||'')
          const parts = [entered?.emoji, hex, title || (entered?.owner
            ? `${entered.owner.slice(0,6)}…` : (loc ? 'libre' : 'unclaimed'))].filter(Boolean)
          notifRef.current = { text: parts.join(' · '), color: entered?.color||C, startedAt: Date.now() }
        }
      }

      // Facing cell detection (every frame — also fires on rotation)
      const { cell: fc, mx: fmx, my: fmy } = castRay(p.x, p.y, p.angle, cellMapRef.current)
      const newKey = `${fmy},${fmx}`
      if (newKey !== facingKeyRef.current) {
        facingKeyRef.current = newKey
        if (fmx>=0 && fmy>=0) onFacingChange?.(fmy, fmx, fc)
        needsRender = true
      }

      // Active notification needs continuous render for fade animation
      const hasNotif = notifRef.current && (Date.now()-notifRef.current.startedAt) < 2800
      if (hasNotif) needsRender = true

      if (needsRender) renderRef.current?.()

      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [onPositionChange, onFacingChange])

  const dpadBtn = (key, label) => ({
    onPointerDown:  (e) => { e.preventDefault(); keysRef.current[key]=true },
    onPointerUp:    (e) => { e.preventDefault(); keysRef.current[key]=false },
    onPointerLeave: ()  => { keysRef.current[key]=false },
    style: {
      width:44, height:44, background:'rgba(34,211,238,0.07)',
      border:'1px solid #22d3ee33', borderRadius:8, color:'#22d3ee99',
      fontSize:'1.1rem', cursor:'pointer', display:'flex',
      alignItems:'center', justifyContent:'center',
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
