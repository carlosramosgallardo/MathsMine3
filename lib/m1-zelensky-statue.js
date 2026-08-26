import { MINING_CHAIN_NODE_POSITION } from './mining-world-layout'
import { createFixedTexturedStatueVisual, flashFixedTexturedStatue } from './fixed-textured-statue'

export const M1_ZELENSKY_STATUE_ID = 'm1_zelensky_statue'
/** Textured Ready-Player-style body sits on the MM3 plinth — slightly shorter than Milei. */
export const M1_ZELENSKY_STATUE_SCALE = 1.52
/** Multi-material prop: Volodymyr Oleksandrovych Z. (Sketchfab, CC BY 4.0). */
export const M1_ZELENSKY_STATUE_MODEL_URL = '/models/zelenski.glb'

/** Open SW plaza on M1 — clear of markets (44,4)/(44,18), portals and the Colosseum. */
export const M1_ZELENSKY_STATUE_POSITION = Object.freeze({
  row: 44,
  col: 11,
  gx: 11.5,
  gy: 44.5,
})

export const M1_ZELENSKY_STATUE_EXCLUSION_CENTER = Object.freeze({
  row: M1_ZELENSKY_STATUE_POSITION.row + 0.5,
  col: M1_ZELENSKY_STATUE_POSITION.col + 0.5,
})
export const M1_ZELENSKY_STATUE_EXCLUSION_RADIUS = 5
export const M1_ZELENSKY_STATUE_EXCLUSION_RADIUS_SQ = M1_ZELENSKY_STATUE_EXCLUSION_RADIUS * M1_ZELENSKY_STATUE_EXCLUSION_RADIUS

export function isInM1ZelenskyStatueExclusion(mapId, row, col) {
  if (String(mapId) !== '1') return false
  const dr = row - M1_ZELENSKY_STATUE_EXCLUSION_CENTER.row
  const dc = col - M1_ZELENSKY_STATUE_EXCLUSION_CENTER.col
  return dr * dr + dc * dc <= M1_ZELENSKY_STATUE_EXCLUSION_RADIUS_SQ
}

export function addM1ZelenskyStatueReservedCells(reservedSet) {
  if (!reservedSet) return
  const minRow = Math.ceil(M1_ZELENSKY_STATUE_EXCLUSION_CENTER.row - M1_ZELENSKY_STATUE_EXCLUSION_RADIUS)
  const maxRow = Math.floor(M1_ZELENSKY_STATUE_EXCLUSION_CENTER.row + M1_ZELENSKY_STATUE_EXCLUSION_RADIUS)
  const minCol = Math.ceil(M1_ZELENSKY_STATUE_EXCLUSION_CENTER.col - M1_ZELENSKY_STATUE_EXCLUSION_RADIUS)
  const maxCol = Math.floor(M1_ZELENSKY_STATUE_EXCLUSION_CENTER.col + M1_ZELENSKY_STATUE_EXCLUSION_RADIUS)
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!isInM1ZelenskyStatueExclusion('1', row, col)) continue
      reservedSet.add(`${row},${col}`)
    }
  }
}

export function addM1ZelenskyStatueExclusions(occupiedSet) {
  addM1ZelenskyStatueReservedCells(occupiedSet)
}

/** Textured Zelensky prop — Milei plinth, walks on the home rail. */
export function createM1ZelenskyStatueVisual(THREE, lowDetail = false) {
  const { gx, gy } = M1_ZELENSKY_STATUE_POSITION
  const centerGx = MINING_CHAIN_NODE_POSITION.col + 0.5
  const centerGy = MINING_CHAIN_NODE_POSITION.row + 0.5
  return createFixedTexturedStatueVisual(THREE, {
    name: 'm1ZelenskyStatue',
    bodyName: 'm1ZelenskyStatueBody',
    flagKey: 'm1ZelenskyStatue',
    bossStatueId: M1_ZELENSKY_STATUE_ID,
    modelUrl: M1_ZELENSKY_STATUE_MODEL_URL,
    scale: M1_ZELENSKY_STATUE_SCALE,
    gx,
    gy,
    yaw: Math.atan2(centerGx - gx, centerGy - gy),
    placeholderColor: '#4b5a3a',
    lowDetail,
    eyePoints: [
      { x: -0.038, y: 0.92, z: 0.12 },
      { x: 0.038, y: 0.92, z: 0.12 },
    ],
    eyeSize: 0.055,
    eyeLine: 0.78,
    withPlinth: true,
    withCapsuleDriver: true,
    capsuleBulk: 1,
    capsuleSleeve: 'long',
    capsuleSkinSeed: 'zelensky',
  })
}

export function flashM1ZelenskyStatue(group, ms = 1500) {
  flashFixedTexturedStatue(group, ms)
}
