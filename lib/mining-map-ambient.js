/**
 * Ambient world elements (type 5) for peripheral mining maps.
 * No minable blocks, portals, specials, or player zones.
 *
 * Every entry is a physics cell (box) consumed by buildPeripheralObstacles:
 *   { base:[r,g,b], label, height, bottom?, biome? }
 * - `bottom` > 0 creates elevated slabs/rails the player can walk under.
 * - `biome` overrides the render-material quadrant (visual grouping only).
 * Player physics: max walkable step 0.58, jump apex ~1.2.
 */

import { MINING_MAP_GATEWAY_COL_BANDS, MINING_MAP_GATEWAY_ROW_BANDS } from './mining-maps'

const W_STONE = [122, 120, 118]
const W_SLATE = [85, 92, 105]
const W_SAND = [108, 106, 102]
const W_DARK = [58, 62, 70]
const W_ICE = [168, 205, 228]
const W_WARM = [216, 178, 124]

function wall(key, base = W_DARK, height = 1.0, label = 'WORLD', extra) {
  return [key, { base, label, height, ...extra }]
}

function ringWalls(centerRow, centerCol, radius, base = W_SLATE, height = 1.1, label = 'WORLD', extra) {
  const entries = []
  for (let dr = -radius; dr <= radius; dr += 1) {
    for (let dc = -radius; dc <= radius; dc += 1) {
      if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue
      if (Math.abs(dr) === radius && Math.abs(dc) === radius) continue
      entries.push(wall(`${centerRow + dr},${centerCol + dc}`, base, height, label, extra))
    }
  }
  return entries
}

function pathStrip(startRow, startCol, length, horizontal = true, gapEvery = 4, extra) {
  const entries = []
  for (let i = 0; i < length; i += 1) {
    if (gapEvery > 0 && i % gapEvery === Math.floor(gapEvery / 2)) continue
    const row = horizontal ? startRow : startRow + i
    const col = horizontal ? startCol + i : startCol
    entries.push(wall(`${row},${col}`, W_SAND, 0.55, 'WORLD', extra))
  }
  return entries
}

// ── Map 2 — Utopia Coliseum (full map) ────────────────────────────────────────
// The entire playable interior is one elliptical stadium. A walkable perimeter
// ring (N/E/W margins + full south plaza) stays clear for gateway transit to M1.
// Five south spines align with MINING_MAP_GATEWAY_COL_BANDS. Physics: concentric
// seating tiers, inner gate ring, outer arcade. Visual decor from DECOR export.
const PLAY_MIN = 1
const PLAY_MAX = 54
/** Visual-only stone piers extending from the shore into the surround sea. */
const GATEWAY_CAUSEWAY_SEA_EXTENT = 22

function buildGatewayCauseways(direction) {
  const features = []
  if (direction === 'north' || direction === 'south') {
    const shoreRow = direction === 'south' ? PLAY_MAX : PLAY_MIN
    const seaRow = direction === 'south' ? PLAY_MAX + GATEWAY_CAUSEWAY_SEA_EXTENT : PLAY_MIN - GATEWAY_CAUSEWAY_SEA_EXTENT
    for (const [min, max] of MINING_MAP_GATEWAY_COL_BANDS) {
      features.push({
        kind: 'causeway',
        causewayDir: direction,
        minRow: Math.min(shoreRow - 0.5, seaRow),
        maxRow: Math.max(shoreRow + 0.5, seaRow),
        minCol: min - 0.15,
        maxCol: max + 0.15,
      })
    }
    return features
  }
  if (direction === 'east' || direction === 'west') {
    const shoreCol = direction === 'east' ? PLAY_MAX : PLAY_MIN
    const seaCol = direction === 'east' ? PLAY_MAX + GATEWAY_CAUSEWAY_SEA_EXTENT : PLAY_MIN - GATEWAY_CAUSEWAY_SEA_EXTENT
    for (const [min, max] of MINING_MAP_GATEWAY_ROW_BANDS) {
      features.push({
        kind: 'causeway',
        causewayDir: direction,
        minRow: min - 0.15,
        maxRow: max + 0.15,
        minCol: Math.min(shoreCol - 0.5, seaCol),
        maxCol: Math.max(shoreCol + 0.5, seaCol),
      })
    }
  }
  return features
}

/** Stadium centre — slightly north so the south plaza has room for M1 exits. */
const ARENA = Object.freeze({ row: 26.5, col: 27.5, a: 21, b: 22.5 })
const ARENA_INNER = 0.40
const ARENA_GATE = 0.52
const ARENA_ARCADE = 1.06
const ARENA_STEPS = Object.freeze([0.55, 1.10, 1.65, 2.20, 2.75])

