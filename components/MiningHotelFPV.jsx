'use client'

import { useEffect, useRef, useCallback } from 'react'
import { colorFromAddress } from '@/lib/wallet-colors'
import { MM3_BLOCK_GRID_ROWS, MM3_BLOCK_GRID_COLS, gridToBlockHex } from '@/lib/mm3-block-chain'

const ROWS = MM3_BLOCK_GRID_ROWS
const COLS = MM3_BLOCK_GRID_COLS
const C    = '#22d3ee'

const CELL_SIZE     = 4
const WORLD_W       = COLS * CELL_SIZE
const WORLD_H       = ROWS * CELL_SIZE
const STRIP_W       = 3
const FOV           = Math.PI / 2
const PROJ_DIST     = 0.65
const MOVE_SPD      = 0.18
const TURN_SPD      = 0.040
const DOOR_FRAC     = 0.45
const HORIZON_RATIO = 0.42
const PLAYER_R      = 0.20   // collision radius in grid units (1 unit = 1 cell)
const DOOR_LO       = (1 - DOOR_FRAC) / 2   // 0.275
const DOOR_HI       = (1 + DOOR_FRAC) / 2   // 0.725

// ── Wall collision: returns true if position (grid units) hits a solid wall ──
function hitsSolidWall(gx, gy) {
  const fx = gx - Math.floor(gx)
  const fy = gy - Math.floor(gy)
  if (fx < PLAYER_R)     { if (fy < DOOR_LO || fy > DOOR_HI) return true }
  if (fx > 1-PLAYER_R)   { if (fy < DOOR_LO || fy > DOOR_HI) return true }
  if (fy < PLAYER_R)     { if (fx < DOOR_LO || fx > DOOR_HI) return true }
  if (fy > 1-PLAYER_R)   { if (fx < DOOR_LO || fx > DOOR_HI) return true }
  return false
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const c = (hex || '#000').replace('#', '').padStart(6, '0')
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)]
}

function wallRgb(cell, dist, side) {
  // Brighter base colors, less aggressive fog
  const [r,g,b] = cell?.owner   ? hexToRgb(cell.color)
    :              cell?.isMarket ? hexToRgb(cell.color || C)
    :                               [22, 38, 78]
  const f = (side === 1 ? 0.72 : 1.0) * Math.max(0.14, 1 - dist * 0.065)
  return [Math.round(r*f), Math.round(g*f), Math.round(b*f)]
}

function worldToGrid(wx, wy) {
  return { row: Math.floor(wy / CELL_SIZE), col: Math.floor(wx / CELL_SIZE) }
}

// ── DDA with centre-doorways ──────────────────────────────────────────────────
function castRay(wx, wy, angle, cellMap) {
  const px = wx / CELL_SIZE, py = wy / CELL_SIZE
  const dx = Math.cos(angle), dy = Math.sin(angle)
  let mx = Math.floor(px), my = Math.floor(py)
  const sx = dx>0?1:-1, sy = dy>0?1:-1
  const ddx = Math.abs(dx)<1e-7?1e30:Math.abs(1/dx)
  const ddy = Math.abs(dy)<1e-7?1e30:Math.abs(1/dy)
  let sdx = (dx<0?px-mx:mx+1-px)*ddx
  let sdy = (dy<0?py-my:my+1-py)*ddy
  let side=0, perpDist=0

  for (let step=0; step<(ROWS+COLS)*2; step++) {
    if (sdx<sdy) { sdx+=ddx; mx+=sx; side=0; perpDist=sdx-ddx }
    else         { sdy+=ddy; my+=sy; side=1; perpDist=sdy-ddy }
    perpDist = Math.max(0.05, perpDist)
    if (mx<0||mx>=COLS||my<0||my>=ROWS) return {perpDist,cell:null,side,mx,my}
    const hitFrac = (((side===0?py+perpDist*dy:px+perpDist*dx)%1.0)+1.0)%1.0
    const lo=(1-DOOR_FRAC)/2, hi=(1+DOOR_FRAC)/2
    if (hitFrac<lo||hitFrac>hi) return {perpDist, cell:cellMap.get(`${my},${mx}`)||null, side, mx, my}
  }
  return {perpDist:ROWS+COLS, cell:null, side:0, mx:-1, my:-1}
}

