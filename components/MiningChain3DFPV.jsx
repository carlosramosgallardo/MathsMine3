'use client'

import { useEffect, useRef, useCallback } from 'react'
import { colorFromAddress } from '@/lib/wallet-colors'
import { MM3_BLOCK_GRID_ROWS, MM3_BLOCK_GRID_COLS, gridToBlockHex } from '@/lib/mm3-block-chain'

const ROWS = MM3_BLOCK_GRID_ROWS
const COLS = MM3_BLOCK_GRID_COLS
const C    = '#22d3ee'

const CELL_SIZE     = 40     // world units per grid cell — large for future in-cell building
const WORLD_W       = COLS * CELL_SIZE
const WORLD_H       = ROWS * CELL_SIZE
const STRIP_W       = 3
const FOV           = Math.PI / 2
const PROJ_DIST     = 0.65
const MOVE_SPD      = 4.0    // world units/frame → ~10 frames to cross a cell
const TURN_SPD      = 0.040
const DOOR_FRAC     = 0.45
const HORIZON_RATIO = 0.42
const PLAYER_R      = 0.20   // collision radius in grid units (1 unit = 1 cell)
const DOOR_LO       = (1 - DOOR_FRAC) / 2   // 0.275
const DOOR_HI       = (1 + DOOR_FRAC) / 2   // 0.725
const FOOTSTEP_DIST = MOVE_SPD * 10         // footstep every ~10 movement frames
const SWING_DUR     = 340    // ms per pickaxe swing
const HITS_NEEDED   = 5      // swings to complete mining action
const INTERACT_DIST = 2.5    // grid cells — max distance for block interaction
const CHAIN_NODE_ROW = 4     // fallback; runtime position comes from cellMap
const CHAIN_NODE_COL = 4

// ── Decorative obstacles: solid walls, no doorways, not mineable ──────────────
// Three visual types: monolith (violet), pylon (teal), ruin (rust)
const OBSTACLE_MAP = new Map([
  // Violet monoliths — outer corners
  ['5,5',   { base:[120,40,200], label:'MONOLITH' }],
  ['5,22',  { base:[120,40,200], label:'MONOLITH' }],
  ['22,5',  { base:[120,40,200], label:'MONOLITH' }],
  ['22,22', { base:[120,40,200], label:'MONOLITH' }],
  // Teal pylons — inner ring
  ['10,14', { base:[30,150,140], label:'TECH PYLON' }],
  ['14,9',  { base:[30,150,140], label:'TECH PYLON' }],
  ['17,14', { base:[30,150,140], label:'TECH PYLON' }],
  ['14,19', { base:[30,150,140], label:'TECH PYLON' }],
  // Rust ruins — scattered mid-zones
  ['8,18',  { base:[160,60,20],  label:'ANCIENT RUIN' }],
  ['19,9',  { base:[160,60,20],  label:'ANCIENT RUIN' }],
  ['9,8',   { base:[160,60,20],  label:'ANCIENT RUIN' }],
  ['20,20', { base:[160,60,20],  label:'ANCIENT RUIN' }],
])

// ── Wall collision: returns true if position (grid units) hits a solid wall ──
// cellMap + obsSet distinguish empty corridors (passable) from block/obstacle cells
function hitsSolidWall(gx, gy, cellMap, obsSet) {
  const col = Math.floor(gx), row = Math.floor(gy)
  const key = `${row},${col}`
  if (obsSet?.has(key)) return true   // Decorative obstacle: always solid
  if (!cellMap?.has(key)) return false     // Empty corridor: always passable
  // Block cell with data: standard centre-doorway collision
  const fx = gx - col, fy = gy - row
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

function wallRgb(cell, dist, side, myWallet) {
  if (cell?.isObstacle) {
    const [r,g,b] = cell.base || [40,25,65]
    const f = (side === 1 ? 0.72 : 1.0) * Math.max(0.14, 1 - dist * 0.055)
    return [Math.round(r*f), Math.round(g*f), Math.round(b*f)]
  }
  if (cell?.isChainNode) {
    const pulse = 0.60 + Math.sin(Date.now() / 300) * 0.40
    const f = (side === 1 ? 0.72 : 1.0) * Math.max(0.18, 1 - dist * 0.06) * pulse
    return [Math.round(255 * f), Math.round(180 * f), 0]
  }
  let base
  if (cell?.owner) {
    const isMe = myWallet && cell.owner.toLowerCase() === myWallet.toLowerCase()
    if (isMe) {
      // My block: bright cyan-white
      base = [60, 200, 230]
    } else {
      // Someone else's block: their wallet color, slightly saturated
      const [r,g,b] = hexToRgb(cell.color)
      base = [Math.min(255,r*1.15|0), Math.min(255,g*1.15|0), Math.min(255,b*1.15|0)]
    }
  } else if (cell?.isMarket) {
    // Unowned NFTJI block: amber/gold draws attention.
    base = [200, 110, 20]
  } else if (cell) {
    // Unclaimed regular block: slate-blue, mineable
    base = [30, 60, 130]
  } else {
    // Empty / void
    base = [10, 18, 42]
  }
  const [r,g,b] = base
  const f = (side === 1 ? 0.72 : 1.0) * Math.max(0.14, 1 - dist * 0.065)
  return [Math.round(r*f), Math.round(g*f), Math.round(b*f)]
}

function worldToGrid(wx, wy) {
  return { row: Math.floor(wy / CELL_SIZE), col: Math.floor(wx / CELL_SIZE) }
}

// ── DDA with centre-doorways ──────────────────────────────────────────────────
function castRay(wx, wy, angle, cellMap, obsSet) {
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
    const key = `${my},${mx}`
    // Decorative obstacle: solid wall, no doorway — always a hit
    const obsData = obsSet?.has(key) ? OBSTACLE_MAP.get(key) : null
    if (obsData) return {perpDist, cell:{isObstacle:true,base:obsData.base,label:obsData.label}, side, mx, my}
    // Doorway check for block cells
    const hitFrac = (((side===0?py+perpDist*dy:px+perpDist*dx)%1.0)+1.0)%1.0
    const lo=(1-DOOR_FRAC)/2, hi=(1+DOOR_FRAC)/2
    if (hitFrac<lo||hitFrac>hi) {
      const cell = cellMap.get(key) || null
      if (!cell) continue  // Empty corridor: ray passes through
      return {perpDist, cell, side, mx, my}
    }
  }
  return {perpDist:ROWS+COLS, cell:null, side:0, mx:-1, my:-1}
}

// ── Minimap ───────────────────────────────────────────────────────────────────
function drawMinimap(ctx, gr, gc, angle, cellMap, presenceMap, myWallet, W, H, chainNodePos) {
  const isMobile = W < 600
  const SZ = isMobile ? Math.min(W*0.38, 110) : Math.min(130, W*0.2)
  const CS = SZ/ROWS
  const MX = W - SZ - 6
  const MY = 8

  ctx.fillStyle = 'rgba(0,0,0,0.85)'
  ctx.fillRect(MX-1,MY-1,SZ+2,SZ+2)
  ctx.strokeStyle = C+'33'; ctx.lineWidth=0.5
  ctx.strokeRect(MX-1,MY-1,SZ+2,SZ+2)

  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    const key = `${r},${c}`
    const cell = cellMap.get(key)
    const obs  = OBSTACLE_MAP.get(key)
    if (obs) {
      const [or,og,ob] = obs.base
      ctx.fillStyle = `rgba(${or>>1},${og>>1},${ob>>1},0.85)`
    } else if (cell?.owner) {
      ctx.fillStyle = cell.color+'bb'
    } else if (cell?.isMarket) {
      ctx.fillStyle = C+'55'
    } else if (cell?.isChainNode) {
      ctx.fillStyle = '#ffd70033'
    } else {
      ctx.fillStyle = '#050810'  // open corridor: very dark
    }
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
    if (p.row==null && p.gy==null) continue
    const isMe = w.toLowerCase()===(myWallet||'').toLowerCase()
    // Use sub-cell precision if available
    const dotGX = p.gx ?? ((p.col??0) + 0.5)
    const dotGY = p.gy ?? ((p.row??0) + 0.5)
    const col = colorFromAddress(w)
    const r = isMe ? CS*2.0 : CS*1.5
    // Glow ring for others
    if (!isMe) {
      ctx.strokeStyle = col + 'aa'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(MX+dotGX*CS, MY+dotGY*CS, r+1.5, 0, Math.PI*2)
      ctx.stroke()
    }
    ctx.fillStyle = isMe ? C : col
    ctx.beginPath()
    ctx.arc(MX+dotGX*CS, MY+dotGY*CS, r, 0, Math.PI*2)
    ctx.fill()
  }

  // Chain node: diamond crosshair — visually distinct landmark (static, not a dot)
  const cnPos   = chainNodePos || { row: CHAIN_NODE_ROW, col: CHAIN_NODE_COL }
  const cnPulse = 0.55 + Math.sin(Date.now() / 600) * 0.45
  const cnx = MX + (cnPos.col + 0.5) * CS
  const cny = MY + (cnPos.row + 0.5) * CS
  const armLen = CS * 2.8
  const gapR   = CS * 0.85
  // Outer pulsing ring
  ctx.globalAlpha = cnPulse * 0.28
  ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.arc(cnx, cny, CS * 2.1, 0, Math.PI*2); ctx.stroke()
  // Four crosshair arms with gap
  ctx.globalAlpha = Math.max(0.55, cnPulse)
  ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.moveTo(cnx - gapR, cny); ctx.lineTo(cnx - armLen, cny)
  ctx.moveTo(cnx + gapR, cny); ctx.lineTo(cnx + armLen, cny)
  ctx.moveTo(cnx, cny - gapR); ctx.lineTo(cnx, cny - armLen)
  ctx.moveTo(cnx, cny + gapR); ctx.lineTo(cnx, cny + armLen)
  ctx.stroke()
  // Center diamond (rotated square)
  ctx.globalAlpha = Math.max(0.70, cnPulse)
  ctx.fillStyle = '#ffd700'
  ctx.save(); ctx.translate(cnx, cny); ctx.rotate(Math.PI / 4)
  const ds = CS * 0.52
  ctx.fillRect(-ds, -ds, ds*2, ds*2)
  ctx.restore()
  ctx.globalAlpha = 1
}