function arenaEllipse(row, col) {
  const dr = (row - ARENA.row) / ARENA.a
  const dc = (col - ARENA.col) / ARENA.b
  return Math.sqrt(dr * dr + dc * dc)
}

function inGatewayColBand(col) {
  return MINING_MAP_GATEWAY_COL_BANDS.some(([min, max]) => col >= min && col <= max)
}

/** Walkable cells: perimeter ring + compass cross + south gateway spines to M1. */
function isPerimeterFree(row, col) {
  if (row <= 4 || col <= 4 || col >= 51) return true
  if (row >= 49) return true
  if (row >= 36 && inGatewayColBand(col)) return true
  if (Math.abs(row - ARENA.row) <= 1.5) return true
  if (Math.abs(col - ARENA.col) <= 1.5) return true
  return false
}

function inArenaCompassGateway(row, col) {
  return Math.abs(row - ARENA.row) <= 1.5 || Math.abs(col - ARENA.col) <= 1.5
}

function frostColiseum() {
  const out = []
  for (let r = PLAY_MIN; r <= PLAY_MAX; r += 1) {
    for (let c = PLAY_MIN; c <= PLAY_MAX; c += 1) {
      if (isPerimeterFree(r, c)) continue
      const e = arenaEllipse(r, c)
      if (e < ARENA_INNER || e >= ARENA_ARCADE) continue
      if (inArenaCompassGateway(r, c)) continue
      const eastSide = c >= ARENA.col
      const biome = eastSide ? 'coast' : 'ice'
      if (e < ARENA_GATE) {
        if ((r + c) % 2 === 0) out.push(wall(`${r},${c}`, W_SLATE, 1.15, 'ARENA GATE', { biome }))
        continue
      }
      const tierSpan = (ARENA_ARCADE - ARENA_GATE) / ARENA_STEPS.length
      const tier = Math.min(ARENA_STEPS.length - 1, Math.floor((e - ARENA_GATE) / tierSpan))
      if (e < ARENA_ARCADE - 0.08) {
        out.push(wall(`${r},${c}`, eastSide ? W_WARM : W_ICE, ARENA_STEPS[tier], 'ARENA STAND', { biome }))
        continue
      }
      if ((r + c) % 2 === 0) out.push(wall(`${r},${c}`, W_SLATE, 2.9, 'ARENA ARCADE', { biome }))
    }
  }
  return out
}

