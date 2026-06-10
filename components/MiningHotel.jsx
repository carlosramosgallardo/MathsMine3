'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'
import { useActiveWallet } from '@/lib/use-active-wallet'
import { colorFromAddress } from '@/lib/wallet-colors'
import {
  gridToBlockHex,
  blockHexToGrid,
  MM3_BLOCK_GRID_ROWS,
  MM3_BLOCK_GRID_COLS,
  MM3_BLOCK_REQUIREMENT_BY_HEX,
} from '@/lib/mm3-block-chain'
import supabase from '@/lib/supabaseClient'
import MiningHotelFPV from './MiningHotelFPV'

// ─── Constants ───────────────────────────────────────────────────────────────
const ROWS = MM3_BLOCK_GRID_ROWS   // 28
const COLS = MM3_BLOCK_GRID_COLS   // 28
const BASE_TW = 32                 // tile diamond width (pixels at zoom=1)
const BASE_TH = 16                 // tile diamond height
const BASE_WH = 20                 // wall height — taller rooms for hotel feel
const C       = '#22d3ee'
const HOTEL_CHANNEL = 'mm3-hotel-v1'
const LABEL_MAX_ZOOM = 0.75        // show wallet labels above this zoom

// ─── ISO Math ────────────────────────────────────────────────────────────────
function isoToScreen(row, col, tw, th, origX, origY) {
  return {
    x: origX + (col - row) * tw / 2,
    y: origY + (col + row) * th / 2,
  }
}

function screenToGrid(sx, sy, tw, th, origX, origY) {
  const rx = sx - origX
  const ry = sy - origY
  return {
    row: Math.floor((ry / (th / 2) - rx / (tw / 2)) / 2),
    col: Math.floor((rx / (tw / 2) + ry / (th / 2)) / 2),
  }
}

// ─── Color Helpers ───────────────────────────────────────────────────────────
function hexDarken(hex, f) {
  const c = (hex || '#111').replace('#', '').padStart(6, '0')
  const h = (s) => Math.round(Math.min(255, Math.max(0, parseInt(s, 16) * f))).toString(16).padStart(2, '0')
  return `#${h(c.slice(0, 2))}${h(c.slice(2, 4))}${h(c.slice(4, 6))}`
}