// ── Facing block HUD (top-right info card) ────────────────────────────────────
function drawFacingHUD(ctx, W, H, fwdCell, fwdMx, fwdMy, myWallet, es, dist) {
  if (fwdMx < 0 || fwdMy < 0 || fwdMx >= COLS || fwdMy >= ROWS) return

  // Decorative obstacle: show type name, no interaction
  if (fwdCell?.isObstacle) {
    const hex = gridToBlockHex(fwdMy, fwdMx)
    const [or,og,ob] = fwdCell.base || [40,25,65]
    const color = `rgb(${or},${og},${ob})`
    const lines = [
      { text: `⬙  ${hex}`, size: 13, weight: 'bold', col: color },
      { text: fwdCell.label || 'STRUCTURE', size: 11, col: '#c7d8e2' },
      { text: es ? '· no interactivo' : '· non-interactive', size: 10, col: '#5b7890' },
    ]
    const lineH=16, padX=9, padY=8, ph=lines.length*lineH+padY*2
    const pw=Math.min(W*0.32,240), px=W-pw-8, py=8
    ctx.globalAlpha=0.90; ctx.fillStyle='#010709'; ctx.fillRect(px,py,pw,ph); ctx.globalAlpha=1
    ctx.lineWidth=1; ctx.strokeStyle=color+'55'; ctx.strokeRect(px,py,pw,ph)
    ctx.fillStyle=color+'77'; ctx.fillRect(px,py,2,ph)
    ctx.textAlign='left'; ctx.textBaseline='top'
    for (let i=0;i<lines.length;i++){
      const l=lines[i]; ctx.font=`${l.weight||'normal'} ${l.size}px monospace`
      ctx.fillStyle=l.col; ctx.fillText(l.text,px+padX,py+padY+i*lineH,pw-padX*2)
    }
    return
  }

  const hex   = fwdCell?.blockHex || gridToBlockHex(fwdMy, fwdMx)
  const title = fwdCell
    ? (es ? (fwdCell.titleEs || fwdCell.titleEn || '') : (fwdCell.titleEn || fwdCell.titleEs || ''))
    : ''
  const owner  = fwdCell?.owner || null
  const isMine = myWallet && owner?.toLowerCase() === myWallet.toLowerCase()
  const color  = fwdCell?.color || C

  const lines = []
  const epfx  = fwdCell?.emoji ? `${fwdCell.emoji}  ` : ''
  lines.push({ text: `${epfx}${hex}`, size: 13, weight: 'bold', col: color })
  if (title) lines.push({ text: title, size: 11, col: '#c7d8e2' })

  if (owner) {
    lines.push({
      text: isMine
        ? (es ? '🔑 Tu bloque' : '🔑 Yours')
        : `◈ ${owner.slice(0,6)}…${owner.slice(-4)}`,
      size: 11, col: isMine ? C : color + 'dd',
    })
  } else if (fwdCell?.isMarket) {
    lines.push({ text: es ? '○ NFTJI libre' : '○ Free NFTJI', size: 11, col: '#5b8aa3' })
  } else if (fwdCell) {
    lines.push({ text: es ? '○ Sin reclamar' : '○ Unclaimed', size: 11, col: '#5b7890' })
  } else {
    // Unclaimed block not in DB (never touched)
    lines.push({ text: es ? '○ Sin reclamar' : '○ Unclaimed', size: 11, col: '#5b7890' })
  }

  if (fwdCell?.priceEur > 0) {
    lines.push({ text: `${fwdCell.priceEur} EUR`, size: 11, weight: 'bold', col: '#fb923c' })
  }

  if (dist != null && !fwdCell?.isObstacle) {
    const distCol = dist <= INTERACT_DIST ? '#4ade8077' : '#3d5a6a'
    lines.push({ text: `${dist.toFixed(1)} cells`, size: 9, col: distCol })
  }

  if (!owner) {
    const inRange = dist == null || dist <= INTERACT_DIST
    if (fwdCell?.isChainNode) {
      lines.push(inRange
        ? { text: es ? '↵ · Resolver cadena' : '↵ · Solve formula chain', size: 10, col: '#ffd700cc' }
        : { text: es ? '· acercarse para interactuar' : '· move closer to interact', size: 9, col: '#ffd70055' })
    } else {
      lines.push(inRange
        ? { text: es ? '↵ · Minar bloque' : '↵ · Mine block', size: 10, col: C + 'cc' }
        : { text: es ? '· acercarse para minar' : '· move closer to mine', size: 9, col: C + '55' })
    }
  } else if (owner && fwdCell?.isMarket) {
    const isMineWall = myWallet && owner.toLowerCase() === myWallet.toLowerCase()
    if (isMineWall) {
      lines.push({ text: es ? '↵ · Revender NFTJI' : '↵ · Resell NFTJI', size: 10, col: '#4ade80cc' })
    }
  }

  const lineH = 16, padX = 9, padY = 8
  const ph = lines.length * lineH + padY * 2
  const pw = Math.min(W * 0.32, 240)
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

// ── Pickaxe sounds ──────────────────────────────────────────────────────────
function playPickHit(audioCtxRef, type) {
  try {
    if (!audioCtxRef.current)
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume().catch(()=>{})
    const t = ctx.currentTime

    if (type === 'nftji') {
      // Metallic ring: two sine waves
      [[1300, 0.20], [2000, 0.07]].forEach(([freq, vol], i) => {
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, t)
        osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.22)
        g.gain.setValueAtTime(vol, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.26)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(t); osc.stop(t + 0.28)
      })
    } else if (type === 'mine') {
      // Rock thud: noise burst through low bandpass
      const sr = ctx.sampleRate
      const buf = ctx.createBuffer(1, Math.ceil(sr * 0.14), sr)
      const d   = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++)
        d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 1.4)
      const src = ctx.createBufferSource(); src.buffer = buf
      const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=160; f.Q.value=4
      const g = ctx.createGain(); g.gain.value = 0.45
      src.connect(f); f.connect(g); g.connect(ctx.destination); src.start()
    } else if (type === 'complete') {
      // Ascending chime
      [523, 659, 784, 1047].forEach((freq, i) => {
        const ts = t + i * 0.09
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'triangle'; osc.frequency.value = freq
        g.gain.setValueAtTime(0.14, ts)
        g.gain.exponentialRampToValueAtTime(0.001, ts + 0.22)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(ts); osc.stop(ts + 0.25)
      })
    } else {
      // Empty swing: dry click
      const sr = ctx.sampleRate
      const buf = ctx.createBuffer(1, Math.ceil(sr * 0.03), sr)
      const d   = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++)
        d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 7)
      const src = ctx.createBufferSource(); src.buffer = buf
      const g = ctx.createGain(); g.gain.value = 0.06
      src.connect(g); g.connect(ctx.destination); src.start()
    }
  } catch {}
}