// ── Minimap ───────────────────────────────────────────────────────────────────
function drawMinimap(ctx, gr, gc, angle, cellMap, presenceMap, myWallet, W, H) {
  const SZ = Math.min(120, W*0.19), CS = SZ/ROWS
  const MX = W-SZ-10, MY = H-SZ-10

  ctx.fillStyle = 'rgba(0,0,0,0.85)'
  ctx.fillRect(MX-1,MY-1,SZ+2,SZ+2)
  ctx.strokeStyle = C+'33'; ctx.lineWidth=0.5
  ctx.strokeRect(MX-1,MY-1,SZ+2,SZ+2)

  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    const cell = cellMap.get(`${r},${c}`)
    ctx.fillStyle = cell?.owner ? cell.color+'bb' : cell?.isMarket ? C+'55' : '#0a1828'
    ctx.fillRect(MX+c*CS, MY+r*CS, Math.ceil(CS), Math.ceil(CS))
    const isMyBlock = cell?.owner && myWallet && cell.owner.toLowerCase() === myWallet.toLowerCase()
    if (isMyBlock) {
      ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 0.7
      ctx.strokeRect(MX+c*CS+0.5, MY+r*CS+0.5, Math.max(1,Math.ceil(CS)-1), Math.max(1,Math.ceil(CS)-1))
    }
  }

  ctx.strokeStyle = C+'cc'; ctx.lineWidth=0.8
  ctx.strokeRect(MX+gc*CS, MY+gr*CS, Math.ceil(CS), Math.ceil(CS))

  const pvx=MX+gc*CS+CS/2, pvy=MY+gr*CS+CS/2, cl=SZ*0.32
  ctx.strokeStyle=C+'aa'; ctx.lineWidth=1
  ctx.beginPath()
  ctx.moveTo(pvx,pvy); ctx.lineTo(pvx+Math.cos(angle-FOV/2)*cl,pvy+Math.sin(angle-FOV/2)*cl)
  ctx.moveTo(pvx,pvy); ctx.lineTo(pvx+Math.cos(angle+FOV/2)*cl,pvy+Math.sin(angle+FOV/2)*cl)
  ctx.stroke()

  for (const [w,p] of Object.entries(presenceMap||{})) {
    if (p.row==null) continue
    const isMe = w.toLowerCase()===(myWallet||'').toLowerCase()
    ctx.fillStyle = isMe ? C : colorFromAddress(w)
    ctx.beginPath()
    ctx.arc(MX+(p.col??0)*CS+CS/2, MY+(p.row??0)*CS+CS/2, isMe?CS*1.8:CS*1.1, 0, Math.PI*2)
    ctx.fill()
  }
}

// ── Facing block HUD (top-right info card) ────────────────────────────────────
function drawFacingHUD(ctx, W, H, fwdCell, fwdMx, fwdMy, myWallet, es) {
  if (fwdMx < 0 || fwdMy < 0) return

  const hex   = fwdCell?.blockHex || gridToBlockHex(fwdMy, fwdMx)
  const title = fwdCell
    ? (es ? (fwdCell.titleEs || fwdCell.titleEn || '') : (fwdCell.titleEn || fwdCell.titleEs || ''))
    : ''
  const owner  = fwdCell?.owner || null
  const isMine = myWallet && owner?.toLowerCase() === myWallet.toLowerCase()
  const color  = fwdCell?.color || C

  const lines = []
  const epfx  = fwdCell?.emoji ? `${fwdCell.emoji}  ` : ''
  lines.push({ text: `${epfx}${hex}`, size: 11, weight: 'bold', col: color })
  if (title) lines.push({ text: title, size: 9, col: '#b8ccd8' })

  if (owner) {
    lines.push({
      text: isMine
        ? (es ? '🔑 Tu bloque' : '🔑 Yours')
        : `◈ ${owner.slice(0,6)}…${owner.slice(-4)}`,
      size: 9, col: isMine ? C : color + 'cc',
    })
  } else if (fwdCell?.isMarket) {
    lines.push({ text: es ? '○ Libre / En venta' : '○ Unclaimed / For sale', size: 9, col: '#1f4a60' })
  } else if (fwdCell) {
    lines.push({ text: es ? '○ Sin reclamar' : '○ Unclaimed', size: 9, col: '#1a3040' })
  }

  if (fwdCell?.priceEur > 0) {
    lines.push({ text: `${fwdCell.priceEur} EUR`, size: 9, weight: 'bold', col: '#fb923c' })
  }

  if (!owner && fwdCell) {
    lines.push({ text: es ? '↵ · Minar bloque' : '↵ · Mine block', size: 8, col: C + '99' })
  }

  const lineH = 14, padX = 8, padY = 7
  const ph = lines.length * lineH + padY * 2
  const pw = Math.min(W * 0.27, 200)
  const px = W - pw - 8
  const py = 8

  // Background
  ctx.globalAlpha = 0.90
  ctx.fillStyle = '#010709'
  ctx.fillRect(px, py, pw, ph)
  ctx.globalAlpha = 1

  // Border + accent bar
  ctx.lineWidth = 1
  ctx.strokeStyle = color + '55'
  ctx.strokeRect(px, py, pw, ph)
  ctx.fillStyle = color + '77'
  ctx.fillRect(px, py, 2, ph)

  // Text lines
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    ctx.font = `${l.weight || 'normal'} ${l.size}px monospace`
    ctx.fillStyle = l.col
    ctx.fillText(l.text, px + padX, py + padY + i * lineH, pw - padX * 2)
  }
}

