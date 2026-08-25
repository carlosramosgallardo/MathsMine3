import { MINING_CHAIN_NODE_POSITION } from './mining-world-layout'
import { attachBossMaskHead } from './boss-head-photo'
import { buildHumanoidBody } from './humanoid-body'

export const M1_ZELENSKY_STATUE_ID = 'm1_zelensky_statue'
// 168 cm from the ground including the ~10 cm plinth (local: 0.09 base + 1.36 figure),
// on the Trump anchor (scale 2 ≡ 190 cm ≡ 2.72 world units).
export const M1_ZELENSKY_STATUE_SCALE = 1.66
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

  // MM3 token coin — glowing gold with the portal logo on both faces.
  const pedestalHeight = 0.055
  const tokenTex = new THREE.TextureLoader().load('/mm3-token.png')
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, pedestalHeight, lowDetail ? 16 : 32),
    [
      new THREE.MeshStandardMaterial({ color: '#d4a820', roughness: 0.18, metalness: 0.92, emissive: '#7a5f00', emissiveIntensity: 0.22 }),
      new THREE.MeshStandardMaterial({ map: tokenTex, roughness: 0.14, metalness: 0.85, emissive: '#3d2e00', emissiveIntensity: 0.12 }),
      new THREE.MeshStandardMaterial({ map: tokenTex, roughness: 0.14, metalness: 0.85, emissive: '#3d2e00', emissiveIntensity: 0.12 }),
    ],
  )
  pedestal.position.y = pedestalHeight / 2
  pedestal.receiveShadow = true
  group.add(pedestal)
  bodyPivot.position.y = pedestalHeight
  bodyPivot.userData.baseY = pedestalHeight

  const bulk = 1.04
  const body = buildHumanoidBody(THREE, bodyPivot, {
    mat,
    lowDetail,
    bulk,
    handStyle: 'rj45',
    photoHead: true,
    colors: {
      skin: '#e0bd9e',
      torso: '#4b5a3a',
      arms: '#4b5a3a',
      legs: '#3e4a33',
      shoes: '#2b2f26',
    },
  })

  const headMount = attachBossMaskHead(THREE, bodyPivot, M1_ZELENSKY_MASK_TEXTURE_URL, lowDetail, {
    name: 'm1ZelenskyHeadPhoto',
    bulk,
    renderOrder: 12,
    hairColor: '#c4a070',
    cutout: true,
    uvLayout: { frontU0: 0, frontU: 1, frontV0: 0, frontV: 1 },
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
