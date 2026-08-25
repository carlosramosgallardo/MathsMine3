import { attachBossMaskHead } from './boss-head-photo'
import { buildHumanoidBody } from './humanoid-body'

export const M2_MACRON_STATUE_ID = 'm2_macron_statue'
// 173 cm from the ground including the ~10 cm plinth (local: 0.09 base + 1.36 figure),
// on the Trump anchor (scale 2 ≡ 190 cm ≡ 2.72 world units).
export const M2_MACRON_STATUE_SCALE = 1.71
/** Alpha-cutout face (from macron_head.glb's embedded image) for the mask shell. */
export const M2_MACRON_MASK_TEXTURE_URL = '/images/m2-macron-mask.webp'

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

function statueMaterial(THREE, color, lowDetail, roughness = 0.48, metalness = 0.2) {
  if (lowDetail) {
    return new THREE.MeshLambertMaterial({ color })
  }
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true })
}

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

/** Voxel Emmanuel Macron — navy suit, tricolore armband, decor only. */
export function createM2MacronStatueVisual(THREE, lowDetail = false) {
  const group = new THREE.Group()
  group.name = 'm2MacronStatue'
  group.userData.m2MacronStatue = true
  group.userData.bossStatueId = M2_MACRON_STATUE_ID
  group.userData.skipOcclusion = true
  // Greeting style consumed by the statue animators (FPV + home showcase):
  // both arms raised in a V — distinct from Milei's right wave and
  // Zelensky's left-forward salute.
  group.userData.statueSalute = 'bothUp'

  const bodyPivot = new THREE.Group()
  bodyPivot.name = 'm2MacronStatueBody'
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

  const bulk = 1
  const body = buildHumanoidBody(THREE, bodyPivot, {
    mat,
    lowDetail,
    bulk,
    handStyle: 'rj45',
    photoHead: true,
    colors: {
      skin: '#e8c4a8',
      torso: '#1b2440',
      legs: '#141c30',
      shoes: '#8a93a6',
    },
  })
  body.leftShoe.scale.set(1.25, 1.3, 1.2)
  body.rightShoe.scale.set(1.25, 1.3, 1.2)
  group.userData.homeLeftArm = body.leftArm
  group.userData.homeRightArm = body.rightArm

  const headMount = attachBossMaskHead(THREE, bodyPivot, M2_MACRON_MASK_TEXTURE_URL, lowDetail, {
    name: 'm2MacronHeadPhoto',
    hairColor: '#3d2918',
    eyes: { points: [{ u: 0.385, v: 0.505 }, { u: 0.700, v: 0.500 }] },
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
  group.scale.setScalar(M2_MACRON_STATUE_SCALE)

  const { gx, gy } = M2_MACRON_STATUE_POSITION
  group.position.set(gx, 0, gy)
  // Face due south — the gateway strip where players arrive from M1.
  group.rotation.y = 0
  group.frustumCulled = false
  bodyPivot.traverse((obj) => {
    if (!obj.isMesh) return
    obj.frustumCulled = false
    obj.renderOrder = 5
  })

  return { group, bodyPivot }
}
