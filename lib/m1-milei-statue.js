import { MINING_CHAIN_NODE_POSITION } from './mining-world-layout'
import { attachQuadrupedGlb } from './quadruped-glb'
import { attachBotEyeGlows, setBossMaskEyesRed } from './boss-head-photo'
import { placeEyeGlowsFromFit } from './prop-eye-glows'
import { attachStatuePlinth, statuePlinthTopY } from './statue-plinth'
import { attachCapsuleAnimDriver } from './capsule-anim-driver'

export const M1_MILEI_STATUE_ID = 'm1_milei_statue'
/**
 * Figure-only sculpt (plinth stripped) + shared statue-plinth. Scale matches
 * plaza size next to Zelensky.
 */
export const M1_MILEI_STATUE_SCALE = 1.55
/** Full sculpt (legacy / audio credit). */
export const M1_MILEI_STATUE_MODEL_URL = '/models/milei.glb'
/** Figure without baked plinth — walks off the shared pedestal. */
export const M1_MILEI_FIGURE_URL = '/models/milei-figure.glb'
export const M1_MILEI_CHAINSAW_AUDIO_URL = '/ambient/milei-chainsaw.mp3'

/** Open NE plaza on M1 — clear of Cipher House, Colosseum, and chain node. */
export const M1_MILEI_STATUE_POSITION = Object.freeze({
  row: 10,
  col: 44,
  gx: 44.5,
  gy: 10.5,
})

export const M1_MILEI_STATUE_EXCLUSION_CENTER = Object.freeze({
  row: M1_MILEI_STATUE_POSITION.row + 0.5,
  col: M1_MILEI_STATUE_POSITION.col + 0.5,
})
export const M1_MILEI_STATUE_EXCLUSION_RADIUS = 5
export const M1_MILEI_STATUE_EXCLUSION_RADIUS_SQ = M1_MILEI_STATUE_EXCLUSION_RADIUS * M1_MILEI_STATUE_EXCLUSION_RADIUS

export function isInM1MileiStatueExclusion(mapId, row, col) {
  if (String(mapId) !== '1') return false
  const dr = row - M1_MILEI_STATUE_EXCLUSION_CENTER.row
  const dc = col - M1_MILEI_STATUE_EXCLUSION_CENTER.col
  return dr * dr + dc * dc <= M1_MILEI_STATUE_EXCLUSION_RADIUS_SQ
}

export function addM1MileiStatueReservedCells(reservedSet) {
  if (!reservedSet) return
  const minRow = Math.ceil(M1_MILEI_STATUE_EXCLUSION_CENTER.row - M1_MILEI_STATUE_EXCLUSION_RADIUS)
  const maxRow = Math.floor(M1_MILEI_STATUE_EXCLUSION_CENTER.row + M1_MILEI_STATUE_EXCLUSION_RADIUS)
  const minCol = Math.ceil(M1_MILEI_STATUE_EXCLUSION_CENTER.col - M1_MILEI_STATUE_EXCLUSION_RADIUS)
  const maxCol = Math.floor(M1_MILEI_STATUE_EXCLUSION_CENTER.col + M1_MILEI_STATUE_EXCLUSION_RADIUS)
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!isInM1MileiStatueExclusion('1', row, col)) continue
      reservedSet.add(`${row},${col}`)
    }
  }
}

export function addM1MileiStatueExclusions(occupiedSet) {
  if (!occupiedSet) return
  const minRow = Math.ceil(M1_MILEI_STATUE_EXCLUSION_CENTER.row - M1_MILEI_STATUE_EXCLUSION_RADIUS)
  const maxRow = Math.floor(M1_MILEI_STATUE_EXCLUSION_CENTER.row + M1_MILEI_STATUE_EXCLUSION_RADIUS)
  const minCol = Math.ceil(M1_MILEI_STATUE_EXCLUSION_CENTER.col - M1_MILEI_STATUE_EXCLUSION_RADIUS)
  const maxCol = Math.floor(M1_MILEI_STATUE_EXCLUSION_CENTER.col + M1_MILEI_STATUE_EXCLUSION_RADIUS)
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!isInM1MileiStatueExclusion('1', row, col)) continue
      occupiedSet.add(`${row},${col}`)
    }
  }
}