// ── Pickaxe (first-person weapon) ───────────────────────────────────────────
function drawPickaxe(ctx, W, H, swingT, walkDist) {
  // Size: 28% of the shorter canvas dimension, capped at 170px
  const BASE = Math.min(W, H)
  const L    = Math.min(BASE * 0.28, 170)
  const hw   = Math.max(3, L * 0.052)

  const bob = Math.sin(walkDist * 0.5) * 5

  // At rest angle -2.3 rad: cos≈-0.667, sin≈-0.746.
  // We target the HEAD at (headX, headY) and derive anchor from that.
  const baseA = -2.3
  const mobile = W < 640
  // Head sits at 58% width / 60% height — clearly visible, not too close to any edge
  const headTargetX = W * (mobile ? 0.50 : 0.58) + bob * 0.25
  const headTargetY = H * (mobile ? 0.60 : 0.62) + Math.abs(bob) * 0.3
  const ax = headTargetX - Math.cos(baseA) * L
  const ay = headTargetY - Math.sin(baseA) * L

  const swingPhase = Math.sin(swingT * Math.PI)
  const a = baseA + swingPhase * 1.55

  ctx.save()
  ctx.globalAlpha = 0.92
  ctx.translate(ax, ay)
  ctx.rotate(a)

  // Handle shadow
  ctx.fillStyle = 'rgba(0,0,0,0.38)'
  ctx.fillRect(hw * 0.3, hw * 0.6, L, hw * 1.8)

  // Handle (wood)
  const hg = ctx.createLinearGradient(0, -hw, L, hw)
  hg.addColorStop(0, '#7a4f20'); hg.addColorStop(0.35, '#a06b30')
  hg.addColorStop(0.7, '#7a4f20'); hg.addColorStop(1, '#3d2510')
  ctx.fillStyle = hg
  ctx.fillRect(0, -hw, L, hw * 2)

  // Wood grain
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.5
  for (let i = 0; i < 3; i++) {
    const gx = L * (0.18 + i * 0.26)
    ctx.beginPath(); ctx.moveTo(gx, -hw * 0.7); ctx.lineTo(gx + L * 0.03, hw * 0.7); ctx.stroke()
  }

  // Head
  ctx.translate(L, 0)
  const hh   = hw * 3.4
  const hext = hw * 3.8
  const mg   = ctx.createLinearGradient(-hext, -hh, hext * 0.8, hh)
  mg.addColorStop(0, '#dceaf6'); mg.addColorStop(0.28, '#98afc2')
  mg.addColorStop(0.65, '#5d7080'); mg.addColorStop(1, '#374249')
  ctx.fillStyle = mg; ctx.strokeStyle = '#aac8dc'; ctx.lineWidth = 0.8

  // Long mining spike (left) — main striking end
  ctx.beginPath()
  ctx.moveTo(-hw * 0.3, -hh * 0.58)
  ctx.lineTo(-hext * 1.0, -hh * 0.72)
  ctx.lineTo(-hext * 1.28, hh * 0.04)
  ctx.lineTo(-hext * 1.0, hh * 0.52)
  ctx.lineTo(-hw * 0.3, hh * 0.58)
  ctx.closePath(); ctx.fill(); ctx.stroke()

  // Center body
  ctx.fillRect(-hw * 0.35, -hh * 0.75, hw * 0.7, hh * 1.5)
  ctx.strokeRect(-hw * 0.35, -hh * 0.75, hw * 0.7, hh * 1.5)

  // Short blunt end (right)
  ctx.beginPath()
  ctx.moveTo(hw * 0.3, -hh * 0.48)
  ctx.lineTo(hext * 0.78, -hh * 0.68)
  ctx.lineTo(hext * 0.92, 0)
  ctx.lineTo(hext * 0.78, hh * 0.48)
  ctx.lineTo(hw * 0.3, hh * 0.48)
  ctx.closePath(); ctx.fill(); ctx.stroke()

  // Highlight on spike tip
  ctx.fillStyle = 'rgba(235,248,255,0.72)'
  ctx.beginPath()
  ctx.moveTo(-hext * 0.88, -hh * 0.48)
  ctx.lineTo(-hext * 1.22, hh * 0.02)
  ctx.lineTo(-hext * 0.96, -hh * 0.42)
  ctx.closePath(); ctx.fill()

  ctx.restore()
}

// ── Mining progress arc ──────────────────────────────────────────────────────
function drawMineProgress(ctx, W, H, progress, type) {
  if (progress <= 0) return
  const cx = W / 2, cy = H * HORIZON_RATIO
  const r   = 24
  const col = type === 'nftji' ? '#fb923c' : C
  const s   = -Math.PI / 2

  ctx.globalAlpha = 0.28
  ctx.strokeStyle = col; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()

  ctx.globalAlpha = 0.88
  ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy, r, s, s + progress * Math.PI * 2); ctx.stroke()
  ctx.lineCap = 'butt'

  ctx.globalAlpha = 0.65
  ctx.fillStyle = col; ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(`${Math.round(progress * 100)}%`, cx, cy + r + 10)
  ctx.globalAlpha = 1
}

// ── MM3 Block Chain stats panel (bottom-left HUD) ───────────────────────────
function drawChainStats(ctx, W, H, stats, es) {
  if (!stats) return
  const { owned, marketFree, marketOwned, total, pct } = stats

  const lines = [
    { label: es ? 'CADENA MM3' : 'MM3 CHAIN', val: null, header: true },
    { label: es ? 'Reclamados' : 'Claimed', val: `${owned} / ${total}` },
    { label: es ? 'NFTJI libres' : 'Free NFTJI', val: String(marketFree) },
    { label: es ? 'NFTJI vendidos' : 'Owned NFTJI', val: String(marketOwned) },
  ]

  const LINE_H = 13, PAD_X = 8, PAD_Y = 6
  const pw = 158, ph = lines.length * LINE_H + PAD_Y * 2 + 9
  const isMobile = W < 600
  const px = 6
  const py = H - ph - (isMobile ? 210 : 170)

  ctx.globalAlpha = 0.78
  ctx.fillStyle = '#010709'
  ctx.fillRect(px, py, pw, ph)
  ctx.globalAlpha = 1
  ctx.strokeStyle = C + '33'; ctx.lineWidth = 0.5
  ctx.strokeRect(px, py, pw, ph)
  ctx.fillStyle = C + '77'
  ctx.fillRect(px, py, 2, ph)

  // Progress bar for owned%
  const barW = pw - PAD_X * 2
  ctx.fillStyle = '#0a1a22'
  ctx.fillRect(px + PAD_X, py + ph - PAD_Y - 4, barW, 4)
  ctx.fillStyle = C + 'aa'
  ctx.fillRect(px + PAD_X, py + ph - PAD_Y - 4, Math.round(barW * pct / 100), 4)

  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    const { label, val, header } = lines[i]
    const ly = py + PAD_Y + i * LINE_H
    if (header) {
      ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left'
      ctx.fillStyle = C + 'cc'
      ctx.fillText(label, px + PAD_X, ly)
      ctx.font = 'bold 9px monospace'; ctx.textAlign = 'right'
      ctx.fillStyle = '#4ade80cc'
      ctx.fillText(`${pct}%`, px + pw - PAD_X, ly)
    } else {
      ctx.font = '9px monospace'; ctx.textAlign = 'left'
      ctx.fillStyle = '#70879c'
      ctx.fillText(label, px + PAD_X, ly)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#c2d2de'
      ctx.fillText(val, px + pw - PAD_X, ly)
    }
  }
  ctx.textAlign = 'left'; ctx.globalAlpha = 1
}