// ── Footstep sound (procedural via Web Audio API) ────────────────────────────
function playStep(audioCtxRef) {
  try {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const sr  = ctx.sampleRate
    const dur = 0.055
    const buf = ctx.createBuffer(1, Math.ceil(sr * dur), sr)
    const d   = buf.getChannelData(0)
    // Short noise burst with fast exponential decay → soft floor thud
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.4)
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    const filt = ctx.createBiquadFilter()
    filt.type  = 'lowpass'
    filt.frequency.value = 210
    const gain = ctx.createGain()
    gain.gain.value = 0.09
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination)
    src.start()
  } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MiningHotelFPV({
  cellMap, presenceMap, myWallet, myColor,
  initRow, initCol, jumpToCell,
  onPositionChange, onFacingChange, onWantNavigate,
  es,
}) {
  const canvasRef    = useRef(null)
  const containerRef = useRef(null)
  const keysRef      = useRef({w:false,s:false,a:false,d:false,q:false,e:false})
  const playerRef    = useRef({
    x:((initCol??14)+0.5)*CELL_SIZE,
    y:((initRow??14)+0.5)*CELL_SIZE,
    angle:0,
  })
  const walkDistRef  = useRef(0)
  const audioCtxRef  = useRef(null)
  const stepCountRef = useRef(0)
  const notifRef     = useRef(null)
  const facingKeyRef = useRef(null)
  const actionUrlRef = useRef(null)
  const cellMapRef   = useRef(cellMap)
  const presenceRef  = useRef(presenceMap)
  const myWalletRef  = useRef(myWallet)
  const esRef        = useRef(es)
  const onWantNavRef = useRef(onWantNavigate)
  const dragRef      = useRef(null)
  const animRef      = useRef(null)
  const renderRef    = useRef(null)
  const lastCellRef  = useRef({row:initRow??14,col:initCol??14})
  const zBufferRef   = useRef(null)

  // Keep refs in sync with props
  useEffect(()=>{ cellMapRef.current=cellMap },[cellMap])
  useEffect(()=>{ presenceRef.current=presenceMap },[presenceMap])
  useEffect(()=>{ myWalletRef.current=myWallet },[myWallet])
  useEffect(()=>{ esRef.current=es },[es])
  useEffect(()=>{ onWantNavRef.current=onWantNavigate },[onWantNavigate])

  // External teleport
  useEffect(()=>{
    if (!jumpToCell) return
    playerRef.current.x = (jumpToCell.col+0.5)*CELL_SIZE
    playerRef.current.y = (jumpToCell.row+0.5)*CELL_SIZE
    renderRef.current?.()
  },[jumpToCell])

  useEffect(()=>{
    playerRef.current.x=((initCol??14)+0.5)*CELL_SIZE
    playerRef.current.y=((initRow??14)+0.5)*CELL_SIZE
  },[initRow,initCol])

  // ── Render ──────────────────────────────────────────────────────────────────
  const renderFrame = useCallback(()=>{
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W=canvas.width, H=canvas.height
    if (!W||!H) return

    const cellMap  = cellMapRef.current
    const presence = presenceRef.current
    const myWallet = myWalletRef.current
    const es       = esRef.current

    const {x:px,y:py,angle} = playerRef.current
    const horizon = H * HORIZON_RATIO
    const strips  = Math.ceil(W/STRIP_W)

    if (!zBufferRef.current || zBufferRef.current.length !== strips) {
      zBufferRef.current = new Float32Array(strips)
    }
    const zBuffer = zBufferRef.current

    const bob = Math.sin(walkDistRef.current*0.12)*0.03*CELL_SIZE

    // Atmospheric tint from current room
    const {row:gr,col:gc} = worldToGrid(px,py)
    const curCell = cellMap.get(`${gr},${gc}`)
    const [ar,ag,ab] = curCell?.color ? hexToRgb(curCell.color) : [0,0,0]
    const AT = 0.18

    // Ceiling — brighter base values
    const cg = ctx.createLinearGradient(0,0,0,horizon)
    cg.addColorStop(0,`rgb(${Math.round(8+ar*AT)},${Math.round(13+ag*AT)},${Math.round(34+ab*AT)})`)
    cg.addColorStop(1,`rgb(${Math.round(16+ar*AT)},${Math.round(26+ag*AT)},${Math.round(62+ab*AT)})`)
    ctx.fillStyle=cg; ctx.fillRect(0,0,W,horizon)

    // Floor — brighter base + subtle grid lines
    const fg = ctx.createLinearGradient(0,horizon,0,H)
    fg.addColorStop(0,`rgb(${Math.round(22+ar*AT)},${Math.round(36+ag*AT)},${Math.round(72+ab*AT)})`)
    fg.addColorStop(1,`rgb(${Math.round(6+ar*AT*.5)},${Math.round(10+ag*AT*.5)},${Math.round(20+ab*AT*.5)})`)
    ctx.fillStyle=fg; ctx.fillRect(0,horizon,W,H-horizon)

    // Scanline floor accent
    const ls=Math.max(2,Math.round((H-horizon)/12))
    for (let fy=Math.round(horizon);fy<H;fy+=ls){
      ctx.fillStyle=`rgba(${34+Math.round(ar*.15)},${180+Math.round(ag*.04)},${200+Math.round(ab*.04)},0.05)`
      ctx.fillRect(0,fy,W,1)
    }

    // Pre-compute forward cell
    const {mx:fwdMx,my:fwdMy,cell:fwdCell,perpDist:fwdDist} = castRay(px,py+bob,angle,cellMap)

    // ── Wall strips + build zBuffer ───────────────────────────────────────────
    for (let col=0; col<strips; col++){
      const ra = angle - FOV/2 + (col+0.5)*FOV/strips
      const {perpDist,cell,side,mx:hitMx,my:hitMy} = castRay(px,py+bob,ra,cellMap)
      const dist  = perpDist*Math.cos(ra-angle)
      const wallH = Math.min(H*1.8, H*PROJ_DIST/Math.max(0.01,dist))
      const wTop  = Math.round(horizon-wallH/2)

      zBuffer[col] = dist

      const [rw,gw,bw] = wallRgb(cell,dist,side)
      ctx.fillStyle=`rgb(${rw},${gw},${bw})`
      ctx.fillRect(col*STRIP_W,wTop,STRIP_W,wallH)

      // Market block patterns
      if (cell?.isMarket) {
        if (!cell.owner) {
          // Unowned market: vivid cyan stripes
          const stripeH = Math.max(4, Math.round(wallH/5))
          for (let sy=wTop; sy<wTop+wallH; sy+=stripeH*2) {
            ctx.fillStyle = 'rgba(34,211,238,0.13)'
            ctx.fillRect(col*STRIP_W, sy, STRIP_W, Math.min(stripeH, wTop+wallH-sy))
          }
        } else {
          const [mr,mg,mb] = hexToRgb(cell.color)
          ctx.fillStyle = `rgba(${mr},${mg},${mb},0.15)`
          ctx.fillRect(col*STRIP_W, wTop, STRIP_W, wallH)
        }
      }

      // Ambient-occlusion edges
      const edgeH = Math.max(2,Math.round(wallH*0.14))
      ctx.fillStyle='rgba(0,0,0,0.24)'
      ctx.fillRect(col*STRIP_W,wTop,STRIP_W,edgeH)
      ctx.fillRect(col*STRIP_W,wTop+wallH-edgeH,STRIP_W,edgeH)

      // Forward-cell selection glow
      if (hitMx===fwdMx && hitMy===fwdMy && fwdMx>=0 && cell){
        ctx.fillStyle='rgba(34,211,238,0.11)'
        ctx.fillRect(col*STRIP_W,wTop,STRIP_W,wallH)
      }

      // CRT scanlines on walls
      ctx.fillStyle='rgba(0,0,0,0.10)'
      for (let sy=wTop;sy<wTop+wallH;sy+=4) ctx.fillRect(col*STRIP_W,sy,STRIP_W,1)
    }

    // ── Presence sprites ──────────────────────────────────────────────────────
    const camGX = px / CELL_SIZE, camGY = py / CELL_SIZE
    const sprites = []
    for (const [w, pres] of Object.entries(presence || {})) {
      if (pres.row == null || pres.col == null) continue
      const isMe = w.toLowerCase() === (myWallet || '').toLowerCase()
      if (isMe) continue
      const rx = (pres.col + 0.5) - camGX
      const ry = (pres.row + 0.5) - camGY
      const tY = Math.cos(angle)*rx + Math.sin(angle)*ry
      if (tY < 0.1) continue
      const tX   = Math.sin(angle)*rx - Math.cos(angle)*ry
      const dist  = Math.sqrt(rx*rx + ry*ry)
      sprites.push({ w, tX, tY, dist, color: colorFromAddress(w) })
    }
    sprites.sort((a,b) => b.dist - a.dist)

    for (const { w, tX, tY, color } of sprites) {
      const sprH  = Math.min(H*1.6, H*PROJ_DIST/tY*1.1)
      const sprW  = Math.round(sprH*0.42)
      const scrX  = Math.round(W/2*(1+tX/tY))
      const topY  = Math.round(horizon - sprH*0.80)
      const headH = Math.round(sprH*0.32)
      const bodyH = Math.round(sprH*0.52)
      const headW = Math.round(sprW*0.72)
      const bodyW = Math.round(sprW*0.58)
      const bodyTop = topY + headH
      const [cr,cg2,cb] = hexToRgb(color)
      const fade  = Math.max(0.15, 1 - tY*0.07)
      const alpha = Math.min(0.95, Math.max(0, 1.0 - tY*0.05))
      const sprLeft  = scrX - Math.floor(sprW/2)
      const sprRight = scrX + Math.ceil(sprW/2)
      const hx1 = scrX - Math.floor(headW/2), hx2 = scrX + Math.ceil(headW/2)
      const bx1 = scrX - Math.floor(bodyW/2), bx2 = scrX + Math.ceil(bodyW/2)

      for (let sx=sprLeft; sx<sprRight; sx++) {
        const zCol = Math.floor(sx/STRIP_W)
        if (zCol < 0 || zCol >= strips) continue
        if (tY >= zBuffer[zCol]) continue
        if (sx >= hx1 && sx < hx2) {
          ctx.globalAlpha = alpha
          ctx.fillStyle = `rgb(${Math.round(cr*fade)},${Math.round(cg2*fade)},${Math.round(cb*fade)})`
          ctx.fillRect(sx, topY, 1, headH)
        }
        if (sx >= bx1 && sx < bx2) {
          ctx.globalAlpha = alpha*0.85
          ctx.fillStyle = `rgb(${Math.round(cr*fade*0.55)},${Math.round(cg2*fade*0.55)},${Math.round(cb*fade*0.55)})`
          ctx.fillRect(sx, bodyTop, 1, bodyH)
        }
      }
      ctx.globalAlpha = 1

      if (tY < 5.0) {
        const sAlpha = Math.max(0, (5.0-tY)/5.0)*0.32
        const sw = Math.max(4, Math.round(sprW*0.9))
        const sh = Math.max(2, Math.round(sw*0.25))
        ctx.globalAlpha = sAlpha
        ctx.fillStyle = '#000'
        ctx.beginPath()
        ctx.ellipse(scrX, horizon+sh, sw/2, sh, 0, 0, Math.PI*2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      if (tY < 4.5) {
        const lAlpha = Math.max(0, (4.5-tY)/4.5)*0.78
        const lSize  = Math.max(7, Math.round(10/Math.max(0.6, tY)))
        ctx.globalAlpha = lAlpha
        ctx.font = `${lSize}px monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
        ctx.fillStyle = color
        ctx.fillText(`${w.slice(0,6)}…`, scrX, topY-2)
        ctx.globalAlpha = 1
      }
    }

    // ── Wall face overlays ────────────────────────────────────────────────────
    const isMineWall = myWallet && fwdCell?.owner?.toLowerCase() === myWallet.toLowerCase()

    // Emoji — prominent, centered on wall face
    if (fwdCell?.emoji) {
      const sz  = Math.max(18, Math.round(H*PROJ_DIST/Math.max(0.1,fwdDist)*0.60))
      const a   = Math.min(0.95, Math.max(0.18, 1 - fwdDist*0.11))
      ctx.globalAlpha = a
      ctx.font = `${sz}px serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(fwdCell.emoji, W/2, horizon - sz*0.08)
      ctx.globalAlpha = 1
    }

    // Block title on wall face (medium distance)
    const fwdTitle = fwdCell
      ? (es ? (fwdCell.titleEs||fwdCell.titleEn||'') : (fwdCell.titleEn||fwdCell.titleEs||''))
      : ''
    if (fwdTitle && fwdDist < 6.5) {
      const a   = Math.min(0.82, Math.max(0.05, (6.5-fwdDist)/6.5))
      const wH  = Math.min(H*1.8, H*PROJ_DIST/Math.max(0.1,fwdDist))
      const fs  = Math.max(7, Math.round(11*PROJ_DIST/Math.max(0.5,fwdDist)))
      ctx.globalAlpha = a
      ctx.font = `bold ${fs}px monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = fwdCell.color || C
      ctx.fillText(fwdTitle, W/2, horizon + wH*0.14)
      ctx.globalAlpha = 1
    }

    // Hex address label (scales with proximity)
    const fwdHex = fwdMx>=0&&fwdMy>=0 ? (fwdCell?.blockHex||gridToBlockHex(fwdMy,fwdMx)) : null
    if (fwdHex && fwdDist < 4.0) {
      const a   = Math.max(0,(4.0-fwdDist)/4.0)*0.52
      const wH  = Math.min(H*1.8,H*PROJ_DIST/Math.max(0.1,fwdDist))
      const fs  = Math.max(7,Math.round(12*PROJ_DIST/Math.max(0.3,fwdDist)))
      ctx.globalAlpha = a
      ctx.font = `bold ${fs}px monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = fwdCell?.color || C
      ctx.fillText(fwdHex, W/2, horizon - wH*0.32)
      ctx.globalAlpha = 1
    }

    // Owner label on wall (near distance)
    if (fwdCell?.owner && fwdDist < 3.8) {
      const ownerText = isMineWall
        ? (es ? '[ TUYO ]' : '[ YOURS ]')
        : `[ ${fwdCell.owner.slice(0,6)}…${fwdCell.owner.slice(-4)} ]`
      const a   = Math.max(0, (3.8-fwdDist)/3.8)*0.68
      const wH  = Math.min(H*1.8,H*PROJ_DIST/Math.max(0.1,fwdDist))
      const fs  = Math.max(6, Math.round(9*PROJ_DIST/Math.max(0.4,fwdDist)))
      ctx.globalAlpha = a
      ctx.font = `${fs}px monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = fwdCell.color
      ctx.fillText(ownerText, W/2, horizon - wH*0.46)
      ctx.globalAlpha = 1
    }

    // Price tag on wall
    if (fwdCell?.priceEur > 0 && !fwdCell.owner && fwdDist < 4.5) {
      const a   = Math.max(0,(4.5-fwdDist)/4.5)*0.72
      const wH  = Math.min(H*1.8,H*PROJ_DIST/Math.max(0.1,fwdDist))
      const fs  = Math.max(7,Math.round(10*PROJ_DIST/Math.max(0.5,fwdDist)))
      ctx.globalAlpha = a
      ctx.font = `bold ${fs}px monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#fb923c'
      ctx.fillText(`${fwdCell.priceEur} EUR`, W/2, horizon + wH*0.30)
      ctx.globalAlpha = 1
    }

    // Inspect prompt when very close
    if (fwdDist < 0.9 && fwdCell && !fwdCell.owner) {
      ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillStyle = C + 'cc'
      ctx.fillText(es ? '[ ↵ MINAR BLOQUE ]' : '[ ↵ MINE BLOCK ]', W/2, horizon+18)
    }

    // ── Gap crosshair (Doom-style) ────────────────────────────────────────────
    const hasTarget = fwdMx >= 0 && fwdMy >= 0 && fwdCell !== null
    const xhCol  = hasTarget ? ((fwdCell?.owner ? fwdCell.color : C) + 'cc') : (C + '44')
    const xhLen  = 9, xhGap = 3
    ctx.strokeStyle = xhCol; ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(W/2-xhLen-xhGap, horizon); ctx.lineTo(W/2-xhGap, horizon)
    ctx.moveTo(W/2+xhGap, horizon);       ctx.lineTo(W/2+xhLen+xhGap, horizon)
    ctx.moveTo(W/2, horizon-xhLen-xhGap); ctx.lineTo(W/2, horizon-xhGap)
    ctx.moveTo(W/2, horizon+xhGap);       ctx.lineTo(W/2, horizon+xhLen+xhGap)
    ctx.stroke()
    if (hasTarget) {
      ctx.fillStyle = xhCol
      ctx.beginPath(); ctx.arc(W/2, horizon, 1.5, 0, Math.PI*2); ctx.fill()
    }

    // ── Room entry notification ───────────────────────────────────────────────
    const notif = notifRef.current
    if (notif) {
      const elapsed=Date.now()-notif.startedAt, fadeMs=2800
      if (elapsed<fadeMs) {
        const t=elapsed/fadeMs
        const a=t<0.12?t/0.12:t<0.7?1:1-(t-0.7)/0.3
        ctx.globalAlpha=a
        ctx.font='bold 12px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'
        const tw=Math.min(ctx.measureText(notif.text).width+28,W*0.72)
        const bx=W/2-tw/2, by=horizon-62, bh=24
        ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(bx,by,tw,bh)
        ctx.strokeStyle=notif.color; ctx.lineWidth=1; ctx.strokeRect(bx,by,tw,bh)
        ctx.fillStyle=notif.color; ctx.fillText(notif.text,W/2,by+bh/2)
        ctx.globalAlpha=1
      } else notifRef.current=null
    }

    // ── HUD: current room (top-left) ──────────────────────────────────────────
    const curHex = gridToBlockHex(gr,gc)
    ctx.textAlign='left'; ctx.textBaseline='top'
    ctx.fillStyle = C+'99'; ctx.font='bold 10px monospace'
    ctx.fillText(curHex, 10, 10)
    if (curCell?.emoji) {
      ctx.font='12px serif'; ctx.fillText(curCell.emoji, 10, 24)
    }
    if (curCell?.owner) {
      const ownLabel = myWallet && curCell.owner.toLowerCase()===myWallet.toLowerCase()
        ? (es?'🔑 TUYO':'🔑 YOURS') : `${curCell.owner.slice(0,6)}…${curCell.owner.slice(-4)}`
      ctx.fillStyle = curCell.color+'88'; ctx.font='9px monospace'
      ctx.fillText(ownLabel, 10, curCell.emoji ? 40 : 24)
    }

    // Controls hint (very dim, top-center)
    ctx.textAlign='center'; ctx.fillStyle='#152230'; ctx.font='8px monospace'
    ctx.fillText(
      es ? 'WASD·mover  Q/E·girar  drag·rotar  ↵·acción'
         : 'WASD·move  Q/E·turn  drag·look  ↵·action',
      W/2, 10
    )

    // ── Facing block info HUD (top-right) ─────────────────────────────────────
    drawFacingHUD(ctx, W, H, fwdCell, fwdMx, fwdMy, myWallet, es)

    drawMinimap(ctx,gr,gc,angle,cellMap,presence,myWallet,W,H)
  }, [])

  useEffect(()=>{ renderRef.current=renderFrame },[renderFrame])

  // Canvas resize
  useEffect(()=>{
    const canvas=canvasRef.current, container=containerRef.current
    if (!canvas||!container) return
    const resize=()=>{
      const {width,height}=container.getBoundingClientRect()
      canvas.width=Math.round(width); canvas.height=Math.round(height)
      zBufferRef.current=null
      renderRef.current?.()
    }
    resize()
    const ro=new ResizeObserver(resize); ro.observe(container)
    return ()=>ro.disconnect()
  },[])

  useEffect(()=>{ renderRef.current?.() },[cellMap,presenceMap])

  // Keyboard
  useEffect(()=>{
    const dn=(e)=>{
      const k=keysRef.current
      if(e.key==='w'||e.key==='W'||e.key==='ArrowUp')   {k.w=true;e.preventDefault()}
      if(e.key==='s'||e.key==='S'||e.key==='ArrowDown') {k.s=true;e.preventDefault()}
      if(e.key==='a'||e.key==='A')                        k.a=true
      if(e.key==='d'||e.key==='D')                        k.d=true
      if(e.key==='q'||e.key==='Q'||e.key==='ArrowLeft') {k.q=true;e.preventDefault()}
      if(e.key==='e'||e.key==='E'||e.key==='ArrowRight'){k.e=true;e.preventDefault()}
      if(e.key==='Enter'){
        const url=actionUrlRef.current
        if(url) onWantNavRef.current?.(url)
        e.preventDefault()
      }
    }
    const up=(e)=>{
      const k=keysRef.current
      if(e.key==='w'||e.key==='W'||e.key==='ArrowUp')    k.w=false
      if(e.key==='s'||e.key==='S'||e.key==='ArrowDown')  k.s=false
      if(e.key==='a'||e.key==='A')                        k.a=false
      if(e.key==='d'||e.key==='D')                        k.d=false
      if(e.key==='q'||e.key==='Q'||e.key==='ArrowLeft')  k.q=false
      if(e.key==='e'||e.key==='E'||e.key==='ArrowRight') k.e=false
    }
    window.addEventListener('keydown',dn); window.addEventListener('keyup',up)
    return ()=>{ window.removeEventListener('keydown',dn); window.removeEventListener('keyup',up) }
  },[])

  // Pointer drag → rotate
  const handlePointerDown = useCallback((e)=>{
    canvasRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, type: e.pointerType }
  },[])
  const handlePointerMove = useCallback((e)=>{
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    dragRef.current.x = e.clientX
    const sens = dragRef.current.type === 'touch' ? 0.006 : 0.003
    playerRef.current.angle += dx * sens
    renderRef.current?.()
  },[])
  const handlePointerUp = useCallback(()=>{ dragRef.current=null },[])

  // Game loop
  useEffect(()=>{
    const loop=()=>{
      const k=keysRef.current, p=playerRef.current
      let needsRender=false

      if(k.q){p.angle-=TURN_SPD;needsRender=true}
      if(k.e){p.angle+=TURN_SPD;needsRender=true}

      const fwd=(k.w?1:0)-(k.s?1:0), str=(k.d?1:0)-(k.a?1:0)
      if(fwd||str){
        const nx=p.x+(Math.cos(p.angle)*fwd+Math.cos(p.angle+Math.PI/2)*str)*MOVE_SPD
        const ny=p.y+(Math.sin(p.angle)*fwd+Math.sin(p.angle+Math.PI/2)*str)*MOVE_SPD
        const R=PLAYER_R*CELL_SIZE
        const inBX=nx>R&&nx<WORLD_W-R, inBY=ny>R&&ny<WORLD_H-R
        const ngx=nx/CELL_SIZE, ngy=ny/CELL_SIZE
        const cgx=p.x/CELL_SIZE, cgy=p.y/CELL_SIZE
        // Full move, else wall-slide on each axis independently
        if(inBX&&inBY&&!hitsSolidWall(ngx,ngy)){ p.x=nx; p.y=ny }
        else{
          if(inBX&&!hitsSolidWall(ngx,cgy)) p.x=nx
          if(inBY&&!hitsSolidWall(cgx,ngy)) p.y=ny
        }
        walkDistRef.current+=MOVE_SPD
        needsRender=true

        // Footstep every ~1.8 walk units (~10 frames at 60fps → ~160ms interval)
        const steps=Math.floor(walkDistRef.current/1.8)
        if(steps!==stepCountRef.current){stepCountRef.current=steps;playStep(audioCtxRef)}

        const {row:newRow,col:newCol}=worldToGrid(p.x,p.y)
        const last=lastCellRef.current
        if(newRow!==last.row||newCol!==last.col){
          lastCellRef.current={row:newRow,col:newCol}
          onPositionChange?.(newRow,newCol)
          const entered=cellMapRef.current.get(`${newRow},${newCol}`)
          const hex=gridToBlockHex(newRow,newCol)
          const loc=esRef.current
          const title=loc?(entered?.titleEs||entered?.titleEn||''):(entered?.titleEn||entered?.titleEs||'')
          const who=entered?.owner?`${entered.owner.slice(0,6)}…`:(loc?'libre':'unclaimed')
          notifRef.current={
            text:[entered?.emoji,hex,title||who].filter(Boolean).join(' · '),
            color:entered?.color||C,
            startedAt:Date.now(),
          }
        }
      }

      // Facing detection + action URL update
      const {cell:fc,mx:fmx,my:fmy}=castRay(p.x,p.y,p.angle,cellMapRef.current)
      const newKey=`${fmy},${fmx}`
      if(newKey!==facingKeyRef.current){
        facingKeyRef.current=newKey
        if(fmx>=0&&fmy>=0){
          onFacingChange?.(fmy,fmx,fc)
          // Compute action URL for Enter key
          if(fc){
            const hex=fc.blockHex||gridToBlockHex(fmy,fmx)
            if(!fc.owner){
              actionUrlRef.current=`/relaying?command=${encodeURIComponent(`/mine ${hex}`)}`
            } else {
              actionUrlRef.current=null
            }
          } else {
            actionUrlRef.current=null
          }
        } else {
          actionUrlRef.current=null
        }
        needsRender=true
      }

      if(notifRef.current&&(Date.now()-notifRef.current.startedAt)<2800) needsRender=true
      if(needsRender) renderRef.current?.()

      animRef.current=requestAnimationFrame(loop)
    }
    animRef.current=requestAnimationFrame(loop)
    return ()=>cancelAnimationFrame(animRef.current)
  },[onPositionChange,onFacingChange])

  const dBtn=(key,lbl)=>({
    onPointerDown:(e)=>{e.preventDefault();keysRef.current[key]=true},
    onPointerUp:  (e)=>{e.preventDefault();keysRef.current[key]=false},
    onPointerLeave:()=>{keysRef.current[key]=false},
    style:{
      width:52,height:52,background:'rgba(34,211,238,0.08)',
      border:'1px solid #22d3ee2a',borderRadius:10,color:'#22d3ee88',
      fontSize:'1.2rem',cursor:'pointer',display:'flex',
      alignItems:'center',justifyContent:'center',
      userSelect:'none',fontFamily:'monospace',touchAction:'none',
      WebkitTapHighlightColor:'transparent',
    },
    children:lbl,
  })

  return (
    <div ref={containerRef} style={{width:'100%',height:'100%',position:'relative',background:'#020610'}}>
      <canvas ref={canvasRef} tabIndex={0}
        style={{display:'block',width:'100%',height:'100%',outline:'none',touchAction:'none'}}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {/* Mobile D-pad */}
      <div style={{
        position:'absolute',bottom:16,left:16,
        display:'flex',flexDirection:'column',gap:4,
        pointerEvents:'auto',userSelect:'none',
      }}>
        <div style={{display:'flex',justifyContent:'center'}}><button {...dBtn('w','▲')} /></div>
        <div style={{display:'flex',gap:4}}>
          <button {...dBtn('a','◀')} />
          <button {...dBtn('s','▼')} />
          <button {...dBtn('d','▶')} />
        </div>
        <p style={{
          margin:'4px 0 0',textAlign:'center',
          color:'#22d3ee22',fontSize:'0.55rem',
          fontFamily:'monospace',letterSpacing:'0.06em',pointerEvents:'none',
        }}>{es?'DRAG·ROTAR':'DRAG·LOOK'}</p>
      </div>
    </div>
  )
}
