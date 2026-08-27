import { createFixedTexturedStatueVisual } from './fixed-textured-statue'
import { STATUE_PLAZA_GROUP_SCALE } from './statue-plinth'

export const M2_MACRON_STATUE_ID = 'm2_macron_statue'
/** Textured avatar on the shared Roman column base. */
export const M2_MACRON_STATUE_SCALE = STATUE_PLAZA_GROUP_SCALE
/** Multi-material prop: Emmanuel Macron Avatar (Sketchfab, CC BY 4.0). */
export const M2_MACRON_STATUE_MODEL_URL = '/models/macron.glb'

/** Open snowfield on M2's south entrance from M1 — west of the coliseum gate
    approach, clear of the gateway col bands and their arch/fountain decor. */
export const M2_MACRON_STATUE_POSITION = Object.freeze({
  row: 50,
  col: 25,
  gx: 25.5,
  gy: 50.5,
})

export const M2_MACRON_STATUE_EXCLUSION_CENTER = Object.freeze({
  row: M2_MACRON_STATUE_POSITION.row + 0.5,
  col: M2_MACRON_STATUE_POSITION.col + 0.5,
})
export const M2_MACRON_STATUE_EXCLUSION_RADIUS = 5
export const M2_MACRON_STATUE_EXCLUSION_RADIUS_SQ = M2_MACRON_STATUE_EXCLUSION_RADIUS * M2_MACRON_STATUE_EXCLUSION_RADIUS

export function isInM2MacronStatueExclusion(mapId, row, col) {
  if (String(mapId) !== '2') return false
  const dr = row - M2_MACRON_STATUE_EXCLUSION_CENTER.row
  const dc = col - M2_MACRON_STATUE_EXCLUSION_CENTER.col
  return dr * dr + dc * dc <= M2_MACRON_STATUE_EXCLUSION_RADIUS_SQ
}

export function addM2MacronStatueExclusions(occupiedSet) {
  if (!occupiedSet) return
  const minRow = Math.ceil(M2_MACRON_STATUE_EXCLUSION_CENTER.row - M2_MACRON_STATUE_EXCLUSION_RADIUS)
  const maxRow = Math.floor(M2_MACRON_STATUE_EXCLUSION_CENTER.row + M2_MACRON_STATUE_EXCLUSION_RADIUS)
  const minCol = Math.ceil(M2_MACRON_STATUE_EXCLUSION_CENTER.col - M2_MACRON_STATUE_EXCLUSION_RADIUS)
  const maxCol = Math.floor(M2_MACRON_STATUE_EXCLUSION_CENTER.col + M2_MACRON_STATUE_EXCLUSION_RADIUS)
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!isInM2MacronStatueExclusion('2', row, col)) continue
      occupiedSet.add(`${row},${col}`)
    }
  }
}

/** Textured Macron prop — Roman column base; home stays rooted, mining patrols. */
export function createM2MacronStatueVisual(THREE, lowDetail = false) {
  const { gx, gy } = M2_MACRON_STATUE_POSITION
  return createFixedTexturedStatueVisual(THREE, {
    name: 'm2MacronStatue',
    bodyName: 'm2MacronStatueBody',
    flagKey: 'm2MacronStatue',
    bossStatueId: M2_MACRON_STATUE_ID,
    modelUrl: M2_MACRON_STATUE_MODEL_URL,
    scale: M2_MACRON_STATUE_SCALE,
    gx,
    gy,
    yaw: 0,
    placeholderColor: '#1b2440',
    lowDetail,
    withPlinth: true,
    withCapsuleDriver: true,
    capsuleSkinSeed: 'macron',
  })
}

/** @deprecated Red eye flash retired. */
export function flashM2MacronStatue() {}
