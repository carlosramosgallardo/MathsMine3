import { MINING_CHAIN_NODE_POSITION } from './mining-world-layout'
import { attachQuadrupedGlb } from './quadruped-glb'
import { humanoidGlbFit, HUMANOID_GLB_YAW } from './humanoid-glb'
import { attachStatuePlinth, statuePlinthTopY, STATUE_PLAZA_GROUP_SCALE } from './statue-plinth'
import { attachCapsuleAnimDriver } from './capsule-anim-driver'
import { applyRigidBipedGait } from './rigid-biped-limbs'
import { trailerModelUrl } from './trailer-model-url'

export { M1_MILEI_CHAINSAW_AUDIO_URL } from './milei-chainsaw-audio'

export const M1_MILEI_STATUE_ID = 'm1_milei_statue'
/**
 * Figure-only sculpt (original pedestal stripped) on the shared Roman column
 * base. Scale matches plaza size next to Zelensky.
 */
export const M1_MILEI_STATUE_SCALE = STATUE_PLAZA_GROUP_SCALE
/** Full sculpt (legacy / audio credit). */
export const M1_MILEI_STATUE_MODEL_URL = '/models/milei.glb'
/** Figure without baked plinth — walks off the shared pedestal. */
export const M1_MILEI_FIGURE_URL = '/models/milei-figure.glb'

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
 * Milei figure on the shared Roman column base + invisible capsule limbs for patrol.
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
    group.userData.modelReady = true
    group.userData.onModelReady?.(group)
  }

  attachQuadrupedGlb(THREE, bodyPivot, {
    url: trailerModelUrl(M1_MILEI_FIGURE_URL),
    // bodyPivot already sits on the plinth deck — skip humanoidGlbFit offsetY or
    // the figure floats one pedestal height above the shared base (double plinth).
    fitFn: () => ({ scale: humanoidGlbFit().scale, offsetY: 0 }),
    // milei-figure.glb's source sculpt is baked facing the opposite way from
    // the other plaza figures — the shared HUMANOID_GLB_YAW correction
    // (used by Zelensky/Macron via attachTexturedStatueGlb, and which shows
    // their face correctly with this exact same approach-vector pattern)
    // leaves Milei facing away. Add the extra half-turn so he faces the
    // same way relative to his approach vector as they do.
    yaw: HUMANOID_GLB_YAW + Math.PI,
    // mountRigidBipedLimbs used to restructure the mesh here to feed the
    // per-frame walkM1MileiStatue leg-swing, which fought walkHumanoidStride
    // (the shared animation Zelensky/Macron already use cleanly) for control
    // of the same bodyPivot every frame — that fight was the deformation/
    // sinking. Now that the animation call is gone (MiningChain3DFPV.jsx),
    // the mesh restructuring has no consumer either — drop it so Milei's
    // model mounts exactly like Zelensky/Macron's, rigid and undisturbed.
    onReady: (clone) => finishModel(Boolean(clone)),
  })

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.32, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  // Shared Milei plinth is the ground contact — skip the dark disc over the deck.

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

/** @deprecated Red eye flash retired. */
export function flashM1MileiStatue() {}

/**
 * Tiny motosierra buzz — idle on the pedestal; limbs stay mostly still.
 */
export function buzzM1MileiStatue(bodyPivot, time) {
  if (!bodyPivot) return
  bodyPivot.rotation.z = Math.sin(time * 42) * 0.006
  bodyPivot.rotation.x = Math.sin(time * 37 + 1.2) * 0.003
}

/** Walks the rigid figure while keeping the saw attached to its arm shell. */
export function walkM1MileiStatue(bodyPivot, phase, amount) {
  return applyRigidBipedGait(bodyPivot, phase, amount, { armScale: 0.52 })
}