/** Visual decor descriptors (consumed by the 3D pass only). */
function buildFrostColiseumDecor() {
  const cx = ARENA.col + 0.5
  const cz = ARENA.row + 0.5
  const arches = []
  for (let r = PLAY_MIN; r <= PLAY_MAX; r += 1) {
    for (let c = PLAY_MIN; c <= PLAY_MAX; c += 1) {
      if (isPerimeterFree(r, c)) continue
      const e = arenaEllipse(r, c)
      const isGateRing = e >= ARENA_INNER && e < ARENA_GATE
      const isArcadeRing = e >= ARENA_ARCADE - 0.08 && e < ARENA_ARCADE
      if (!isGateRing && !isArcadeRing) continue
      if (inArenaCompassGateway(r, c)) continue
      if ((r + c) % 2 !== 1) continue
      const x = c + 0.5
      const z = r + 0.5
      const theta = Math.atan2((z - cz) / ARENA.a, (x - cx) / ARENA.b)
      const tx = -Math.sin(theta) * ARENA.b
      const tz = Math.cos(theta) * ARENA.a
      arches.push({
        x, z, yaw: Math.atan2(-tz, tx),
        top: isGateRing ? 1.15 : 2.9,
        span: isGateRing ? 2.05 : 2.1,
        rise: isGateRing ? 0.9 : 1.35,
      })
    }
  }
  const panels = []
  const canopies = []
  for (let i = 0; i < 32; i += 1) {
    const theta = (i / 32) * Math.PI * 2
    const px = cx + Math.cos(theta) * ARENA.b * 0.78
    const pz = cz + Math.sin(theta) * ARENA.a * 0.78
    const side = px >= cx ? 'east' : 'west'
    if (Math.abs(pz - cz) > 2.5 && Math.abs(px - cx) > 2.5) {
      panels.push({ x: px, z: pz, y: 1.60, yaw: Math.atan2(cx - px, cz - pz), tilt: -0.98, width: 2.7, height: 2.5, side })
    }
    const qx = cx + Math.cos(theta) * ARENA.b * 1.02
    const qz = cz + Math.sin(theta) * ARENA.a * 1.02
    if (Math.abs(qz - cz) > 2.8 && Math.abs(qx - cx) > 2.8) {
      canopies.push({ x: qx, z: qz, y: 3.35, yaw: Math.atan2(cx - qx, cz - qz), tilt: 0.38, width: 3.1, height: 2.1, side: qx >= cx ? 'east' : 'west' })
    }
  }
  const banners = []
  for (const arch of arches) {
    if (arch.top < 2) continue
    banners.push({ x: arch.x, z: arch.z, y: 2.30, yaw: Math.atan2(cx - arch.x, cz - arch.z), side: arch.x >= cx ? 'east' : 'west' })
  }
  const topiary = []
  for (let i = 0; i < 24; i += 1) {
    const theta = (i / 24) * Math.PI * 2
    const px = cx + Math.cos(theta) * ARENA.b * 1.12
    const pz = cz + Math.sin(theta) * ARENA.a * 1.12
    if (arenaEllipse(Math.floor(pz), Math.floor(px)) < ARENA_ARCADE + 0.15) {
      topiary.push({ x: px, z: pz })
    }
  }
  const hedges = []
  for (let i = 0; i < 40; i += 1) {
    const theta = (i / 40) * Math.PI * 2
    const px = cx + Math.cos(theta) * (ARENA.b * 1.08 + 0.4)
    const pz = cz + Math.sin(theta) * (ARENA.a * 1.08 + 0.4)
    hedges.push({ x: px, z: pz, yaw: theta, height: 1.35 })
  }
  const statues = []
  const triumphArches = []
  const southFountains = []
  for (const [min, max] of MINING_MAP_GATEWAY_COL_BANDS) {
    const bandCenter = (min + max) / 2 + 0.5
    statues.push({ x: bandCenter, z: 46.5, yaw: 0 })
    triumphArches.push({ x: bandCenter, z: 47.5, yaw: 0, span: max - min + 1.6 })
    southFountains.push({ x: bandCenter, z: 52.5 })
  }
  const energyPanels = []
  for (let i = 0; i < 48; i += 1) {
    const theta = (i / 48) * Math.PI * 2
    const px = cx + Math.cos(theta) * ARENA.b * 0.44
    const pz = cz + Math.sin(theta) * ARENA.a * 0.44
    energyPanels.push({ x: px, z: pz, yaw: theta + Math.PI / 2, side: px >= cx ? 'east' : 'west' })
  }
  const facade = { x: cx, z: cz - ARENA.a * 0.88, yaw: 0 }
  const fountain = { x: cx, z: cz + ARENA.a * 0.55 }
  return {
    arches, panels, canopies, banners, topiary, hedges, statues, triumphArches,
    southFountains, fountain, energyPanels, facade,
    center: { x: cx, z: cz }, a: ARENA.a, b: ARENA.b,
  }
}

export const FROST_COLISEUM_ARENA = ARENA
export const FROST_COLISEUM_DECOR = Object.freeze(buildFrostColiseumDecor())

/** Map 2 — entire map is the Utopia Coliseum. */
const MAP_2_AMBIENT = [
  ...frostColiseum(),
]

/** Map 3–5 — empty interior until full-map venues ship (gateway margins only). */
const MAP_3_AMBIENT = []
const MAP_4_AMBIENT = []
const MAP_5_AMBIENT = []

export const MINING_MAP_AMBIENT_OBSTACLES = Object.freeze({
  '2': new Map(MAP_2_AMBIENT),
  '3': new Map(MAP_3_AMBIENT),
  '4': new Map(MAP_4_AMBIENT),
  '5': new Map(MAP_5_AMBIENT),
})

export function getMiningMapAmbientObstacles(mapId) {
  return MINING_MAP_AMBIENT_OBSTACLES[mapId] || new Map()
}

// ── Visual-only ground features (no physics) ──────────────────────────────────
/** Perimeter ring + gateway spines shared by placeholder peripheral maps. */
function buildPeripheralPerimeterPlazas() {
  return [
    { kind: 'plaza', minRow: 1, maxRow: 4.2, minCol: 1, maxCol: 54 },
    { kind: 'plaza', minRow: 1, maxRow: 54, minCol: 1, maxCol: 4.2 },
    { kind: 'plaza', minRow: 1, maxRow: 54, minCol: 50.8, maxCol: 54 },
    { kind: 'plaza', minRow: 48.8, maxRow: 54, minCol: 1, maxCol: 54 },
  ]
}

