import { MINING_CHAIN_NODE_POSITION } from './mining-world-layout'
import { attachTexturedStatueGlb, setQuadrupedFlash } from './quadruped-glb'

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

/**
 * Fixed Zelensky statue — textured GLB on the MM3 token plinth. No salute,
 * patrol, or head track; the download already carries the standing pose.
 */
export function createM1ZelenskyStatueVisual(THREE, lowDetail = false) {
  const group = new THREE.Group()
  group.name = 'm1ZelenskyStatue'
  group.userData.m1ZelenskyStatue = true
  group.userData.bossStatueId = M1_ZELENSKY_STATUE_ID
  group.userData.skipOcclusion = true
  group.userData.statueFixed = true

  const bodyPivot = new THREE.Group()
  bodyPivot.name = 'm1ZelenskyStatueBody'
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
      ? new THREE.MeshLambertMaterial({ color: '#4b5a3a' })
      : new THREE.MeshStandardMaterial({ color: '#4b5a3a', roughness: 0.8, metalness: 0.06 }),
  )
  placeholder.position.y = 0.7
  bodyPivot.add(placeholder)

  attachTexturedStatueGlb(THREE, bodyPivot, {
    url: M1_ZELENSKY_STATUE_MODEL_URL,
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

/** Hit flash on the textured body (no photo-mask eyes). */
export function flashM1ZelenskyStatue(group, ms = 1500) {
  const pivot = group?.userData?.bodyPivot || group
  if (!pivot) return
  if (group.userData.eyeRedTimer) clearTimeout(group.userData.eyeRedTimer)
  setQuadrupedFlash(pivot, '#ff2020', 0.9)
  group.userData.eyeRedTimer = setTimeout(() => {
    setQuadrupedFlash(pivot, '#000000', 0)
    group.userData.eyeRedTimer = null
  }, ms)
}