// ── Online players list (below minimap) ─────────────────────────────────────
function drawOnlineList(ctx, W, H, presenceMap, myWallet, pvpStolen) {
  const isMobile = W < 600
  const SZ = isMobile ? Math.min(W * 0.38, 110) : Math.min(130, W * 0.2)
  const MX = W - SZ - 6
  const MY = 8

  const all = []
  for (const [w, pres] of Object.entries(presenceMap || {})) {
    if (pres.row == null && pres.gy == null) continue
    const isAnon = w.startsWith('anon-')
    all.push({ w, isAnon, stolen: (pvpStolen || {})[w] || 0 })
  }

  const logged = all.filter(e => !e.isAnon).sort((a, b) => b.stolen - a.stolen).slice(0, 5)
  const anon   = all.filter(e =>  e.isAnon).sort((a, b) => b.stolen - a.stolen).slice(0, 5)
  const list   = [...logged, ...anon]
  if (!list.length) return

  const HEADER_H = 15
  const LINE_H   = 13
  const PAD_X    = 7, PAD_Y = 5
  const pw  = SZ + 2
  const ph  = HEADER_H + list.length * LINE_H + PAD_Y * 2
  const px  = MX - 1
  const py  = MY + SZ + 5

  ctx.globalAlpha = 0.82
  ctx.fillStyle = '#010709'
  ctx.fillRect(px, py, pw, ph)
  ctx.globalAlpha = 1
  ctx.strokeStyle = C + '33'; ctx.lineWidth = 0.5
  ctx.strokeRect(px, py, pw, ph)

  ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  ctx.fillStyle = C + 'bb'
  ctx.fillText('ONLINE', px + PAD_X, py + PAD_Y)

  for (let i = 0; i < list.length; i++) {
    const { w, isAnon, stolen } = list[i]
    const ly   = py + PAD_Y + HEADER_H + i * LINE_H
    const isMe = w.toLowerCase() === (myWallet || '').toLowerCase()
    const col  = isMe ? C : isAnon ? '#5a7080' : colorFromAddress(w)
    const label = isAnon
      ? (isMe ? `${w.slice(0, 10)}…` : `anon`)
      : `${w.slice(0, 6)}…${w.slice(-3)}`
    ctx.font = `${isMe ? 'bold ' : ''}9px monospace`
    ctx.textAlign = 'left'
    ctx.fillStyle = col
    ctx.fillText(label, px + PAD_X, ly)
    if (stolen > 0) {
      ctx.fillStyle = '#4ade8099'
      ctx.textAlign = 'right'
      ctx.font = '9px monospace'
      ctx.fillText(`+${stolen.toFixed(2)}`, px + pw - PAD_X, ly)
    }
  }
  ctx.textAlign = 'left'; ctx.globalAlpha = 1
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
export default function MiningChain3DFPV({
  cellMap, presenceMap, myWallet, myColor,
  initRow, initCol, jumpToCell,
  onPositionChange, onFacingChange, onWantNavigate, onPositionRealtime,
  onPvpHit, onAnonReset, pvpStolen,
  onChainSolveOpen, externalPvpFlash,
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
  const walkDistRef        = useRef(0)
  const audioCtxRef        = useRef(null)
  const stepCountRef       = useRef(0)
  const lastRealtimeRef    = useRef(0)
  const notifRef           = useRef(null)
  const facingKeyRef  = useRef(null)
  const actionUrlRef  = useRef(null)
  const cellMapRef    = useRef(cellMap)
  const presenceRef   = useRef(presenceMap)
  const myWalletRef   = useRef(myWallet)
  const esRef         = useRef(es)
  const onWantNavRef  = useRef(onWantNavigate)
  const dragRef       = useRef(null)
  const animRef       = useRef(null)
  const renderRef     = useRef(null)
  const lastCellRef   = useRef({row:initRow??14,col:initCol??14})
  const zBufferRef    = useRef(null)
  // Pickaxe / mining
  const swingStartRef   = useRef(-9999)
  const hitDoneRef      = useRef(false)
  const mineProgressRef = useRef(0)
  const mineTargetRef   = useRef(null)
  const mineTypeRef     = useRef('empty')
  const facingDataRef   = useRef({ mx:-1, my:-1, cell:null })
  // PvP
  const enemyTargetRef  = useRef(null)   // { wallet, dist, isAnon }
  const anonHitsRef     = useRef({})     // { anonKey → hitCount } per session
  const pvpFlashRef     = useRef(0)      // timestamp of last pvp strike (for red flash)
  const pvpGainRef      = useRef(null)   // { text, at } for "+X EUR" popup
  const onPvpHitRef          = useRef(onPvpHit)
  const onAnonResetRef       = useRef(onAnonReset)
  const pvpStolenRef         = useRef(pvpStolen || {})
  const chainStatsRef        = useRef(null)
  const onChainSolveOpenRef  = useRef(onChainSolveOpen)
  // Precomputed from cellMap: obstacle positions valid (≥2 cells from any block)
  // and the actual chain node grid position
  const validObstaclesRef   = useRef(new Set(OBSTACLE_MAP.keys()))
  const chainNodePosRef     = useRef({ row: CHAIN_NODE_ROW, col: CHAIN_NODE_COL })

  // Keep refs in sync with props
  useEffect(()=>{ cellMapRef.current=cellMap },[cellMap])
  useEffect(()=>{ presenceRef.current=presenceMap },[presenceMap])
  useEffect(()=>{ myWalletRef.current=myWallet },[myWallet])
  useEffect(()=>{ esRef.current=es },[es])
  useEffect(()=>{ onWantNavRef.current=onWantNavigate },[onWantNavigate])
  useEffect(()=>{ onPvpHitRef.current=onPvpHit },[onPvpHit])
  useEffect(()=>{ onAnonResetRef.current=onAnonReset },[onAnonReset])
  useEffect(()=>{ pvpStolenRef.current=pvpStolen||{} },[pvpStolen])
  useEffect(()=>{ onChainSolveOpenRef.current=onChainSolveOpen },[onChainSolveOpen])
  // External hit flash (victim sees red screen when struck by another player)
  useEffect(()=>{ if(externalPvpFlash) pvpFlashRef.current=performance.now() },[externalPvpFlash])

  // Recompute valid obstacles and chain node position whenever cellMap changes
  useEffect(() => {
    // Find chain node position from cellMap
    let cnRow = CHAIN_NODE_ROW, cnCol = CHAIN_NODE_COL
    for (const [key, cell] of cellMap) {
      if (cell.isChainNode) {
        const [r,c] = key.split(',').map(Number)
        cnRow = r; cnCol = c; break
      }
    }
    chainNodePosRef.current = { row: cnRow, col: cnCol }
    // Keep only obstacles that have ≥2 cell clearance from every block
    const valid = new Set()
    for (const [key] of OBSTACLE_MAP) {
      const [or, oc] = key.split(',').map(Number)
      let clear = true
      outer: for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nk = `${or+dr},${oc+dc}`
          if (cellMap.has(nk)) { clear = false; break outer }
        }
      }
      if (clear) valid.add(key)
    }
    validObstaclesRef.current = valid
  }, [cellMap])

  useEffect(()=>{
    let owned=0, marketFree=0, marketOwned=0
    for (const cell of cellMap.values()) {
      if (cell.owner) { owned++; if (cell.isMarket) marketOwned++ }
      else if (cell.isMarket) marketFree++
    }
    const total = ROWS * COLS
    chainStatsRef.current = { owned, marketFree, marketOwned, total, pct: Math.round(owned/total*100) }
  },[cellMap])

  const onPositionRealtimeRef = useRef(onPositionRealtime)
  useEffect(()=>{ onPositionRealtimeRef.current=onPositionRealtime },[onPositionRealtime])

  // External teleport
  useEffect(()=>{
    if (!jumpToCell) return
    playerRef.current.x = (jumpToCell.col+0.5)*CELL_SIZE
    playerRef.current.y = (jumpToCell.row+0.5)*CELL_SIZE
    renderRef.current?.()
  },[jumpToCell])

  // ── Render ──────────────────────────────────────────────────────────────────
  const renderFrame = useCallback(()=>{
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Number(canvas.dataset.dpr) || 1
    const W = Math.round(canvas.width / dpr)
    const H = Math.round(canvas.height / dpr)
    if (!W||!H) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false

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
    const {mx:fwdMx,my:fwdMy,cell:fwdCell,perpDist:fwdDist} = castRay(px,py+bob,angle,cellMap,validObstaclesRef.current)

    // Collect cells with emoji visible on any wall face
    const visibleWalls = new Map()

    // ── Wall strips + build zBuffer ───────────────────────────────────────────
    for (let col=0; col<strips; col++){
      const ra = angle - FOV/2 + (col+0.5)*FOV/strips
      const {perpDist,cell,side,mx:hitMx,my:hitMy} = castRay(px,py+bob,ra,cellMap,validObstaclesRef.current)
      const dist  = perpDist*Math.cos(ra-angle)
      const wallH = Math.min(H*1.8, H*PROJ_DIST/Math.max(0.01,dist))
      const wTop  = Math.round(horizon-wallH/2)

      zBuffer[col] = dist

      // Collect emoji cells (all visible wall faces, not just forward)
      if (cell?.emoji && hitMx >= 0 && hitMy >= 0) {
        const k = `${hitMx},${hitMy}`
        const vw = visibleWalls.get(k)
        if (!vw) {
          visibleWalls.set(k, { x1:col*STRIP_W, x2:col*STRIP_W+STRIP_W, wTop, wallH, dist, cell })
        } else {
          vw.x2 = col*STRIP_W+STRIP_W
          if (dist < vw.dist) { vw.dist=dist; vw.wTop=wTop; vw.wallH=wallH }
        }
      }

      const [rw,gw,bw] = wallRgb(cell,dist,side,myWallet)
      ctx.fillStyle=`rgb(${rw},${gw},${bw})`
      ctx.fillRect(col*STRIP_W,wTop,STRIP_W,wallH)

      // NFTJI block patterns
      if (cell?.isMarket) {
        if (!cell.owner) {
          // Unowned NFTJI: amber diagonal stripes.
          const stripeH = Math.max(3, Math.round(wallH/6))
          for (let sy=wTop; sy<wTop+wallH; sy+=stripeH*2) {
            ctx.fillStyle = 'rgba(251,146,60,0.22)'
            ctx.fillRect(col*STRIP_W, sy, STRIP_W, Math.min(stripeH, wTop+wallH-sy))
          }
        } else {
          const isMe = myWallet && cell.owner.toLowerCase() === myWallet.toLowerCase()
          if (isMe) {
            // My NFTJI block: cyan shimmer
            ctx.fillStyle = 'rgba(34,211,238,0.18)'
            ctx.fillRect(col*STRIP_W, wTop, STRIP_W, wallH)
          } else {
            const [mr,mg,mb] = hexToRgb(cell.color)
            ctx.fillStyle = `rgba(${mr},${mg},${mb},0.15)`
            ctx.fillRect(col*STRIP_W, wTop, STRIP_W, wallH)
          }
        }
      }

      // Cube top highlight — bright ledge at wall top
      if (wallH > 8) {
        const hlH = Math.max(2, Math.round(wallH*0.035))
        ctx.fillStyle = 'rgba(255,255,255,0.14)'
        ctx.fillRect(col*STRIP_W, wTop, STRIP_W, hlH)
      }

      // Ambient-occlusion edges
      const edgeH = Math.max(2,Math.round(wallH*0.12))
      ctx.fillStyle='rgba(0,0,0,0.28)'
      ctx.fillRect(col*STRIP_W,wTop,STRIP_W,edgeH)
      ctx.fillRect(col*STRIP_W,wTop+wallH-edgeH,STRIP_W,edgeH)

      // Obstacle structural pattern (horizontal panel lines)
      if (cell?.isObstacle) {
        const [or,og,ob] = cell.base || [40,25,65]
        const panelH = Math.max(4, Math.round(wallH / 5))
        for (let sy = wTop; sy < wTop + wallH; sy += panelH) {
          ctx.fillStyle = `rgba(${Math.round(or*0.35)},${Math.round(og*0.35)},${Math.round(ob*0.35)},0.5)`
          ctx.fillRect(col*STRIP_W, sy, STRIP_W, 1)
        }
      }

      // Chain node shimmer
      if (cell?.isChainNode) {
        const a = (0.14 + Math.sin(Date.now() / 420) * 0.10).toFixed(3)
        ctx.fillStyle = `rgba(255,220,0,${a})`
        ctx.fillRect(col*STRIP_W, wTop, STRIP_W, wallH)
      }

      // Forward-cell selection glow
      if (hitMx===fwdMx && hitMy===fwdMy && fwdMx>=0 && cell){
        ctx.fillStyle='rgba(34,211,238,0.11)'
        ctx.fillRect(col*STRIP_W,wTop,STRIP_W,wallH)
      }

      // CRT scanlines on walls
      ctx.fillStyle='rgba(0,0,0,0.10)'
      for (let sy=wTop;sy<wTop+wallH;sy+=4) ctx.fillRect(col*STRIP_W,sy,STRIP_W,1)
    }

    // ── Emoji on all visible wall faces ──────────────────────────────────────
    for (const vw of visibleWalls.values()) {
      const scrX = (vw.x1 + vw.x2) / 2
      const scrY = vw.wTop + vw.wallH / 2
      const sz   = Math.max(14, Math.round(vw.wallH * 0.46))
      const a    = Math.min(0.92, Math.max(0.1, 1 - vw.dist * 0.065))
      ctx.globalAlpha = a
      ctx.font = `${sz}px serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(vw.cell.emoji, scrX, scrY)
    }
    ctx.globalAlpha = 1

    // ── Presence sprites (retro wallet shape, grounded to floor) ────────────────
    const camGX = px / CELL_SIZE, camGY = py / CELL_SIZE
    const sprites = []
    for (const [w, pres] of Object.entries(presence || {})) {
      if (pres.row == null && pres.gy == null) continue
      const isMe = w.toLowerCase() === (myWallet || '').toLowerCase()
      if (isMe) continue
      const sgx = pres.gx ?? ((pres.col ?? 0) + 0.5)
      const sgy = pres.gy ?? ((pres.row ?? 0) + 0.5)
      const rx = sgx - camGX
      const ry = sgy - camGY
      const tY = Math.cos(angle)*rx + Math.sin(angle)*ry
      if (tY < 0.08) continue
      // Fixed sign: right vector is (-sin, cos) so tX = -sin*rx + cos*ry
      const tX   = -Math.sin(angle)*rx + Math.cos(angle)*ry
      const dist  = Math.sqrt(rx*rx + ry*ry)
      sprites.push({ w, tX, tY, dist, color: colorFromAddress(w) })
    }
    sprites.sort((a,b) => b.dist - a.dist)

    for (const { w, tX, tY, color } of sprites) {
      const scrX = Math.round(W/2*(1+tX/tY))
      const [cr,cg2,cb] = hexToRgb(color)
      const fade  = Math.max(0.30, 1 - tY*0.055)
      const alpha = Math.min(0.98, Math.max(0, 1.0 - tY*0.04))

      // Perspective-correct grounding: cellScale = 1-cell pixel height at tY distance
      // bottomY = floor level at this depth (same formula as wall bottom = horizon + wallH/2)
      const cellScale = Math.min(H*1.8, H*PROJ_DIST/Math.max(0.05, tY))
      const bottomY   = Math.min(H+30, Math.round(horizon + cellScale * 0.50))
      const walletH   = Math.round(cellScale * 0.58)
      const walletW   = Math.round(cellScale * 0.50)
      const billsH    = Math.round(cellScale * 0.20)
      const billsW    = Math.round(walletW * 0.44)
      const walletTop = bottomY - walletH
      const billsTop  = walletTop - billsH
      const foldY     = Math.round(walletTop + walletH * 0.44)
      const claspH    = Math.max(2, Math.round(walletH * 0.16))
      const claspY    = Math.round(walletTop + walletH * 0.28)
      const wx1 = scrX - Math.floor(walletW / 2)
      const wx2 = scrX + Math.ceil(walletW / 2)
      const bx1 = scrX - Math.floor(billsW / 2)
      const bx2 = scrX + Math.ceil(billsW / 2)
      const fullLeft  = Math.min(wx1, bx1)
      const fullRight = Math.max(wx2, bx2)

      // Glow outline pass
      for (let sx = fullLeft-1; sx <= fullRight; sx++) {
        const zCol = Math.floor(sx / STRIP_W)
        if (zCol < 0 || zCol >= strips) continue
        if (tY >= zBuffer[zCol]) continue
        ctx.globalAlpha = alpha * 0.28; ctx.fillStyle = color
        if (sx >= bx1-1 && sx <= bx2) ctx.fillRect(sx, billsTop-1, 1, billsH+1)
        if (sx >= wx1-1 && sx <= wx2)  ctx.fillRect(sx, walletTop-1, 1, walletH+2)
      }

      // Wallet body (column-by-column depth-correct)
      for (let sx = fullLeft; sx < fullRight; sx++) {
        const zCol = Math.floor(sx / STRIP_W)
        if (zCol < 0 || zCol >= strips) continue
        if (tY >= zBuffer[zCol]) continue
        const inWallet = sx >= wx1 && sx < wx2
        const inBills  = sx >= bx1 && sx < bx2

        if (inBills) {
          ctx.globalAlpha = alpha * 0.88
          ctx.fillStyle = `rgb(${Math.min(255,Math.round(cr*fade*1.28))},${Math.min(255,Math.round(cg2*fade*1.28))},${Math.min(255,Math.round(cb*fade*1.28))})`
          ctx.fillRect(sx, billsTop, 1, billsH)
          if (billsH > 4) {
            ctx.globalAlpha = alpha * 0.38; ctx.fillStyle = 'rgba(255,255,255,0.55)'
            ctx.fillRect(sx, billsTop + Math.round(billsH*0.22), 1, Math.max(1, Math.round(billsH*0.18)))
          }
        }
        if (inWallet) {
          const isEdge = sx === wx1 || sx === wx2 - 1
          const relX   = (sx - wx1) / Math.max(1, walletW - 1)
          ctx.globalAlpha = alpha
          ctx.fillStyle = `rgb(${Math.round(cr*fade*0.90)},${Math.round(cg2*fade*0.90)},${Math.round(cb*fade*0.90)})`
          ctx.fillRect(sx, walletTop, 1, foldY - walletTop)
          ctx.globalAlpha = alpha * 0.48; ctx.fillStyle = 'rgba(255,255,255,0.30)'
          ctx.fillRect(sx, walletTop + Math.round(walletH*0.12), 1, Math.max(1, Math.round(walletH*0.09)))
          ctx.globalAlpha = alpha
          ctx.fillStyle = `rgb(${Math.round(cr*fade*0.58)},${Math.round(cg2*fade*0.58)},${Math.round(cb*fade*0.58)})`
          ctx.fillRect(sx, foldY, 1, bottomY - foldY)
          ctx.globalAlpha = alpha * 0.72; ctx.fillStyle = 'rgba(0,0,0,0.60)'
          ctx.fillRect(sx, foldY-1, 1, 2)
          if (relX > 0.30 && relX < 0.70) {
            ctx.globalAlpha = alpha * 0.90; ctx.fillStyle = 'rgba(255,195,45,0.90)'
            ctx.fillRect(sx, claspY, 1, claspH)
          }
          if (isEdge) {
            ctx.globalAlpha = alpha * 0.62; ctx.fillStyle = 'rgba(0,0,0,0.72)'
            ctx.fillRect(sx, walletTop, 1, walletH)
          }
        }
      }
      ctx.globalAlpha = 1

      // Pickaxe (vector draw, depth-checked at wallet center)
      const pkZCol = Math.floor(scrX / STRIP_W)
      if (pkZCol >= 0 && pkZCol < strips && tY < zBuffer[pkZCol]) {
        const pkBX = scrX + Math.round(walletW * 0.58)
        const pkBY = Math.round(foldY + walletH * 0.05)
        const pkL  = Math.max(5, Math.round(walletH * 0.55))
        const pkA  = -2.05
        const pkTX = pkBX + Math.cos(pkA)*pkL, pkTY = pkBY + Math.sin(pkA)*pkL
        ctx.globalAlpha = alpha * 0.82
        ctx.strokeStyle = '#8B5E3C'
        ctx.lineWidth = Math.max(1.5, pkL*0.09); ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(pkBX, pkBY); ctx.lineTo(pkTX, pkTY); ctx.stroke()
        ctx.lineCap = 'butt'
        const hs = Math.max(2, pkL*0.22)
        ctx.fillStyle = '#aac4d4'
        ctx.beginPath()
        ctx.moveTo(pkTX, pkTY - hs*0.6)
        ctx.lineTo(pkTX - hs*1.1, pkTY + hs*0.2)
        ctx.lineTo(pkTX - hs*0.5, pkTY + hs*0.9)
        ctx.lineTo(pkTX + hs*0.4, pkTY + hs*0.5)
        ctx.closePath(); ctx.fill()
        ctx.globalAlpha = 1
      }

      // Floor shadow ellipse (at actual floor level)
      if (tY < 5.0) {
        const sAlpha = Math.max(0, (5.0-tY)/5.0)*0.28
        const sw = Math.max(4, Math.round(walletW*0.85))
        const sh = Math.max(2, Math.round(sw*0.18))
        ctx.globalAlpha = sAlpha; ctx.fillStyle = '#000'
        ctx.beginPath()
        ctx.ellipse(scrX, bottomY + sh*0.5, sw/2, sh, 0, 0, Math.PI*2)
        ctx.fill(); ctx.globalAlpha = 1
      }

      // Wallet label above bills
      if (tY < 7.0) {
        const lAlpha = Math.max(0, (7.0-tY)/7.0)*0.88
        const lSize  = Math.max(10, Math.round(13/Math.max(0.5, tY)))
        const pres   = (presence||{})[w]
        const pool   = pres?.poolCode
        ctx.globalAlpha = lAlpha * 0.45; ctx.fillStyle = '#000'
        ctx.font = `bold ${lSize}px monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
        ctx.fillText(`${w.slice(0,6)}…${w.slice(-4)}`, scrX+1, billsTop-1)
        ctx.globalAlpha = lAlpha; ctx.fillStyle = color
        ctx.fillText(`${w.slice(0,6)}…${w.slice(-4)}`, scrX, billsTop-2)
        if (pool && tY < 5.0) {
          const pSize = Math.max(8, lSize-2)
          ctx.globalAlpha = lAlpha*0.75; ctx.font = `bold ${pSize}px monospace`
          ctx.fillStyle = '#f59e0b'
          ctx.fillText(`[${pool}]`, scrX, billsTop-2-lSize-1)
        }
        ctx.globalAlpha = 1
      }
    }

    // ── Wall face overlays (text only — emoji handled by visibleWalls loop) ──
    const isMineWall = myWallet && fwdCell?.owner?.toLowerCase() === myWallet.toLowerCase()

    // Block title on wall face (medium distance)
    const fwdTitle = fwdCell
      ? (es ? (fwdCell.titleEs||fwdCell.titleEn||'') : (fwdCell.titleEn||fwdCell.titleEs||''))
      : ''
    if (fwdTitle && fwdDist < 6.5) {
      const a   = Math.min(0.82, Math.max(0.05, (6.5-fwdDist)/6.5))
      const wH  = Math.min(H*1.8, H*PROJ_DIST/Math.max(0.1,fwdDist))
      const fs  = Math.max(9, Math.round(13*PROJ_DIST/Math.max(0.5,fwdDist)))
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
      const fs  = Math.max(9,Math.round(14*PROJ_DIST/Math.max(0.3,fwdDist)))
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
      const fs  = Math.max(8, Math.round(11*PROJ_DIST/Math.max(0.4,fwdDist)))
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
      const fs  = Math.max(9,Math.round(12*PROJ_DIST/Math.max(0.5,fwdDist)))
      ctx.globalAlpha = a
      ctx.font = `bold ${fs}px monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#fb923c'
      ctx.fillText(`${fwdCell.priceEur} EUR`, W/2, horizon + wH*0.30)
      ctx.globalAlpha = 1
    }

    // Inspect prompt when very close
    if (fwdDist < 0.9 && fwdCell && !fwdCell.owner) {
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      if (fwdCell.isChainNode) {
        ctx.fillStyle = '#ffd700cc'
        ctx.fillText(es ? '[ ↵ RESOLVER CADENA ]' : '[ ↵ SOLVE FORMULA CHAIN ]', W/2, horizon+18)
      } else {
        ctx.fillStyle = C + 'cc'
        ctx.fillText(es ? '[ ↵ MINAR BLOQUE ]' : '[ ↵ MINE BLOCK ]', W/2, horizon+18)
      }
    }

    // ── Crosshair — brightens and expands when in interaction range ───────────
    const hasTarget  = fwdMx >= 0 && fwdMy >= 0 && fwdCell !== null
    const inXHRange  = hasTarget && !fwdCell?.isObstacle && fwdDist <= INTERACT_DIST
    const xhBase     = fwdCell?.isChainNode ? '#ffd700' : (fwdCell?.owner ? fwdCell.color : C)
    const xhCol      = inXHRange ? xhBase+'ee' : hasTarget ? xhBase+'55' : C+'33'
    const xhLen      = inXHRange ? 12 : 9
    const xhGap      = inXHRange ? 2 : 3
    ctx.strokeStyle = xhCol; ctx.lineWidth = inXHRange ? 1.4 : 1
    ctx.beginPath()
    ctx.moveTo(W/2-xhLen-xhGap, horizon); ctx.lineTo(W/2-xhGap, horizon)
    ctx.moveTo(W/2+xhGap, horizon);       ctx.lineTo(W/2+xhLen+xhGap, horizon)
    ctx.moveTo(W/2, horizon-xhLen-xhGap); ctx.lineTo(W/2, horizon-xhGap)
    ctx.moveTo(W/2, horizon+xhGap);       ctx.lineTo(W/2, horizon+xhLen+xhGap)
    ctx.stroke()
    if (hasTarget) {
      ctx.fillStyle = xhCol
      ctx.beginPath(); ctx.arc(W/2, horizon, inXHRange ? 2.5 : 1.5, 0, Math.PI*2); ctx.fill()
    }
    if (inXHRange) {
      ctx.globalAlpha = 0.18; ctx.strokeStyle = xhBase; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(W/2, horizon, 22, 0, Math.PI*2); ctx.stroke()
      ctx.globalAlpha = 1
    }

    // ── Chain node compass (when within 13 cells, not facing it) ─────────────
    {
      const cnPos = chainNodePosRef.current
      const cnDX  = (cnPos.col+0.5) - px/CELL_SIZE
      const cnDY  = (cnPos.row+0.5) - py/CELL_SIZE
      const cnD   = Math.sqrt(cnDX*cnDX+cnDY*cnDY)
      if (cnD < 13 && !fwdCell?.isChainNode) {
        const cnA    = Math.atan2(cnDY, cnDX)
        const relA   = ((cnA - angle + Math.PI) % (2*Math.PI)) - Math.PI
        const prox   = Math.max(0, 1 - cnD/13)
        const cmpA   = 0.18 + prox * 0.52
        ctx.globalAlpha = cmpA
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#ffd700'
        ctx.textBaseline = 'middle'
        if (Math.abs(relA) > FOV/2 + 0.05) {
          // Off-screen: show directional arrow at screen edge
          ctx.textAlign = relA > 0 ? 'right' : 'left'
          ctx.fillText(`${relA > 0 ? '→' : '←'} ⬡ ${cnD.toFixed(1)}`, relA > 0 ? W-10 : 10, H*0.35)
        } else {
          // In FOV but not targeted: subtle below-crosshair label
          ctx.textAlign = 'center'
          ctx.fillText(`⬡ ${cnD.toFixed(1)}`, W/2, horizon+32)
        }
        ctx.globalAlpha = 1; ctx.textBaseline = 'top'
      }
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
    ctx.fillStyle = C+'dd'; ctx.font='bold 12px monospace'
    ctx.fillText(curHex, 10, 10)
    if (curCell?.emoji) {
      ctx.font='12px serif'; ctx.fillText(curCell.emoji, 10, 24)
    }
    if (curCell?.owner) {
      const ownLabel = myWallet && curCell.owner.toLowerCase()===myWallet.toLowerCase()
        ? (es?'🔑 TUYO':'🔑 YOURS') : `${curCell.owner.slice(0,6)}…${curCell.owner.slice(-4)}`
      ctx.fillStyle = curCell.color+'cc'; ctx.font='11px monospace'
      ctx.fillText(ownLabel, 10, curCell.emoji ? 40 : 24)
    }

    // Controls hint (very dim, top-center)
    ctx.textAlign='center'; ctx.fillStyle='#28465c'; ctx.font='bold 9px monospace'
    ctx.fillText(
      es ? 'WASD·mover  Q/E·girar  drag·rotar  ↵·acción'
         : 'WASD·move  Q/E·turn  drag·look  ↵·action',
      W/2, 10
    )

    // ── Facing block info HUD (top-right) ─────────────────────────────────────
    drawFacingHUD(ctx, W, H, fwdCell, fwdMx, fwdMy, myWallet, es, fwdDist)

    // ── First-person pickaxe ───────────────────────────────────────────────
    const swE  = performance.now() - swingStartRef.current
    const swT  = swE < SWING_DUR ? swE / SWING_DUR : 0
    drawPickaxe(ctx, W, H, swT, walkDistRef.current)
    drawMineProgress(ctx, W, H, mineProgressRef.current, mineTypeRef.current)

    // ── Enemy in crosshair indicator ──────────────────────────────────────
    const enemy = enemyTargetRef.current
    if (enemy?.wallet) {
      ctx.globalAlpha = 0.55
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5
      const xh = W/2, yh = H * HORIZON_RATIO
      const r2 = 18
      ctx.beginPath(); ctx.arc(xh, yh, r2, 0, Math.PI*2); ctx.stroke()
      ctx.globalAlpha = 0.40
      ctx.fillStyle = '#ef4444'
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText('⚔', xh, yh + r2 + 3)
      ctx.globalAlpha = 1
    }

    // ── PvP hit flash (red screen vignette) ───────────────────────────────
    const flashAge = performance.now() - pvpFlashRef.current
    if (flashAge < 280) {
      const fa = (1 - flashAge / 280) * 0.28
      const rg = ctx.createRadialGradient(W/2,H/2,H*0.2, W/2,H/2,H*0.8)
      rg.addColorStop(0, 'rgba(0,0,0,0)')
      rg.addColorStop(1, `rgba(220,30,30,${fa.toFixed(3)})`)
      ctx.globalAlpha = 1
      ctx.fillStyle = rg
      ctx.fillRect(0, 0, W, H)
    }

    // ── PvP gain popup ("+X EUR") ─────────────────────────────────────────
    const gain = pvpGainRef.current
    if (gain) {
      const ga = (performance.now() - gain.at) / 1200
      if (ga < 1) {
        ctx.globalAlpha = 1 - ga
        ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = '#4ade80'
        ctx.fillText(gain.text, W/2, H * HORIZON_RATIO - 40 - ga*20)
        ctx.globalAlpha = 1
      } else pvpGainRef.current = null
    }

    drawMinimap(ctx,gr,gc,angle,cellMap,presence,myWallet,W,H,chainNodePosRef.current)
    drawOnlineList(ctx,W,H,presence,myWallet,pvpStolenRef.current)
    drawChainStats(ctx,W,H,chainStatsRef.current,es)
  }, [])

  useEffect(()=>{ renderRef.current=renderFrame },[renderFrame])

  // Canvas resize
  useEffect(()=>{
    const canvas=canvasRef.current, container=containerRef.current
    if (!canvas||!container) return
    const resize=()=>{
      const {width,height}=container.getBoundingClientRect()
      const cssW = Math.max(1, Math.round(width))
      const cssH = Math.max(1, Math.round(height))
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      canvas.dataset.dpr = String(dpr)
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
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
      // Don't capture game keys while the user is typing in an overlay input
      const tag = document.activeElement?.tagName
      if(tag==='INPUT'||tag==='TEXTAREA') return
      const k=keysRef.current
      if(e.key==='w'||e.key==='W'||e.key==='ArrowUp')   {k.w=true;e.preventDefault()}
      if(e.key==='s'||e.key==='S'||e.key==='ArrowDown') {k.s=true;e.preventDefault()}
      if(e.key==='a'||e.key==='A')                        k.a=true
      if(e.key==='d'||e.key==='D')                        k.d=true
      if(e.key==='q'||e.key==='Q'||e.key==='ArrowLeft') {k.q=true;e.preventDefault()}
      if(e.key==='e'||e.key==='E'||e.key==='ArrowRight'){k.e=true;e.preventDefault()}
      if(e.key==='Enter'){
        const fData=facingDataRef.current||{}
        const inRange=fData.dist==null||fData.dist<=INTERACT_DIST
        if(inRange){
          if(fData.cell?.isChainNode){
            onChainSolveOpenRef.current?.()
          } else {
            const url=actionUrlRef.current
            if(url) onWantNavRef.current?.(url)
          }
        }
        e.preventDefault()
      }
      if(e.key===' '||e.code==='Space'){
        if(performance.now()-swingStartRef.current>SWING_DUR){
          swingStartRef.current=performance.now(); hitDoneRef.current=false
        }
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

  // Pointer drag → rotate, tap → pickaxe swing
  const handlePointerDown = useCallback((e)=>{
    canvasRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, type: e.pointerType, moved: 0 }
  },[])
  const handlePointerMove = useCallback((e)=>{
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    dragRef.current.x = e.clientX
    dragRef.current.moved = (dragRef.current.moved||0) + Math.abs(dx)
    const sens = dragRef.current.type === 'touch' ? 0.006 : 0.003
    playerRef.current.angle += dx * sens
    renderRef.current?.()
  },[])
  const handlePointerUp = useCallback(()=>{
    if (dragRef.current && (dragRef.current.moved||0) < 8) {
      // Tap/click with minimal movement → swing pickaxe
      if (performance.now()-swingStartRef.current > SWING_DUR) {
        swingStartRef.current = performance.now()
        hitDoneRef.current = false
      }
    }
    dragRef.current = null
  },[])

  // Game loop
  useEffect(()=>{
    const loop=()=>{
      // Schedule next frame FIRST so the loop survives any exception in the body
      animRef.current=requestAnimationFrame(loop)
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
        const cm=cellMapRef.current, obs=validObstaclesRef.current
        // Full move, else wall-slide on each axis independently
        if(inBX&&inBY&&!hitsSolidWall(ngx,ngy,cm,obs)){ p.x=nx; p.y=ny }
        else{
          if(inBX&&!hitsSolidWall(ngx,cgy,cm,obs)) p.x=nx
          if(inBY&&!hitsSolidWall(cgx,ngy,cm,obs)) p.y=ny
        }
        walkDistRef.current+=MOVE_SPD
        needsRender=true

        // Footstep every ~10 movement frames regardless of CELL_SIZE
        const steps=Math.floor(walkDistRef.current/FOOTSTEP_DIST)
        if(steps!==stepCountRef.current){stepCountRef.current=steps;playStep(audioCtxRef)}

        // Real-time sub-cell presence broadcast (throttled to ~8/sec)
        const now=Date.now()
        if(now-lastRealtimeRef.current>120){
          lastRealtimeRef.current=now
          onPositionRealtimeRef.current?.(p.x/CELL_SIZE, p.y/CELL_SIZE)
        }

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

      // ── Enemy sprite targeting ─────────────────────────────────────────────
      const camGX = p.x / CELL_SIZE, camGY = p.y / CELL_SIZE
      let closestEnemy = null, closestDist = Infinity
      const myW = myWalletRef.current
      for (const [w, pres] of Object.entries(presenceRef.current || {})) {
        const isMe = w.toLowerCase() === (myW || '').toLowerCase()
        if (isMe) continue
        const sgx = pres.gx ?? ((pres.col ?? 0) + 0.5)
        const sgy = pres.gy ?? ((pres.row ?? 0) + 0.5)
        const rx = sgx - camGX, ry = sgy - camGY
        const tY = Math.cos(p.angle)*rx + Math.sin(p.angle)*ry
        if (tY < 0.15 || tY > INTERACT_DIST) continue
        const tX = -Math.sin(p.angle)*rx + Math.cos(p.angle)*ry
        if (Math.abs(tX / tY) > 0.28) continue
        if (tY < closestDist) { closestDist = tY; closestEnemy = { wallet: w, dist: tY, isAnon: w.startsWith('anon-') } }
      }
      enemyTargetRef.current = closestEnemy

      // Facing detection + action URL + mine type update
      const {cell:fc,mx:fmx,my:fmy,perpDist:fcDist}=castRay(p.x,p.y,p.angle,cellMapRef.current,validObstaclesRef.current)
      const newKey=`${fmy},${fmx}`
      facingDataRef.current={mx:fmx,my:fmy,cell:fc,dist:fcDist}
      if(newKey!==facingKeyRef.current){
        facingKeyRef.current=newKey
        // Reset progress when target changes
        mineProgressRef.current=0; mineTargetRef.current=null
        if(fmx>=0&&fmy>=0){
          if(!fc?.isObstacle) onFacingChange?.(fmy,fmx,fc,fcDist)
          if(fc?.isObstacle){
            actionUrlRef.current=null; mineTypeRef.current='empty'
          } else if(fc){
            if(fc.isChainNode){
              actionUrlRef.current=null
              mineTypeRef.current='empty'
            } else {
              const hex=fc.blockHex||gridToBlockHex(fmy,fmx)
              const myW=myWalletRef.current
              const ownerIsMe=myW&&fc.owner?.toLowerCase()===myW
              if(!fc.owner){
                actionUrlRef.current=`/relaying?command=${encodeURIComponent(`/mine block ${hex}`)}`;
                mineTypeRef.current=fc.isMarket?'nftji':'mine'
              } else if(ownerIsMe&&fc.isMarket){
                actionUrlRef.current=`/relaying?command=${encodeURIComponent(`/resell ${hex}`)}`
                mineTypeRef.current='nftji'
              } else {
                actionUrlRef.current=null; mineTypeRef.current='empty'
              }
            }
          } else if (fmx >= 0 && fmy >= 0 && fmx < COLS && fmy < ROWS) {
            // Unclaimed regular block (not in cellMap = never claimed)
            const hex = gridToBlockHex(fmy, fmx)
            actionUrlRef.current = `/relaying?command=${encodeURIComponent(`/mine block ${hex}`)}`
            mineTypeRef.current = 'mine'
          } else {
            actionUrlRef.current=null; mineTypeRef.current='empty'
          }
          // Disable action URL if block is beyond interaction range
          if(fcDist > INTERACT_DIST) actionUrlRef.current=null
        } else {
          actionUrlRef.current=null; mineTypeRef.current='empty'
        }
        needsRender=true
      }

      // ── Swing hit detection ─────────────────────────────────────────────────
      const swingElapsed=performance.now()-swingStartRef.current
      const swinging=swingElapsed<SWING_DUR
      if(swinging) needsRender=true
      if(swinging&&swingElapsed/SWING_DUR>=0.45&&!hitDoneRef.current){
        hitDoneRef.current=true
        const myWallet = myWalletRef.current
        const enemy = enemyTargetRef.current

        if(enemy?.wallet && myWallet && !myWallet.startsWith('anon-')){
          // ── PvP hit ──────────────────────────────────────────────────────
          playPickHit(audioCtxRef,'nftji')
          pvpFlashRef.current = performance.now()

          if(enemy.isAnon){
            // Anon: track local hits for reset, and call API for +0.10 EUR bounty
            const prev = anonHitsRef.current[enemy.wallet] || 0
            const next = prev + 1
            anonHitsRef.current[enemy.wallet] = next
            if(next >= 5){
              anonHitsRef.current[enemy.wallet] = 0
              onAnonResetRef.current?.(enemy.wallet)
            }
            onPvpHitRef.current?.({ attacker: myWallet, victim: enemy.wallet, victimIsAnon: true })
            pvpGainRef.current = { text: '👊 +0.10 EUR', at: performance.now() }
          } else {
            // Logged wallet: call API for steal + daily task
            pvpGainRef.current = { text: '⚔ +0.10 EUR', at: performance.now() }
            onPvpHitRef.current?.({ attacker: myWallet, victim: enemy.wallet, victimIsAnon: false })
          }

        } else {
          // ── Block mine hit ───────────────────────────────────────────────
          const {mx,my}=facingDataRef.current
          const tk=mx>=0&&my>=0?`${my},${mx}`:null
          if(tk!==mineTargetRef.current){mineProgressRef.current=0;mineTargetRef.current=tk}
          if(!tk||mineTypeRef.current==='empty'){
            playPickHit(audioCtxRef,'empty')
          } else {
            mineProgressRef.current=Math.min(1,mineProgressRef.current+1/HITS_NEEDED)
            playPickHit(audioCtxRef,mineTypeRef.current)
            if(mineProgressRef.current>=1){
              playPickHit(audioCtxRef,'complete')
              mineProgressRef.current=0
              const url=actionUrlRef.current
              if(url) setTimeout(()=>onWantNavRef.current?.(url),120)
            }
          }
        }
        needsRender=true
      }
      if(!swinging) hitDoneRef.current=false

      if(notifRef.current&&(Date.now()-notifRef.current.startedAt)<2800) needsRender=true
      // Always render when remote players are present so their movement is visible
      const hasRemotes = Object.keys(presenceRef.current||{}).some(
        w => w.toLowerCase() !== (myWalletRef.current||'').toLowerCase()
      )
      if(needsRender||hasRemotes) renderRef.current?.()
    }
    animRef.current=requestAnimationFrame(loop)
    return ()=>cancelAnimationFrame(animRef.current)
  },[onPositionChange,onFacingChange])

  const dBtn=(key,lbl)=>({
    onPointerDown:(e)=>{e.preventDefault();keysRef.current[key]=true},
    onPointerUp:  (e)=>{e.preventDefault();keysRef.current[key]=false},
    onPointerLeave:()=>{keysRef.current[key]=false},
    style:{
      width:58,height:58,background:'rgba(34,211,238,0.10)',
      border:'1px solid #22d3ee3d',borderRadius:10,color:'#22d3eebb',
      fontSize:'1.35rem',cursor:'pointer',display:'flex',
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
        position:'absolute',
        bottom:'calc(56px + env(safe-area-inset-bottom, 0px))',
        left:12,
        display:'flex',alignItems:'center',
        pointerEvents:'auto',userSelect:'none',
      }}>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          <div style={{display:'flex',justifyContent:'center'}}><button {...dBtn('w','▲')} /></div>
          <div style={{display:'flex',gap:4}}>
            <button {...dBtn('a','◀')} />
            <button {...dBtn('s','▼')} />
            <button {...dBtn('d','▶')} />
          </div>
        </div>
      </div>
      <p style={{
        position:'absolute',
        bottom:'calc(46px + env(safe-area-inset-bottom, 0px))',
        left:12,
        margin:0,color:'#22d3ee55',fontSize:'0.68rem',
        fontFamily:'monospace',letterSpacing:'0.06em',pointerEvents:'none',
      }}>{es?'DRAG·ROTAR':'DRAG·LOOK'}</p>
    </div>
  )
}
