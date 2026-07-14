'use client'

import { useEffect, useRef } from 'react'
import {
  getMiningMapGroundFeatures,
  getMiningMapAmbientObstacles,
  FROST_COLISEUM_ARENA,
  PEACH_CASTLE_ARENA,
  DESERT_OASIS_ARENA,
  MYSTIC_ISLE_ARENA,
} from '@/lib/mining-map-ambient'
import { getMiningMapLabel, getMiningMapEdgeState } from '@/lib/mining-maps'
import { MINING_CHAIN_NODE_POSITION, NODE_DICE_POSITION } from '@/lib/mining-world-layout'
import { MINING_PORTAL_NODES, getBlocksForMap, placeMiningVisualBlock } from '@/lib/mining-visual-layout'
import { MARKET_COMMANDS } from '@/lib/mining-commands'

// Real NFTJI market slots with their fixed emojis: each catalog key encodes
// the chain hex (mm3-023 → #023), and the same placer the game uses turns it
// into its map + cell. Fully static — no Supabase.
const NFTJI_MARKET_SPOTS = (() => {
  const byMap = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  for (const cmd of MARKET_COMMANDS) {
    const hexPart = String(cmd.key || '').split('-')[1]
    if (!hexPart) continue
    const pos = placeMiningVisualBlock(`#${hexPart.toUpperCase()}`)
    if (!pos) continue
    byMap[String(pos.mapId || '1')]?.push({ row: pos.row, col: pos.col, emoji: cmd.emoji })
  }
  return byMap
})()
import { getBossStatuesForMap } from '@/lib/mining-boss-statue-registry'
import { drawMinimapFlag } from '@/lib/minimap-flags'
import { RL_NODE_POSITION } from '@/lib/mining-rl-mount'
import { drawRlBadge } from '@/lib/rl-badge'
import { getGatewayTravelVisual } from '@/lib/mining-gateway-travel-visual'
import {
  CIPHER_HOUSE_STRUCTURE_CELLS,
  CRYPTO_COLOSSEUM_BOUNDS,
  HOUSE_POOL_HEAL_ZONE,
} from '@/lib/mining-world-layout'
import { M3_PUTIN_BOSS_SPAWN } from '@/lib/m3-putin-boss'
import { M4_KIM_BOSS_SPAWN } from '@/lib/m4-kim-boss'
import { M5_TRUMP_BOSS_SPAWN } from '@/lib/m5-trump-boss'

const BOSS_SPAWNS = { 3: M3_PUTIN_BOSS_SPAWN, 4: M4_KIM_BOSS_SPAWN, 5: M5_TRUMP_BOSS_SPAWN }

const GRID = 56 // cells per map side (rows = cols)

// Cross layout: tile coords (col, row) in a 3×3 tile grid.
const WORLD_TILES = [
  { mapId: '2', tx: 1, ty: 0 },
  { mapId: '5', tx: 0, ty: 1 },
  { mapId: '1', tx: 1, ty: 1 },
  { mapId: '4', tx: 2, ty: 1 },
  { mapId: '3', tx: 1, ty: 2 },
]

const MAP_ACCENT = {
  1: '#22d3ee',
  2: '#38bdf8',
  3: '#fb923c',
  4: '#fbbf24',
  5: '#f472b6',
}

// Same fills the in-game minimap uses for ground features.
const FEATURE_FILL = {
  river: 'rgba(76,158,196,.30)',
  lagoon: 'rgba(46,106,140,.34)',
  field: 'rgba(74,222,128,.26)',
  plaza: 'rgba(201,187,168,.28)',
  causeway: 'rgba(201,187,168,.34)',
  default: 'rgba(123,92,62,.30)',
}

// One standardized venue ring per map: the footprint of its central landmark,
// same stroke everywhere, accent-coloured. M2 uses the stadium's real ellipse;
// M3 rings the castle (anchor at row 48); M4/M5 ring their central oasis/isle.
const MAP_ARENAS = {
  2: FROST_COLISEUM_ARENA,
  3: { ...PEACH_CASTLE_ARENA, a: 6.5, b: 6.5 },
  4: { ...DESERT_OASIS_ARENA, a: 10, b: 10 },
  5: { ...MYSTIC_ISLE_ARENA, a: 10, b: 10 },
}

