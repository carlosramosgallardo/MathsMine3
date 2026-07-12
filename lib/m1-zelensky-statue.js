import { MINING_CHAIN_NODE_POSITION } from './mining-world-layout'
import { attachBossMaskHead, bossHeadFlushMountY } from './boss-head-photo'
import { buildHumanoidBody } from './humanoid-body'

export const M1_ZELENSKY_STATUE_ID = 'm1_zelensky_statue'
export const M1_ZELENSKY_STATUE_SCALE = 1.9
/** Alpha-cutout face (from zelensky-head.glb's embedded image) for the mask shell. */
export const M1_ZELENSKY_MASK_TEXTURE_URL = '/images/m1-zelensky-mask.webp'

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

function statueMaterial(THREE, color, lowDetail, roughness = 0.48, metalness = 0.2) {
  if (lowDetail) {
    return new THREE.MeshLambertMaterial({ color })
  }
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true })
}

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

/** Voxel Volodymyr Zelensky — olive military fatigues, EU armband, decor only. */
export function createM1ZelenskyStatueVisual(THREE, lowDetail = false) {
  const group = new THREE.Group()
  group.name = 'm1ZelenskyStatue'
  group.userData.m1ZelenskyStatue = true
  group.userData.bossStatueId = M1_ZELENSKY_STATUE_ID
  group.userData.skipOcclusion = true
  // Greeting style consumed by the statue animators (FPV + home showcase).
  group.userData.statueSalute = 'leftForward'

  const bodyPivot = new THREE.Group()
  bodyPivot.name = 'm1ZelenskyStatueBody'
  group.add(bodyPivot)

  const mat = (color, roughness = 0.48, metalness = 0.2) => statueMaterial(THREE, color, lowDetail, roughness, metalness)
  const oliveDark = mat('#3a4630', 0.62, 0.1)
  const addBox = (parent, w, h, d, material, x, y, z, rotZ = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    if (rotZ) mesh.rotation.z = rotZ
    parent.add(mesh)
    return mesh
  }

  // Solid plinth — same standard as the Milei statue.
  const pedestalHeight = 0.09
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.38, pedestalHeight, lowDetail ? 10 : 16),
    mat('#cfc8b8', 0.72, 0.08),
  )
  pedestal.position.y = pedestalHeight / 2
  pedestal.receiveShadow = true
  group.add(pedestal)
  bodyPivot.position.y = pedestalHeight
  bodyPivot.userData.baseY = pedestalHeight

  // Low-poly humanoid in olive military fatigues — the signature field outfit.
  const body = buildHumanoidBody(THREE, bodyPivot, {
    mat,
    lowDetail,
    bulk: 1.04,
    handStyle: 'rj45',
    colors: {
      skin: '#e0bd9e',
      torso: '#4b5a3a',
      arms: '#4b5a3a',
      legs: '#3e4a33',
      shoes: '#2b2f26',
    },
  })

  // Chest details: round tee collar and two utility pockets.
  addBox(bodyPivot, 0.12, 0.03, 0.014, oliveDark, 0, 0.685, -0.132)
  addBox(bodyPivot, 0.07, 0.06, 0.012, oliveDark, -0.062, 0.56, -0.134)
  addBox(bodyPivot, 0.07, 0.06, 0.012, oliveDark, 0.062, 0.56, -0.134)

  // EU armband on the RIGHT upper arm (the left one salutes): blue field with
  // a ring of gold stars — moves with the arm group.
  const euBlue = mat('#003399', 0.5, 0.1)
  const euGold = mat('#ffcc00', 0.4, 0.2)
  addBox(body.rightArm, 0.045, 0.105, 0.02, euBlue, 0, -0.11, -0.055)
  for (const [sy, sz] of [[-0.075, -0.062], [-0.11, -0.066], [-0.145, -0.062]]) {
    addBox(body.rightArm, 0.012, 0.012, 0.01, euGold, -0.008, sy, sz)
    addBox(body.rightArm, 0.012, 0.012, 0.01, euGold, 0.008, sy, sz)
  }

  const headHeight = 0.64
  // Mask head: alpha-cutout portrait on the curved shell, fatigues-coloured
  // skull mold. Mount origin is the skull centre so animating it turns the
  // head in place (see attachBossMaskHead).
  const headMount = attachBossMaskHead(THREE, bodyPivot, M1_ZELENSKY_MASK_TEXTURE_URL, lowDetail, {
    name: 'm1ZelenskyHeadPhoto',
    planeWidth: 0.47,
    planeHeight: headHeight,
    y: bossHeadFlushMountY(headHeight),
    z: 0.02,
    renderOrder: 12,
    moldColor: '#4b5a3a',
    cutout: true,
    uvLayout: { frontU0: 0, frontU: 1, frontV0: 0, frontV: 1 },
    // Measured portrait pupil centres, image fractions.
    eyes: { points: [{ u: 0.347, v: 0.478 }, { u: 0.700, v: 0.476 }] },
  })
  group.userData.homeHead = headMount
  group.userData.homeLeftArm = body.leftArm
  group.userData.homeRightArm = body.rightArm

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.58, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.32, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  group.add(shadow)

  bodyPivot.rotation.y = Math.PI
  group.scale.setScalar(M1_ZELENSKY_STATUE_SCALE)

  const { gx, gy } = M1_ZELENSKY_STATUE_POSITION
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