/**
 * Milei figure on the shared Milei plinth + invisible capsule limbs for patrol.
 * Motosierra buzz while idle on the pedestal; human walk when leaving for the nuke.
 */
export function createM1MileiStatueVisual(THREE, lowDetail = false) {
  const group = new THREE.Group()
  group.name = 'm1MileiStatue'
  group.userData.m1MileiStatue = true
  group.userData.bossStatueId = M1_MILEI_STATUE_ID
  group.userData.skipOcclusion = true
  // Can leave the plinth in mining; home carousel keeps him rooted via isStatue.
  group.userData.statueFixed = false
  group.userData.statueWalks = true

  const bodyPivot = new THREE.Group()
  bodyPivot.name = 'm1MileiStatueBody'
  group.add(bodyPivot)
  group.userData.bodyPivot = bodyPivot

  const deckY = statuePlinthTopY()
  bodyPivot.position.y = deckY
  bodyPivot.userData.baseY = deckY
  attachStatuePlinth(THREE, group)

  const parts = attachCapsuleAnimDriver(THREE, bodyPivot, {
    bulk: 1.05,
    sleeve: 'long',
    skinSeed: 'milei',
    lowDetail,
  })
  group.userData.homeLeftArm = parts.leftArm
  group.userData.homeRightArm = parts.rightArm

  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.4, 0.55),
    lowDetail
      ? new THREE.MeshLambertMaterial({ color: '#1a1f2b' })
      : new THREE.MeshStandardMaterial({ color: '#1a1f2b', roughness: 0.82, metalness: 0.08 }),
  )
  placeholder.position.y = 0.72
  placeholder.visible = false
  bodyPivot.add(placeholder)
  group.userData.modelReady = false

  const finishModel = (ok) => {
    if (ok && placeholder.parent) {
      placeholder.removeFromParent()
      placeholder.geometry.dispose()
      placeholder.material.dispose()
    }
    if (ok) placeEyeGlowsFromFit(THREE, bodyPivot, { eyeLine: 0.78, size: 0.06 })
    group.userData.modelReady = true
    group.userData.onModelReady?.(group)
  }

  attachQuadrupedGlb(THREE, bodyPivot, {
    url: M1_MILEI_FIGURE_URL,
    onReady: (clone) => finishModel(Boolean(clone)),
  })

  attachBotEyeGlows(THREE, bodyPivot, {
    color: '#67e8f9',
    size: 0.06,
    idleOpacity: 0,
    points: [
      { x: -0.04, y: 0.95, z: 0.18 },
      { x: 0.04, y: 0.95, z: 0.18 },
    ],
  })

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.32, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  group.add(shadow)

  bodyPivot.rotation.y = Math.PI
  group.scale.setScalar(M1_MILEI_STATUE_SCALE)

  const { gx, gy } = M1_MILEI_STATUE_POSITION
  const centerGx = MINING_CHAIN_NODE_POSITION.col + 0.5
  const centerGy = MINING_CHAIN_NODE_POSITION.row + 0.5
  group.position.set(gx, 0, gy)
  group.rotation.y = Math.atan2(centerGx - gx, centerGy - gy)
  group.frustumCulled = false
  bodyPivot.traverse((obj) => {
    if (!obj.isMesh) return
    obj.frustumCulled = false
    obj.renderOrder = 5
  })

  return { group, bodyPivot }
}

/** Hit / hover: red on eye sprites only. */
export function flashM1MileiStatue(group, ms = 1500) {
  if (!group) return
  if (group.userData.eyeRedTimer) clearTimeout(group.userData.eyeRedTimer)
  setBossMaskEyesRed(group, true)
  group.userData.eyeRedTimer = setTimeout(() => {
    setBossMaskEyesRed(group, false)
    group.userData.eyeRedTimer = null
  }, ms)
}

/**
 * Tiny motosierra buzz — idle on the pedestal; limbs stay mostly still.
 */
export function buzzM1MileiStatue(bodyPivot, time) {
  if (!bodyPivot) return
  bodyPivot.rotation.z = Math.sin(time * 42) * 0.006
  bodyPivot.rotation.x = Math.sin(time * 37 + 1.2) * 0.003
}
