import { MINING_CHAIN_NODE_POSITION } from './mining-world-layout'
import { attachBossMaskHead, bossHeadFlushMountY } from './boss-head-photo'
import { buildHumanoidBody } from './humanoid-body'

export const M1_MILEI_STATUE_ID = 'm1_milei_statue'
export const M1_MILEI_STATUE_SCALE = 1.9
export const M1_MILEI_HEAD_TEXTURE_URL = '/images/m1-milei-head.webp'
/** Alpha-cutout face (from milei-head.glb's embedded image) for the mask shell. */
export const M1_MILEI_MASK_TEXTURE_URL = '/images/m1-milei-mask.webp'

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

function statueMaterial(THREE, color, lowDetail, roughness = 0.48, metalness = 0.2) {
  if (lowDetail) {
    return new THREE.MeshLambertMaterial({ color })
  }
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true })
}

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

/** Voxel Javier Milei — suit, presidential sash, decor only. */
export function createM1MileiStatueVisual(THREE, lowDetail = false) {
  const group = new THREE.Group()
  group.name = 'm1MileiStatue'
  group.userData.m1MileiStatue = true
  group.userData.bossStatueId = M1_MILEI_STATUE_ID
  group.userData.skipOcclusion = true

  const bodyPivot = new THREE.Group()
  bodyPivot.name = 'm1MileiStatueBody'
  group.add(bodyPivot)

  const mat = (color, roughness = 0.48, metalness = 0.2) => statueMaterial(THREE, color, lowDetail, roughness, metalness)
  const shirt = mat('#f8fafc', 0.42, 0.08)
  const suitDark = mat('#0f141d', 0.5, 0.28)
  const tie = mat('#111827', 0.55, 0.12)
  const addBox = (parent, w, h, d, material, x, y, z, rotZ = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    if (rotZ) mesh.rotation.z = rotZ
    parent.add(mesh)
    return mesh
  }

  // Solid plinth: tall enough that Milei stands ON it with his shoes visible
  // above the rim (bodyPivot is lifted by the plinth height below).
  const pedestalHeight = 0.09
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.38, pedestalHeight, lowDetail ? 10 : 16),
    mat('#cfc8b8', 0.72, 0.08),
  )
  pedestal.position.y = pedestalHeight / 2
  pedestal.receiveShadow = true
  group.add(pedestal)
  bodyPivot.position.y = pedestalHeight

  // Low-poly humanoid in the dark suit — slim build; hands ride inside the
  // arm groups, so the arm-lift animation moves them for free.
  const body = buildHumanoidBody(THREE, bodyPivot, {
    mat,
    lowDetail,
    bulk: 1,
    handStyle: 'rj45',
    colors: {
      skin: '#e8c4a8',
      torso: '#1a1f2b',
      legs: '#0f141d',
      shoes: '#111827',
    },
  })

  // Suit decor on the chest front (-z): shirt V, lapels, dark tie.
  addBox(bodyPivot, 0.14, 0.13, 0.014, shirt, 0, 0.645, -0.134)
  addBox(bodyPivot, 0.065, 0.19, 0.012, suitDark, -0.07, 0.60, -0.138, 0.32)
  addBox(bodyPivot, 0.065, 0.19, 0.012, suitDark, 0.07, 0.60, -0.138, -0.32)
  addBox(bodyPivot, 0.07, 0.045, 0.02, tie, 0, 0.655, -0.142)
  addBox(bodyPivot, 0.055, 0.26, 0.016, tie, 0, 0.51, -0.142)

  // Argentina armband on the left upper arm — moves with the arm group.
  const flagCeleste = mat('#74acdf', 0.5, 0.1)
  const flagWhite = mat('#f8fafc', 0.5, 0.1)
  const flagSun = mat('#fcbf49', 0.4, 0.2)
  addBox(body.leftArm, 0.045, 0.035, 0.02, flagCeleste, 0, -0.075, -0.055)
  addBox(body.leftArm, 0.045, 0.035, 0.02, flagWhite, 0, -0.11, -0.055)
  addBox(body.leftArm, 0.045, 0.035, 0.02, flagCeleste, 0, -0.145, -0.055)
  addBox(body.leftArm, 0.018, 0.018, 0.012, flagSun, 0, -0.11, -0.062)
  group.userData.homeLeftArm = body.leftArm
  group.userData.homeRightArm = body.rightArm

  const headHeight = 0.66
  // Same mask design as the other bosses: alpha-cutout face on a curved shell,
  // suit-coloured skull mold, strap around the nape. The mount's origin is the
  // skull centre (see attachBossMaskHead), so animating it spins/nods the head
  // in place — no separate neck pivot needed. z centres the head on the torso.
  const headMount = attachBossMaskHead(THREE, bodyPivot, M1_MILEI_MASK_TEXTURE_URL, lowDetail, {
    name: 'm1MileiHeadPhoto',
    planeWidth: 0.54,
    planeHeight: headHeight,
    y: bossHeadFlushMountY(headHeight),
    z: 0.02,
    renderOrder: 12,
    moldColor: '#1a1f2b',
    cutout: true,
    uvLayout: { frontU0: 0, frontU: 1, frontV0: 0, frontV: 1 },
    // Measured portrait pupil centres (behind the glasses), image fractions.
    eyes: { points: [{ u: 0.400, v: 0.594 }, { u: 0.663, v: 0.586 }] },
  })
  group.userData.homeHead = headMount

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.58, 24),
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