// ─── Avatar Drawing ───────────────────────────────────────────────────────────
function drawAvatar(ctx, fx, fy, color, label, zoom, isMe) {
  const bW = Math.max(4, 5 * zoom)
  const bH = Math.max(8, 13 * zoom)
  const hR = Math.max(3, 5 * zoom)

  // shadow ellipse on tile
  ctx.beginPath()
  ctx.ellipse(fx, fy + 1, bW * 0.8, 2 * zoom, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fill()

  // body
  ctx.fillStyle = hexDarken(color, 0.65)
  ctx.fillRect(fx - bW / 2, fy - bH, bW, bH)

  // head
  ctx.beginPath()
  ctx.arc(fx, fy - bH - hR * 0.4, hR, 0, Math.PI * 2)
  ctx.fillStyle = color
  if (isMe) {
    ctx.shadowBlur = 8 * zoom
    ctx.shadowColor = C
  } else {
    ctx.shadowBlur = 4 * zoom
    ctx.shadowColor = color
  }
  ctx.fill()
  ctx.shadowBlur = 0

  if (isMe) {
    ctx.strokeStyle = C
    ctx.lineWidth = 1.2 * zoom
    ctx.stroke()
  }

  // wallet label
  if (zoom >= LABEL_MAX_ZOOM && label) {
    const fs = Math.round(7 * zoom)
    ctx.font = `bold ${fs}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = color
    const shortened = isMe ? (label === 'ME' ? 'YOU' : `${label.slice(0, 4)}…${label.slice(-3)}`) : `${label.slice(0, 4)}…${label.slice(-3)}`
    ctx.fillText(shortened, fx, fy - bH - hR - 2 * zoom)
  }
}

// ─── Full Scene Draw ──────────────────────────────────────────────────────────
function drawScene(canvas, state) {
  const { cellMap, myRow, myCol, presenceMap, selectedCell, hoveredCell, panX, panY, zoom, myColor, myWallet } = state
  const ctx = canvas.getContext('2d')
  const W = canvas.width / (window.devicePixelRatio || 1)
  const H = canvas.height / (window.devicePixelRatio || 1)
  const tw = BASE_TW * zoom
  const th = BASE_TH * zoom
  const wh = BASE_WH * zoom
  const origX = W / 2 + panX
  const origY = th * 2 + panY  // top padding

  ctx.save()
  const dpr = window.devicePixelRatio || 1
  ctx.scale(dpr, dpr)

  // background
  ctx.fillStyle = '#060a12'
  ctx.fillRect(0, 0, W, H)

  // subtle grid reference dot at origin
  ctx.beginPath()
  ctx.arc(origX, origY, 2, 0, Math.PI * 2)
  ctx.fillStyle = '#22d3ee22'
  ctx.fill()

  // Draw tiles in back-to-front (painter's algorithm)
  for (let sum = 0; sum <= (ROWS - 1) + (COLS - 1); sum++) {
    const rowMin = Math.max(0, sum - COLS + 1)
    const rowMax = Math.min(ROWS - 1, sum)
    for (let row = rowMin; row <= rowMax; row++) {
      const col = sum - row
      if (col < 0 || col >= COLS) continue

      const cell   = cellMap.get(`${row},${col}`)
      const { x, y } = isoToScreen(row, col, tw, th, origX, origY)
      const isMy  = row === myRow && col === myCol
      const isSel = selectedCell?.row === row && selectedCell?.col === col
      const isHov = hoveredCell?.row === row && hoveredCell?.col === col

      // Determine colors
      let topC, leftC, rightC
      if (cell?.isMarket && cell?.owner) {
        topC  = hexDarken(cell.color, 0.72)
        leftC = hexDarken(cell.color, 0.42)
        rightC = hexDarken(cell.color, 0.30)
      } else if (cell?.isMarket) {
        topC  = '#0e1f2e'
        leftC = '#080e18'
        rightC = '#060c14'
      } else if (cell?.owner) {
        topC  = hexDarken(cell.color, 0.68)
        leftC = hexDarken(cell.color, 0.38)
        rightC = hexDarken(cell.color, 0.28)
      } else {
        topC  = '#0a1525'
        leftC = '#060c1a'
        rightC = '#040810'
      }

      if (isSel) {
        topC = hexDarken(C, 0.80)
        leftC = hexDarken(C, 0.45)
        rightC = hexDarken(C, 0.32)
      } else if (isMy) {
        topC  = hexDarken(myColor || '#a855f7', 0.70)
        leftC = hexDarken(myColor || '#a855f7', 0.40)
        rightC = hexDarken(myColor || '#a855f7', 0.30)
      } else if (isHov) {
        topC  = hexDarken(topC, 1.45)
        leftC = hexDarken(leftC, 1.3)
        rightC = hexDarken(rightC, 1.3)
      }

      // Glow for selected / my tile
      if (isSel || isMy) {
        ctx.shadowBlur = 10 * zoom
        ctx.shadowColor = isSel ? C : (myColor || '#a855f7')
      }

      // Top face (diamond)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + tw / 2, y + th / 2)
      ctx.lineTo(x, y + th)
      ctx.lineTo(x - tw / 2, y + th / 2)
      ctx.closePath()
      ctx.fillStyle = topC
      ctx.fill()
      ctx.shadowBlur = 0

      // Left wall
      ctx.beginPath()
      ctx.moveTo(x - tw / 2, y + th / 2)
      ctx.lineTo(x,           y + th)
      ctx.lineTo(x,           y + th + wh)
      ctx.lineTo(x - tw / 2, y + th / 2 + wh)
      ctx.closePath()
      ctx.fillStyle = leftC
      ctx.fill()

      // Right wall
      ctx.beginPath()
      ctx.moveTo(x + tw / 2, y + th / 2)
      ctx.lineTo(x,           y + th)
      ctx.lineTo(x,           y + th + wh)
      ctx.lineTo(x + tw / 2, y + th / 2 + wh)
      ctx.closePath()
      ctx.fillStyle = rightC
      ctx.fill()

      // Tile outline
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + tw / 2, y + th / 2)
      ctx.lineTo(x, y + th)
      ctx.lineTo(x - tw / 2, y + th / 2)
      ctx.closePath()
      ctx.strokeStyle = 'rgba(255,255,255,0.045)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Emoji on tile (market blocks, zoom permitting)
      if (cell?.emoji && tw >= 20) {
        ctx.font = `${Math.round(th * 0.65)}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(cell.emoji, x, y + th * 0.45)
      }

      // Block hex label on claimed plain cells at high zoom
      if (!cell?.emoji && cell?.owner && tw >= 32) {
        const hexLabel = cell.blockHex || ''
        ctx.font = `${Math.max(6, Math.round(th * 0.38))}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = hexDarken(cell.color, 1.8)
        ctx.fillText(hexLabel, x, y + th * 0.45)
      }
    }
  }

  // Draw all presence avatars (others first, then me on top)
  const avatarEntries = Object.entries(presenceMap)
  const others = avatarEntries.filter(([w]) => w.toLowerCase() !== (myWallet || '').toLowerCase())
  const mine   = avatarEntries.filter(([w]) => w.toLowerCase() === (myWallet || '').toLowerCase())

  for (const [w, pres] of [...others, ...mine]) {
    if (pres.row == null || pres.col == null) continue
    const isMe = w.toLowerCase() === (myWallet || '').toLowerCase()
    const color = colorFromAddress(w)
    const { x, y } = isoToScreen(pres.row, pres.col, tw, th, origX, origY)
    drawAvatar(ctx, x, y + th / 2, color, isMe ? myWallet || 'YOU' : w, zoom, isMe)
  }

  // My avatar (if not already in presence, e.g. no wallet connected → show greyed avatar)
  if (myWallet && !presenceMap[myWallet?.toLowerCase()]) {
    const { x, y } = isoToScreen(myRow, myCol, tw, th, origX, origY)
    drawAvatar(ctx, x, y + th / 2, myColor || '#888', myWallet, zoom, true)
  }

  ctx.restore()
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function MiningHotel() {
  const { language } = useI18n()
  const es = language === 'es'
  const { account } = useActiveWallet()

  const canvasRef     = useRef(null)
  const containerRef  = useRef(null)
  const channelRef    = useRef(null)
  const stateRef      = useRef({})  // always-fresh snapshot for canvas event handlers
  const rafRef        = useRef(null)

  const [cellMap,      setCellMap]      = useState(new Map())
  const [myPos,        setMyPos]        = useState({ row: 14, col: 14 })
  const [presenceMap,  setPresenceMap]  = useState({})
  const [selectedCell, setSelectedCell] = useState(null)
  const [hoveredCell,  setHoveredCell]  = useState(null)
  const [zoom,         setZoom]         = useState(0.85)
  const [pan,          setPan]          = useState({ x: 0, y: 0 })
  const [dragState,    setDragState]    = useState(null) // { startX, startY, startPanX, startPanY }
  const [loading,      setLoading]      = useState(true)
  const [onlineCount,  setOnlineCount]  = useState(0)
  const [viewMode,     setViewMode]     = useState('iso') // 'iso' | '3p' | 'fpv'

  const myWallet = account?.toLowerCase() || null
  const myColor  = myWallet ? colorFromAddress(myWallet) : '#888888'

  // ── Load cell data ──────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    async function load() {
      const [
        { data: mined },
        { data: market },
        { data: owners },
      ] = await Promise.all([
        supabase.from('mm3_mined_blocks').select('block_hex, wallet'),
        supabase.from('mm3_mining_blocks').select('block_key, grid_row, grid_col, emoji, title_en, title_es, price_eur'),
        supabase.from('player_progress').select('wallet, mining_nftji_key').not('mining_nftji_key', 'is', null),
      ])

      if (!mounted) return
      const map = new Map()

      // Mined plain cells
      for (const m of mined || []) {
        const pos = blockHexToGrid(m.block_hex)
        if (!pos) continue
        const key = `${pos.row},${pos.col}`
        map.set(key, {
          blockHex: m.block_hex,
          owner: m.wallet,
          color: colorFromAddress(m.wallet),
          isMined: true,
        })
      }

      // Market blocks (NFTJI blocks)
      const ownersByKey = new Map()
      for (const o of owners || []) {
        if (o.mining_nftji_key) ownersByKey.set(o.mining_nftji_key, o.wallet.toLowerCase())
      }
      for (const m of market || []) {
        if (m.grid_row == null || m.grid_col == null) continue
        const key = `${m.grid_row},${m.grid_col}`
        const ownerWallet = ownersByKey.get(m.block_key) || null
        map.set(key, {
          ...map.get(key),
          blockKey:  m.block_key,
          blockHex:  gridToBlockHex(m.grid_row, m.grid_col),
          emoji:     m.emoji,
          titleEn:   m.title_en,
          titleEs:   m.title_es,
          priceEur:  m.price_eur,
          owner:     ownerWallet,
          color:     ownerWallet ? colorFromAddress(ownerWallet) : C,
          isMarket:  true,
          isMined:   Boolean(ownerWallet),
        })
      }
      setCellMap(map)
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  // ── Supabase Presence ────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(HOTEL_CHANNEL, {
      config: { presence: { key: myWallet || `anon-${Math.random().toString(36).slice(2, 8)}` } },
    })

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      const flat = {}
      for (const [key, entries] of Object.entries(state)) {
        if (entries?.[0]) flat[key] = entries[0]
      }
      setPresenceMap(flat)
      setOnlineCount(Object.keys(flat).length)
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && myWallet) {
        await ch.track({ wallet: myWallet, row: myPos.row, col: myPos.col })
      }
    })

    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWallet])

  // Track position updates
  useEffect(() => {
    if (channelRef.current && myWallet) {
      channelRef.current.track({ wallet: myWallet, row: myPos.row, col: myPos.col }).catch(() => {})
    }
  }, [myPos, myWallet])

  // ── Keep stateRef fresh ──────────────────────────────────────────────────────
  useEffect(() => {
    stateRef.current = { cellMap, myRow: myPos.row, myCol: myPos.col, presenceMap, selectedCell, hoveredCell, pan, zoom, myColor, myWallet }
  })

  // ── Canvas resize ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas    = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const { width, height } = container.getBoundingClientRect()
      canvas.width  = width  * dpr
      canvas.height = height * dpr
      canvas.style.width  = `${width}px`
      canvas.style.height = `${height}px`
      // Auto-fit zoom
      const fitZoom = Math.min(1.0, (width - 40) / ((ROWS + COLS) * BASE_TW / 2))
      setZoom(z => z === 0.85 ? Math.max(0.35, fitZoom) : z) // only on first fit
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // ── Redraw canvas ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || loading) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      drawScene(canvas, {
        cellMap, myRow: myPos.row, myCol: myPos.col,
        presenceMap, selectedCell, hoveredCell,
        panX: pan.x, panY: pan.y, zoom, myColor, myWallet,
      })
    })
  }, [cellMap, myPos, presenceMap, selectedCell, hoveredCell, pan, zoom, myColor, myWallet, loading])

  // ── Movement helpers ─────────────────────────────────────────────────────────
  const moveTo = useCallback((row, col) => {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return
    setMyPos({ row, col })
  }, [])

  const moveBy = useCallback((dr, dc) => {
    setMyPos(prev => ({
      row: Math.max(0, Math.min(ROWS - 1, prev.row + dr)),
      col: Math.max(0, Math.min(COLS - 1, prev.col + dc)),
    }))
  }, [])

  // ── Keyboard controls ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target !== document.body && e.target !== canvasRef.current) return
      const map = {
        ArrowUp: [-1, 0], w: [-1, 0], W: [-1, 0],
        ArrowDown: [1, 0], s: [1, 0], S: [1, 0],
        ArrowLeft: [0, -1], a: [0, -1], A: [0, -1],
        ArrowRight: [0, 1], d: [0, 1], D: [0, 1],
      }
      const delta = map[e.key]
      if (delta) { e.preventDefault(); moveBy(delta[0], delta[1]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moveBy])

  // ── Canvas Mouse Events ───────────────────────────────────────────────────────
  const getGridPos = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const s = stateRef.current
    const tw = BASE_TW * s.zoom
    const th = BASE_TH * s.zoom
    const origX = rect.width / 2 + s.pan.x
    const origY = th * 2 + s.pan.y
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { row, col } = screenToGrid(sx, sy, tw, th, origX, origY)
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null
    return { row, col }
  }, [])

  const onMouseMove = useCallback((e) => {
    const s = stateRef.current
    if (s.dragState) {
      // pan mode
      const dx = e.clientX - s.dragState.startX
      const dy = e.clientY - s.dragState.startY
      setPan({ x: s.dragState.startPanX + dx, y: s.dragState.startPanY + dy })
      return
    }
    const pos = getGridPos(e)
    setHoveredCell(pos)
  }, [getGridPos])

  const onMouseDown = useCallback((e) => {
    if (e.button === 1 || e.altKey) {
      const s = stateRef.current
      setDragState({ startX: e.clientX, startY: e.clientY, startPanX: s.pan.x, startPanY: s.pan.y })
      stateRef.current.dragState = { startX: e.clientX, startY: e.clientY, startPanX: s.pan.x, startPanY: s.pan.y }
      e.preventDefault()
    }
  }, [])

  const onMouseUp = useCallback((e) => {
    const s = stateRef.current
    if (s.dragState) {
      const moved = Math.abs(e.clientX - s.dragState.startX) + Math.abs(e.clientY - s.dragState.startY)
      if (moved < 6) {
        // was a click
        const pos = getGridPos(e)
        if (pos) {
          moveTo(pos.row, pos.col)
          const cell = stateRef.current.cellMap.get(`${pos.row},${pos.col}`)
          setSelectedCell({ row: pos.row, col: pos.col, cell })
        }
      }
      setDragState(null)
      stateRef.current.dragState = null
      return
    }
    const pos = getGridPos(e)
    if (pos) {
      moveTo(pos.row, pos.col)
      const cell = cellMap.get(`${pos.row},${pos.col}`)
      setSelectedCell({ row: pos.row, col: pos.col, cell })
    }
  }, [getGridPos, moveTo, cellMap])

  const onWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setZoom(z => Math.max(0.3, Math.min(2.5, z + delta)))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // ── Selected cell info ────────────────────────────────────────────────────────
  const selCell = selectedCell?.cell
  const selHex  = selectedCell ? gridToBlockHex(selectedCell.row, selectedCell.col) : null
  const selReq  = selHex ? MM3_BLOCK_REQUIREMENT_BY_HEX.get(selHex) : null

  const mono = { fontFamily: 'Consolas, monospace' }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#04080f', ...mono }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
        borderBottom: `1px solid ${C}22`, background: '#06091a', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ color: C, fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.12em' }}>
          🏨 {es ? 'HOTEL MM3 · MINERÍA 3D' : 'MM3 MINING HOTEL'}
        </span>

        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
          {[
            { id: 'iso', label: es ? '🗺 ISO' : '🗺 ISO' },
            { id: '3p',  label: es ? '👤 3ª P' : '👤 3P' },
            { id: 'fpv', label: es ? '👁 1ª P' : '👁 FPV' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setViewMode(id)} style={{
              ...btnStyle,
              ...(viewMode === id ? { borderColor: C, color: C, background: `${C}11` } : {}),
            }}>{label}</button>
          ))}
        </div>

        {/* Zoom controls — ISO only */}
        {viewMode === 'iso' && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
            <button onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
              style={{ ...btnStyle }}>+</button>
            <span style={{ color: '#475569', fontSize: '0.65rem', alignSelf: 'center', minWidth: 36, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}
              style={{ ...btnStyle }}>−</button>
            <button onClick={() => { setZoom(0.85); setPan({ x: 0, y: 0 }) }}
              style={{ ...btnStyle, fontSize: '0.6rem' }}>
              {es ? 'AJUSTAR' : 'FIT'}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
          {onlineCount > 0 && (
            <span style={{ color: '#4ade80', fontSize: '0.65rem', letterSpacing: '0.08em' }}>
              ● {onlineCount} {es ? 'EN LÍNEA' : 'ONLINE'}
            </span>
          )}
          {myWallet ? (
            <span style={{ color: myColor, fontSize: '0.65rem', border: `1px solid ${myColor}44`, borderRadius: 4, padding: '2px 8px' }}>
              {myWallet.slice(0, 6)}…{myWallet.slice(-4)}
            </span>
          ) : (
            <span style={{ color: '#475569', fontSize: '0.65rem' }}>
              {es ? 'conecta wallet para moverte' : 'connect wallet to move'}
            </span>
          )}
          <Link href="/mining" style={{ color: '#475569', fontSize: '0.65rem', textDecoration: 'none', border: '1px solid #1e293b', borderRadius: 4, padding: '2px 8px' }}>
            ← {es ? 'Minería 2D' : '2D Mining'}
          </Link>
        </div>
      </div>

      {/* ── Canvas area ──────────────────────────────────────────────────────── */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: viewMode === 'iso' ? (dragState ? 'grabbing' : 'crosshair') : 'default' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C, fontSize: '0.75rem', letterSpacing: '0.12em', zIndex: 10 }}>
            {es ? '⟳ CARGANDO HOTEL…' : '⟳ LOADING HOTEL…'}
          </div>
        )}

        {/* ISO view */}
        {viewMode === 'iso' && (
          <>
            <canvas
              ref={canvasRef}
              tabIndex={0}
              style={{ display: 'block', outline: 'none' }}
              onMouseMove={onMouseMove}
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
              onMouseLeave={() => setHoveredCell(null)}
            />
            <div style={{
              position: 'absolute', bottom: 8, right: 12,
              color: '#1e293b', fontSize: '0.58rem', letterSpacing: '0.06em', textAlign: 'right', pointerEvents: 'none',
            }}>
              {es ? 'WASD / ↑↓←→ · click → mover · rueda → zoom · alt+drag → pan' : 'WASD / arrows · click → move · wheel → zoom · alt+drag → pan'}
            </div>
            {hoveredCell && !selectedCell && (
              <div style={{
                position: 'absolute', top: 10, left: 12,
                color: '#475569', fontSize: '0.62rem', letterSpacing: '0.08em', pointerEvents: 'none',
              }}>
                {gridToBlockHex(hoveredCell.row, hoveredCell.col)} [{hoveredCell.row},{hoveredCell.col}]
              </div>
            )}
          </>
        )}

        {/* 3rd-person / FPV view */}
        {(viewMode === '3p' || viewMode === 'fpv') && !loading && (
          <MiningHotelFPV
            cellMap={cellMap}
            presenceMap={presenceMap}
            myWallet={myWallet}
            myColor={myColor}
            initRow={myPos.row}
            initCol={myPos.col}
            onPositionChange={(row, col) => {
              setMyPos({ row, col })
              setSelectedCell(null)
            }}
            es={es}
            mode={viewMode === '3p' ? 'tpv' : 'fpv'}
          />
        )}
      </div>

      {/* ── Info Panel ───────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, borderTop: `1px solid ${C}18`, background: '#070b16',
        padding: '8px 16px', minHeight: 56, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        {selectedCell ? (
          <>
            <div>
              <span style={{ color: C, fontSize: '0.7rem', fontWeight: 700 }}>{selHex}</span>
              <span style={{ color: '#334155', fontSize: '0.62rem', marginLeft: 8 }}>
                [{selectedCell.row},{selectedCell.col}]
              </span>
            </div>

            {selCell?.emoji && (
              <span style={{ fontSize: '1.1rem' }}>{selCell.emoji}</span>
            )}

            {selCell?.isMarket && (
              <span style={{ color: C, fontSize: '0.68rem' }}>
                {es ? (selCell.titleEs || selCell.titleEn) : (selCell.titleEn || selCell.titleEs)}
              </span>
            )}

            {selCell?.owner ? (
              <span style={{ color: colorFromAddress(selCell.owner), fontSize: '0.65rem', border: `1px solid ${colorFromAddress(selCell.owner)}33`, borderRadius: 3, padding: '1px 6px' }}>
                {selCell.owner.slice(0, 8)}…{selCell.owner.slice(-5)}
              </span>
            ) : (
              <span style={{ color: '#1e293b', fontSize: '0.65rem' }}>
                {es ? 'sin reclamar' : 'unclaimed'}
              </span>
            )}

            {selReq && (
              <span style={{ color: '#334155', fontSize: '0.6rem' }}>
                {es ? `lvl mín. ${selReq.minLevel}` : `min lvl ${selReq.minLevel}`}
              </span>
            )}

            {selCell?.priceEur > 0 && (
              <span style={{ color: '#fb923c', fontSize: '0.65rem' }}>
                {selCell.priceEur} EUR
              </span>
            )}

            <button
              onClick={() => setSelectedCell(null)}
              style={{ marginLeft: 'auto', ...btnStyle, fontSize: '0.6rem', color: '#334155', borderColor: '#1e293b' }}
            >
              ✕
            </button>
          </>
        ) : (
          <span style={{ color: '#1e293b', fontSize: '0.62rem', letterSpacing: '0.1em' }}>
            {es ? 'CLICK EN CUALQUIER ROOM PARA VER DETALLES · WASD O FLECHAS PARA MOVERTE' : 'CLICK ANY ROOM FOR DETAILS · WASD OR ARROWS TO MOVE'}
          </span>
        )}
      </div>
    </div>
  )
}

const btnStyle = {
  background: 'transparent',
  border: `1px solid #1e293b`,
  color: '#475569',
  padding: '2px 8px',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'Consolas, monospace',
  fontSize: '0.7rem',
}
