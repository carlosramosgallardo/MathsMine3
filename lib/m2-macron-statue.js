import { attachTexturedStatueGlb, setQuadrupedFlash } from './quadruped-glb'

export const M2_MACRON_STATUE_ID = 'm2_macron_statue'
/** Textured avatar on the MM3 plinth — close to Zelensky’s plaza scale. */
export const M2_MACRON_STATUE_SCALE = 1.55
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

/**
 * Fixed Macron statue — textured GLB on the MM3 token plinth. No salute,
 * patrol, or head track; the download already carries the standing pose.
 */
export function createM2MacronStatueVisual(THREE, lowDetail = false) {
  const group = new THREE.Group()
  group.name = 'm2MacronStatue'
  group.userData.m2MacronStatue = true
  group.userData.bossStatueId = M2_MACRON_STATUE_ID
  group.userData.skipOcclusion = true
  group.userData.statueFixed = true

  const bodyPivot = new THREE.Group()
  bodyPivot.name = 'm2MacronStatueBody'
  group.add(bodyPivot)
  group.userData.bodyPivot = bodyPivot

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

  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 1.35, 0.4),
    lowDetail
      ? new THREE.MeshLambertMaterial({ color: '#1b2440' })
      : new THREE.MeshStandardMaterial({ color: '#1b2440', roughness: 0.8, metalness: 0.06 }),
  )
  placeholder.position.y = 0.7
  bodyPivot.add(placeholder)

  attachTexturedStatueGlb(THREE, bodyPivot, {
    url: M2_MACRON_STATUE_MODEL_URL,
    onReady: () => {
      placeholder.removeFromParent()
      placeholder.geometry.dispose()
      placeholder.material.dispose()
    },
  })

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

/** Hit flash on the textured body (no photo-mask eyes). */
export function flashM2MacronStatue(group, ms = 1500) {
  const pivot = group?.userData?.bodyPivot || group
  if (!pivot) return
  if (group.userData.eyeRedTimer) clearTimeout(group.userData.eyeRedTimer)
  setQuadrupedFlash(pivot, '#ff2020', 0.9)
  group.userData.eyeRedTimer = setTimeout(() => {
    setQuadrupedFlash(pivot, '#000000', 0)
    group.userData.eyeRedTimer = null
  }, ms)
}
