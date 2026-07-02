/**
 * Ambient world elements (type 5) for peripheral mining maps.
 * No minable blocks, portals, specials, or player zones.
 */

const W_STONE = [122, 120, 118]
const W_SLATE = [85, 92, 105]
const W_SAND = [108, 106, 102]
const W_DARK = [58, 62, 70]

function wall(key, base = W_DARK, height = 1.0) {
  return [key, { base, label: 'WORLD', height }]
}

function ringWalls(centerRow, centerCol, radius, base = W_SLATE, height = 1.1) {
  const entries = []
  for (let dr = -radius; dr <= radius; dr += 1) {
    for (let dc = -radius; dc <= radius; dc += 1) {
      if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue
      if (Math.abs(dr) === radius && Math.abs(dc) === radius) continue
      entries.push(wall(`${centerRow + dr},${centerCol + dc}`, base, height))
    }
  }
  return entries
}

function pathStrip(startRow, startCol, length, horizontal = true, gapEvery = 4) {
  const entries = []
  for (let i = 0; i < length; i += 1) {
    if (gapEvery > 0 && i % gapEvery === Math.floor(gapEvery / 2)) continue
    const row = horizontal ? startRow : startRow + i
    const col = horizontal ? startCol + i : startCol
    entries.push(wall(`${row},${col}`, W_SAND, 0.55))
  }
  return entries
}

/** Map 2 — Northern Wastes: frozen citadel + ice pillars */
const MAP_2_AMBIENT = [
  ...ringWalls(18, 28, 4, W_SLATE, 1.35),
  wall('18,28', W_STONE, 2.4),
  wall('16,26', W_SLATE, 1.8),
  wall('16,30', W_SLATE, 1.8),
  wall('20,26', W_SLATE, 1.8),
  wall('20,30', W_SLATE, 1.8),
  wall('14,28', W_DARK, 1.5),
  wall('22,28', W_DARK, 1.5),
  ...pathStrip(24, 20, 18, true, 5),
  ...pathStrip(12, 18, 20, false, 5),
  wall('10,40', W_SLATE, 1.2),
  wall('10,42', W_SLATE, 1.2),
  wall('44,16', W_DARK, 1.1),
  wall('44,18', W_DARK, 1.1),
]

/** Map 3 — Southern Furnace: volcanic ring + ash pillars */
const MAP_3_AMBIENT = [
  ...ringWalls(34, 28, 5, W_DARK, 1.2),
  wall('34,28', W_DARK, 2.2),
  wall('32,24', W_STONE, 1.6),
  wall('32,32', W_STONE, 1.6),
  wall('36,24', W_STONE, 1.6),
  wall('36,32', W_STONE, 1.6),
  ...pathStrip(40, 14, 24, true, 4),
  ...pathStrip(22, 20, 16, false, 4),
  wall('48,44', W_DARK, 1.3),
  wall('50,44', W_DARK, 1.3),
  wall('16,48', W_SLATE, 1.1),
  wall('18,48', W_SLATE, 1.1),
]

/** Map 4 — Eastern Reach: coastal ruins + broken pier */
const MAP_4_AMBIENT = [
  ...ringWalls(24, 36, 3, W_SAND, 0.95),
  wall('24,36', W_STONE, 1.9),
  wall('22,34', W_SLATE, 1.3),
  wall('22,38', W_SLATE, 1.3),
  wall('26,34', W_SLATE, 1.3),
  wall('26,38', W_SLATE, 1.3),
  ...pathStrip(30, 10, 20, false, 5),
  ...pathStrip(18, 42, 10, true, 3),
  wall('12,12', W_DARK, 1.0),
  wall('14,12', W_DARK, 1.0),
  wall('44,50', W_SAND, 0.8),
  wall('46,50', W_SAND, 0.8),
  wall('48,50', W_SAND, 0.8),
]

/** Map 5 — Western Peaks: monolith ridge + canyon path */
const MAP_5_AMBIENT = [
  ...ringWalls(26, 20, 4, W_STONE, 1.25),
  wall('26,20', W_DARK, 2.5),
  wall('24,16', W_SLATE, 1.7),
  wall('24,24', W_SLATE, 1.7),
  wall('28,16', W_SLATE, 1.7),
  wall('28,24', W_SLATE, 1.7),
  ...pathStrip(20, 8, 22, true, 4),
  ...pathStrip(34, 30, 18, false, 5),
  wall('10,24', W_DARK, 1.4),
  wall('12,24', W_DARK, 1.4),
  wall('42,10', W_STONE, 1.2),
  wall('42,12', W_STONE, 1.2),
]

export const MINING_MAP_AMBIENT_OBSTACLES = Object.freeze({
  '2': new Map(MAP_2_AMBIENT),
  '3': new Map(MAP_3_AMBIENT),
  '4': new Map(MAP_4_AMBIENT),
  '5': new Map(MAP_5_AMBIENT),
})

export function getMiningMapAmbientObstacles(mapId) {
  return MINING_MAP_AMBIENT_OBSTACLES[mapId] || new Map()
}