/** Empty peripheral map — only margin plazas, gateway spines and sea causeways to M1. */
function buildEmptyPeripheralGroundFeatures(gatewayEdge) {
  const features = buildPeripheralPerimeterPlazas()
  if (gatewayEdge === 'north') {
    for (const [min, max] of MINING_MAP_GATEWAY_COL_BANDS) {
      features.push({ kind: 'plaza', minRow: 1, maxRow: 18, minCol: min - 0.2, maxCol: max + 0.2 })
    }
    features.push(...buildGatewayCauseways('north'))
  } else if (gatewayEdge === 'west') {
    for (const [min, max] of MINING_MAP_GATEWAY_ROW_BANDS) {
      features.push({ kind: 'plaza', minRow: min - 0.2, maxRow: max + 0.2, minCol: 1, maxCol: 18 })
    }
    features.push(...buildGatewayCauseways('west'))
  } else if (gatewayEdge === 'east') {
    for (const [min, max] of MINING_MAP_GATEWAY_ROW_BANDS) {
      features.push({ kind: 'plaza', minRow: min - 0.2, maxRow: max + 0.2, minCol: 36, maxCol: 54 })
    }
    features.push(...buildGatewayCauseways('east'))
  }
  return Object.freeze(features)
}

function buildMap2GroundFeatures() {
  const cx = ARENA.col
  const cz = ARENA.row
  const innerA = ARENA.a * ARENA_INNER
  const innerB = ARENA.b * ARENA_INNER
  const features = [
    // Pitch — elliptical texture masks the rect
    { kind: 'field', minRow: cz - innerA, maxRow: cz + innerA, minCol: cx - innerB, maxCol: cx + innerB },
    // Annular concourse between field and stands
    { kind: 'plaza', minRow: cz - ARENA.a * 0.38, maxRow: cz + ARENA.a * 0.38, minCol: cx - ARENA.b * 0.38, maxCol: cx + ARENA.b * 0.38 },
  ]
  // Perimeter stone ring (N/E/W margins)
  features.push({ kind: 'plaza', minRow: 1, maxRow: 4.2, minCol: 1, maxCol: 54 })
  features.push({ kind: 'plaza', minRow: 1, maxRow: 54, minCol: 1, maxCol: 4.2 })
  features.push({ kind: 'plaza', minRow: 1, maxRow: 54, minCol: 50.8, maxCol: 54 })
  features.push({ kind: 'plaza', minRow: 48.8, maxRow: 54, minCol: 1, maxCol: 54 })
  // South gateway avenues (stone paths to M1)
  for (const [min, max] of MINING_MAP_GATEWAY_COL_BANDS) {
    features.push({ kind: 'plaza', minRow: 36, maxRow: 54, minCol: min - 0.2, maxCol: max + 0.2 })
  }
  // Stone causeways over the surround sea — south exits toward M1.
  features.push(...buildGatewayCauseways('south'))
  // Compass cross walkways
  features.push({ kind: 'plaza', minRow: cz - 1.8, maxRow: cz + 1.8, minCol: 1, maxCol: 54 })
  features.push({ kind: 'plaza', minRow: 1, maxRow: 54, minCol: cx - 1.8, maxCol: cx + 1.8 })
  return Object.freeze(features)
}

/** M1 — visual stone avenues + sea causeways on all four gateway edges. */
function buildMap1GroundFeatures() {
  const features = [
    ...buildGatewayCauseways('north'),
    ...buildGatewayCauseways('south'),
    ...buildGatewayCauseways('east'),
    ...buildGatewayCauseways('west'),
  ]
  for (const [min, max] of MINING_MAP_GATEWAY_COL_BANDS) {
    features.push({ kind: 'plaza', minRow: 1, maxRow: 18, minCol: min - 0.2, maxCol: max + 0.2 })
    features.push({ kind: 'plaza', minRow: 36, maxRow: 54, minCol: min - 0.2, maxCol: max + 0.2 })
  }
  for (const [min, max] of MINING_MAP_GATEWAY_ROW_BANDS) {
    features.push({ kind: 'plaza', minRow: min - 0.2, maxRow: max + 0.2, minCol: 36, maxCol: 54 })
    features.push({ kind: 'plaza', minRow: min - 0.2, maxRow: max + 0.2, minCol: 1, maxCol: 18 })
  }
  return Object.freeze(features)
}

export const MINING_MAP_GROUND_FEATURES = Object.freeze({
  '1': buildMap1GroundFeatures(),
  '2': buildMap2GroundFeatures(),
  '3': buildEmptyPeripheralGroundFeatures('north'),
  '4': buildEmptyPeripheralGroundFeatures('west'),
  '5': buildEmptyPeripheralGroundFeatures('east'),
})

export function getMiningMapGroundFeatures(mapId) {
  return MINING_MAP_GROUND_FEATURES[mapId] || []
}