function drawMapTile(ctx, mapId, ox, oy, size, es) {
  const cs = size / GRID
  const px = (col) => ox + col * cs
  const py = (row) => oy + row * cs
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, size, size)
  ctx.clip()

  // Base + the exact quadrant tints and 7-cell grid the in-game minimap draws.
  ctx.fillStyle = 'rgba(1,6,14,.96)'
  ctx.fillRect(ox, oy, size, size)
  const half = size / 2
  ctx.fillStyle = 'rgba(46,86,118,.13)'
  ctx.fillRect(ox, oy, half, half)
  ctx.fillStyle = 'rgba(173,117,55,.12)'
  ctx.fillRect(ox + half, oy, half, half)
  ctx.fillStyle = 'rgba(68,151,190,.13)'
  ctx.fillRect(ox, oy + half, half, half)
  ctx.fillStyle = 'rgba(157,48,31,.13)'
  ctx.fillRect(ox + half, oy + half, half, half)
  ctx.strokeStyle = 'rgba(67,194,220,.08)'
  ctx.lineWidth = 0.5
  for (let n = 7; n < GRID; n += 7) {
    ctx.beginPath()
    ctx.moveTo(px(n), oy)
    ctx.lineTo(px(n), oy + size)
    ctx.moveTo(ox, py(n))
    ctx.lineTo(ox + size, py(n))
    ctx.stroke()
  }

  // Ground features — same rects and fills the real minimap draws.
  for (const feature of getMiningMapGroundFeatures(mapId)) {
    ctx.fillStyle = FEATURE_FILL[feature.kind] || FEATURE_FILL.default
    const fx0 = Math.max(0, feature.minCol)
    const fx1 = Math.min(GRID, feature.maxCol)
    const fy0 = Math.max(0, feature.minRow)
    const fy1 = Math.min(GRID, feature.maxRow)
    ctx.fillRect(px(fx0), py(fy0), (fx1 - fx0) * cs, (fy1 - fy0) * cs)
  }

  // Gateway corridor strips on open edges (stone causeway tint).
  const edges = getMiningMapEdgeState(mapId)
  const depth = 3 * cs
  ctx.fillStyle = 'rgba(201,187,168,.40)'
  if (edges.north?.open) ctx.fillRect(px(1), py(1), 54 * cs, depth)
  if (edges.south?.open) ctx.fillRect(px(1), py(54) - depth + cs, 54 * cs, depth)
  if (edges.west?.open) ctx.fillRect(px(1), py(1), depth, 54 * cs)
  if (edges.east?.open) ctx.fillRect(px(54) - depth + cs, py(1), depth, 54 * cs)

  // Every mineable block on this map — same unmined-cell fill as the real map.
  ctx.fillStyle = 'rgba(72,139,172,.50)'
  for (const pos of getBlocksForMap(mapId).values()) {
    ctx.fillRect(px(pos.col) + cs * 0.18, py(pos.row) + cs * 0.18, Math.max(0.8, cs * 0.64), Math.max(0.8, cs * 0.64))
  }

  // Ambient obstacle walls (arena tiers, castle walls, ruins…) — same inset
  // and alpha the live minimap uses for world obstacles.
  const obstacleInset = Math.max(0.12, cs * 0.12)
  for (const [key, obstacle] of getMiningMapAmbientObstacles(mapId)) {
    const [row, col] = key.split(',').map(Number)
    const base = obstacle?.base
    ctx.fillStyle = Array.isArray(base)
      ? `rgba(${base[0]},${base[1]},${base[2]},.18)`
      : 'rgba(105,132,154,.22)'
    ctx.fillRect(px(col) + obstacleInset, py(row) + obstacleInset, Math.max(0.65, cs - obstacleInset * 2), Math.max(0.65, cs - obstacleInset * 2))
  }

  // Arena ring (peripheral maps).
  const arena = MAP_ARENAS[mapId]
  if (arena) {
    ctx.strokeStyle = `${MAP_ACCENT[mapId] || '#22d3ee'}66`
    ctx.lineWidth = Math.max(1, cs * 0.5)
    ctx.beginPath()
    ctx.ellipse(px(arena.col), py(arena.row), (arena.a || 18) * cs, (arena.b || 18) * cs, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  if (mapId === '1') {
    // Cipher House cell-by-cell (same structure cells the world builds) + pool.
    ctx.fillStyle = 'rgba(105,132,154,.22)'
    for (const key of CIPHER_HOUSE_STRUCTURE_CELLS) {
      const [row, col] = key.split(',').map(Number)
      ctx.fillRect(px(col) + obstacleInset, py(row) + obstacleInset, Math.max(0.65, cs - obstacleInset * 2), Math.max(0.65, cs - obstacleInset * 2))
    }
    ctx.fillStyle = 'rgba(56,189,248,.38)'
    ctx.fillRect(
      ox + HOUSE_POOL_HEAL_ZONE.minX * cs, oy + HOUSE_POOL_HEAL_ZONE.minZ * cs,
      (HOUSE_POOL_HEAL_ZONE.maxX - HOUSE_POOL_HEAL_ZONE.minX) * cs,
      (HOUSE_POOL_HEAL_ZONE.maxZ - HOUSE_POOL_HEAL_ZONE.minZ) * cs,
    )
    // Crypto Colosseum ring — same single-ring standard as the other venues.
    const colMidCol = (CRYPTO_COLOSSEUM_BOUNDS.minCol + CRYPTO_COLOSSEUM_BOUNDS.maxCol + 1) / 2
    const colMidRow = (CRYPTO_COLOSSEUM_BOUNDS.minRow + CRYPTO_COLOSSEUM_BOUNDS.maxRow + 1) / 2
    const colR = ((CRYPTO_COLOSSEUM_BOUNDS.maxCol - CRYPTO_COLOSSEUM_BOUNDS.minCol) / 2) * cs
    ctx.strokeStyle = `${MAP_ACCENT[1]}66`
    ctx.lineWidth = Math.max(1, cs * 0.5)
    ctx.beginPath()
    ctx.arc(px(colMidCol), py(colMidRow), colR, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Travel icons toward adjacent maps on the outer sea ring.
  ctx.font = `${Math.max(6, size * 0.045)}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const side of ['north', 'south', 'east', 'west']) {
    const edge = edges[side]
    if (!edge?.open) continue
    const travel = getGatewayTravelVisual(edge.targetMapId)
    const cx = side === 'west' ? px(0.5) : side === 'east' ? px(55.5) : px(28)
    const cy = side === 'north' ? py(0.5) : side === 'south' ? py(55.5) : py(28)
    ctx.fillText(travel.emoji, cx, cy)
  }

  // Frame + label chip, mirroring the in-game minimap header.
  const accent = MAP_ACCENT[mapId] || '#22d3ee'
  ctx.strokeStyle = `${accent}55`
  ctx.lineWidth = 1
  ctx.strokeRect(ox + 0.5, oy + 0.5, size - 1, size - 1)
  const label = `M${mapId} · ${getMiningMapLabel(mapId, es)}`
  ctx.font = `bold ${Math.max(7, size * 0.052)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const tw = ctx.measureText(label).width + 8
  const lh = Math.max(10, size * 0.075)
  ctx.fillStyle = 'rgba(1,7,14,.92)'
  ctx.fillRect(ox + size / 2 - tw / 2, oy + 2, tw, lh)
  ctx.fillStyle = accent
  ctx.fillText(label, ox + size / 2, oy + 2 + lh / 2)
  ctx.restore()
}

/** Animated marker overlay for one tile — same motion grammar as the in-game
    minimap: markets bob, nodes breathe, the chain node breathes slower, statue
    flags wave and boss flags bob + pulse. Deterministic client data only. */
function drawTileMarkers(ctx, mapId, ox, oy, size, t) {
  const cs = size / GRID
  const px = (col) => ox + col * cs
  const py = (row) => oy + row * cs
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, size, size)
  ctx.clip()

  // Emoji chip with colored ring, like the real minimap.
  const emojiChip = (row, col, emoji, color, shape = 'circle', dy = 0, scale = 1) => {
    const cx = px(col + 0.5)
    const cy = py(row + 0.5) + dy
    const r = Math.max(4.5, size * 0.035) * scale
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = 3
    ctx.fillStyle = 'rgba(1,7,14,.94)'
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    if (shape === 'square') ctx.rect(cx - r, cy - r, r * 2, r * 2)
    else ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.font = `${Math.round(r * 1.25)}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, cx, cy + r * 0.08)
    ctx.restore()
  }
  const breatheScale = (speed, phase) => 1 + Math.sin(t * speed + phase) * 0.05

  if (mapId === '1') {
    for (const node of MINING_PORTAL_NODES) {
      emojiChip(node.row, node.col, node.emoji, node.color, 'circle', 0, breatheScale(1.6, node.row * 1.3 + node.col * 0.7))
    }
    emojiChip(MINING_CHAIN_NODE_POSITION.row, MINING_CHAIN_NODE_POSITION.col, '⬡', '#facc15', 'circle', 0, breatheScale(0.9, 0))
    emojiChip(NODE_DICE_POSITION.row, NODE_DICE_POSITION.col, '🎲', '#facc15', 'circle', 0, breatheScale(1.6, 2.1))
  }
  // NFTJI market blocks with their real fixed emojis, amber-framed like the
  // live minimap's market cells — gentle bob, phase per cell.
  for (const slot of NFTJI_MARKET_SPOTS[String(mapId)] || []) {
    const bob = Math.sin(t * 2 + (slot.row * 7 + slot.col) * 0.9) * 0.8
    emojiChip(slot.row, slot.col, slot.emoji, '#fb923c', 'square', bob)
  }
  if (mapId === '2') {
    // Rocket-league badge (car + boost + ball), same art as the live minimap.
    const x = px(RL_NODE_POSITION.col + 0.5)
    const y = py(RL_NODE_POSITION.row + 0.5)
    const s = breatheScale(1.6, 1.2)
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    ctx.translate(-x, -y)
    drawRlBadge(ctx, x, y, Math.max(5, size * 0.04), { ringColor: '#0ea5e9' })
    ctx.restore()
  }
  // Boss statues marked with their country flag (painted — flag emojis do not
  // render on Windows canvases), ringed in statue colour; the flag waves.
  for (const statue of getBossStatuesForMap(String(mapId))) {
    // Same flag size standard as the boss markers below.
    const flagW = Math.max(10, cs * 3.0)
    const flagH = flagW * 0.62
    ctx.save()
    ctx.translate(px(statue.gx), py(statue.gy))
    ctx.rotate(Math.sin(t * 1.4 + statue.gx) * 0.06)
    ctx.shadowColor = statue.color || '#eab308'
    ctx.shadowBlur = 4
    drawMinimapFlag(ctx, -flagW / 2, -flagH / 2, flagW, flagH, statue.flag)
    ctx.shadowBlur = 0
    ctx.strokeStyle = statue.color || '#eab308'
    ctx.lineWidth = 0.8
    ctx.strokeRect(-flagW / 2 - 0.4, -flagH / 2 - 0.4, flagW + 0.8, flagH + 0.8)
    ctx.restore()
  }
  // World bosses marked with their striped flag, exactly like the live minimap
  // (flag emojis do not render on Windows canvases) — bob + alpha pulse.
  const bossSpawn = BOSS_SPAWNS[mapId]
  if (bossSpawn) {
    const flagW = Math.max(10, cs * 3.0)
    const flagH = flagW * 0.62
    const fx = px(bossSpawn.col + 0.5) - flagW / 2
    const fy = py(bossSpawn.row + 0.5) - flagH / 2 + Math.sin(t * 2.2) * 0.9
    ctx.save()
    ctx.globalAlpha = 0.82 + Math.sin(t * 3.6) * 0.18
    ctx.shadowColor = '#ef4444'
    ctx.shadowBlur = 5
    drawMinimapFlag(ctx, fx, fy, flagW, flagH, { 3: 'ru', 4: 'kp', 5: 'us' }[String(mapId)])
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 0.8
    ctx.strokeRect(fx - 0.4, fy - 0.4, flagW + 0.8, flagH + 0.8)
    ctx.restore()
  }
  ctx.restore()
}

/**
 * Decorative full-world minimap: the five mining maps joined as one
 * cross-shaped piece, drawn from deterministic client-side data — ground
 * features, ambient walls, arenas, every mineable block, NFTJI market slots,
 * chain/dice/RL/portal nodes, statues, corridors and travel icons. No
 * Supabase, no realtime. The heavy geometry renders once into an offscreen
 * static layer; only the ~20 markers redraw per tick (~30 fps) on top.
 * Pinch on the map zooms it (like the avatar carousel) and, while zoomed,
 * one-finger drag pans — all client-side transforms over the same layers.
 */
export default function HomeWorldMinimap({ es = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let staticLayer = null
    let cssW = 0
    let cssH = 0
    let tile = 0
    let dpr = 1

    const buildStatic = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      cssW = canvas.clientWidth || 330
      tile = cssW / 3
      cssH = tile * 3
      canvas.style.height = `${cssH}px`
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      staticLayer = document.createElement('canvas')
      // Oversampled 1.5× beyond dpr so the static layer stays crisp when the
      // pinch zoom (≤2.5×) blows it up.
      const renderScale = dpr * 1.5
      staticLayer.width = Math.round(cssW * renderScale)
      staticLayer.height = Math.round(cssH * renderScale)
      const sctx = staticLayer.getContext('2d')
      if (!sctx) { staticLayer = null; return }
      sctx.scale(renderScale, renderScale)
      // Connective sea behind the cross so the five islands read as one piece.
      sctx.fillStyle = 'rgba(1,6,14,.85)'
      sctx.fillRect(tile, 0, tile, cssH)
      sctx.fillRect(0, tile, cssW, tile)
      for (const { mapId, tx, ty } of WORLD_TILES) {
        drawMapTile(sctx, mapId, tx * tile, ty * tile, tile, es)
      }
    }

    // ── Pinch-zoom + pan (mobile, same gesture family as the carousel) ──
    const view = { zoom: 1, panX: 0, panY: 0 }
    const pointers = new Map()
    let pinch0 = null
    let suppressClickUntil = 0
    const clampView = () => {
      view.zoom = Math.min(2.5, Math.max(1, view.zoom))
      view.panX = Math.min(0, Math.max(cssW * (1 - view.zoom), view.panX))
      view.panY = Math.min(0, Math.max(cssH * (1 - view.zoom), view.panY))
    }
    const localXY = (e) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const pinchState = () => {
      const [a, b] = [...pointers.values()]
      return {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      }
    }
    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      canvas.setPointerCapture?.(e.pointerId)
      pointers.set(e.pointerId, localXY(e))
      if (pointers.size === 2) {
        pinch0 = { ...pinchState(), zoom: view.zoom, panX: view.panX, panY: view.panY }
      }
    }
    const onMove = (e) => {
      if (!pointers.has(e.pointerId)) return
      const prev = pointers.get(e.pointerId)
      const cur = localXY(e)
      pointers.set(e.pointerId, cur)
      if (pointers.size === 2 && pinch0) {
        const { dist, midX, midY } = pinchState()
        const zoom = Math.min(2.5, Math.max(1, pinch0.zoom * (dist / pinch0.dist)))
        // Keep the world point under the pinch midpoint anchored while zooming.
        view.panX = midX - ((pinch0.midX - pinch0.panX) / pinch0.zoom) * zoom
        view.panY = midY - ((pinch0.midY - pinch0.panY) / pinch0.zoom) * zoom
        view.zoom = zoom
        clampView()
        suppressClickUntil = performance.now() + 450
      } else if (pointers.size === 1 && view.zoom > 1) {
        view.panX += cur.x - prev.x
        view.panY += cur.y - prev.y
        clampView()
        if (Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) > 1.5) {
          suppressClickUntil = performance.now() + 450
        }
      }
    }
    const onUp = (e) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch0 = null
    }
    // A drag/pinch must not bubble into the core button (it would flip the
    // map back to the logo); plain taps still pass through.
    const onClickCapture = (e) => {
      if (performance.now() < suppressClickUntil) {
        e.stopPropagation()
        e.preventDefault()
      }
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('click', onClickCapture, true)

    let raf = 0
    let lastTick = 0
    const tick = (nowMs) => {
      raf = requestAnimationFrame(tick)
      // ~30 fps is plenty for the subtle marker motion — halves the cost.
      if (nowMs - lastTick < 33) return
      lastTick = nowMs
      if (!staticLayer) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)
      ctx.translate(view.panX, view.panY)
      ctx.scale(view.zoom, view.zoom)
      ctx.drawImage(staticLayer, 0, 0, staticLayer.width, staticLayer.height, 0, 0, cssW, cssH)
      const t = nowMs / 1000
      for (const { mapId, tx, ty } of WORLD_TILES) {
        drawTileMarkers(ctx, mapId, tx * tile, ty * tile, tile, t)
      }
    }

    // Rebuild the static layer when the container resizes (e.g. mounted
    // mid-way through the nonagon's open/close width transition).
    let resizeRaf = 0
    const onResize = () => {
      cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(() => { buildStatic(); clampView() })
    }
    buildStatic()
    raf = requestAnimationFrame(tick)
    const observer = new ResizeObserver(onResize)
    observer.observe(canvas)
    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(resizeRaf)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('click', onClickCapture, true)
    }
  }, [es])

  return <canvas ref={canvasRef} className="mm3-home-worldmap" aria-hidden="true" style={{ touchAction: 'none' }} />
}
