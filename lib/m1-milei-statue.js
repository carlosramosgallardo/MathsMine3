import { MINING_CHAIN_NODE_POSITION } from './mining-world-layout'

export const M1_MILEI_STATUE_ID = 'm1_milei_statue'
export const M1_MILEI_STATUE_SCALE = 1.9

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
  group.userData.skipOcclusion = true

  const bodyPivot = new THREE.Group()
  bodyPivot.name = 'm1MileiStatueBody'
  group.add(bodyPivot)

  const mat = (color, roughness = 0.48, metalness = 0.2) => statueMaterial(THREE, color, lowDetail, roughness, metalness)
  const basic = (color) => new THREE.MeshBasicMaterial({ color })

  const suit = mat('#1a1f2b', 0.42, 0.34)
  const suitDark = mat('#0f141d', 0.5, 0.28)
  const shirt = mat('#b8d4f0', 0.72, 0.04)
  const tie = mat('#111827', 0.55, 0.12)
  const skin = mat('#e8c4a8', 0.58, 0.06)
  const skinLight = mat('#f5dcc8', 0.52, 0.04)
  const skinShadow = mat('#c99a7e', 0.55, 0.05)
  const hair = mat('#4a3520', 0.62, 0.08)
  const hairDark = mat('#2a1a0c', 0.68, 0.06)
  const hairGrey = mat('#8b9aab', 0.58, 0.1)
  const hairWild = mat('#5c4228', 0.6, 0.08)
  const shoe = mat('#111827', 0.62, 0.18)
  const sashBlue = basic('#74acdf')
  const sashWhite = basic('#f8fafc')
  const sun = basic('#fbbf24')
  const eye = basic('#6b8cae')
  const eyeWhite = basic('#f8fafc')
  const teeth = basic('#f8fafc')
  const brow = mat('#3d2914', 0.65, 0.06)

  const addBox = (parent, w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }

  // Pedestal
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.82, 0.14, lowDetail ? 12 : 20),
    mat('#d8ccb8', 0.62, 0.14),
  )
  pedestal.position.y = 0.07
  group.add(pedestal)

  // Legs & shoes
  addBox(bodyPivot, 0.18, 0.44, 0.16, suitDark, -0.11, 0.22, 0.01)
  addBox(bodyPivot, 0.18, 0.44, 0.16, suitDark, 0.11, 0.22, 0.01)
  addBox(bodyPivot, 0.19, 0.07, 0.24, shoe, -0.11, 0.03, -0.01)
  addBox(bodyPivot, 0.19, 0.07, 0.24, shoe, 0.11, 0.03, -0.01)

  // Jacket & shirt
  addBox(bodyPivot, 0.54, 0.50, 0.30, suit, 0, 0.58, 0)
  addBox(bodyPivot, 0.22, 0.18, 0.08, shirt, 0, 0.72, -0.12)
  addBox(bodyPivot, 0.08, 0.24, 0.04, tie, 0, 0.64, -0.145)

  // Presidential sash — light blue / white / light blue + sun
  addBox(bodyPivot, 0.10, 0.42, 0.03, sashBlue, 0.18, 0.58, 0.10)
  addBox(bodyPivot, 0.08, 0.38, 0.03, sashWhite, 0.08, 0.54, 0.11)
  addBox(bodyPivot, 0.10, 0.34, 0.03, sashBlue, -0.02, 0.50, 0.12)
  addBox(bodyPivot, 0.12, 0.12, 0.04, sun, 0.04, 0.56, 0.13)
  addBox(bodyPivot, 0.04, 0.04, 0.01, basic('#f59e0b'), 0.04, 0.56, 0.155)

  // Arms
  addBox(bodyPivot, 0.14, 0.38, 0.14, suit, -0.36, 0.52, 0.01)
  addBox(bodyPivot, 0.14, 0.38, 0.14, suit, 0.36, 0.52, 0.01)
  addBox(bodyPivot, 0.12, 0.12, 0.12, skinLight, -0.36, 0.30, -0.01)
  addBox(bodyPivot, 0.12, 0.12, 0.12, skinLight, 0.36, 0.30, -0.01)

  // Head — elongated face, wide grin, staring eyes, wild hair & mutton chops
  addBox(bodyPivot, 0.32, 0.32, 0.26, skin, 0, 1.02, 0)
  addBox(bodyPivot, 0.24, 0.10, 0.22, skin, 0, 0.90, -0.02)
  addBox(bodyPivot, 0.06, 0.04, 0.01, skinShadow, -0.14, 0.96, -0.132)
  addBox(bodyPivot, 0.06, 0.04, 0.01, skinShadow, 0.14, 0.96, -0.132)

  // Furrowed brows
  addBox(bodyPivot, 0.10, 0.03, 0.02, brow, -0.09, 1.12, -0.128)
  addBox(bodyPivot, 0.10, 0.03, 0.02, brow, 0.09, 1.12, -0.128)
  addBox(bodyPivot, 0.04, 0.02, 0.02, brow, -0.04, 1.11, -0.126)
  addBox(bodyPivot, 0.04, 0.02, 0.02, brow, 0.04, 1.11, -0.126)

  // Wide staring eyes — sclera + iris
  addBox(bodyPivot, 0.10, 0.05, 0.01, eyeWhite, -0.09, 1.04, -0.138)
  addBox(bodyPivot, 0.10, 0.05, 0.01, eyeWhite, 0.09, 1.04, -0.138)
  addBox(bodyPivot, 0.05, 0.04, 0.012, eye, -0.09, 1.04, -0.145)
  addBox(bodyPivot, 0.05, 0.04, 0.012, eye, 0.09, 1.04, -0.145)
  addBox(bodyPivot, 0.02, 0.02, 0.01, basic('#1e293b'), -0.09, 1.04, -0.152)
  addBox(bodyPivot, 0.02, 0.02, 0.01, basic('#1e293b'), 0.09, 1.04, -0.152)

  // Wide toothy grin
  addBox(bodyPivot, 0.20, 0.06, 0.02, skinShadow, 0, 0.90, -0.136)
  addBox(bodyPivot, 0.18, 0.03, 0.01, teeth, 0, 0.92, -0.144)
  addBox(bodyPivot, 0.04, 0.025, 0.01, teeth, -0.07, 0.92, -0.145)
  addBox(bodyPivot, 0.04, 0.025, 0.01, teeth, -0.02, 0.92, -0.145)
  addBox(bodyPivot, 0.04, 0.025, 0.01, teeth, 0.03, 0.92, -0.145)
  addBox(bodyPivot, 0.04, 0.025, 0.01, teeth, 0.08, 0.92, -0.145)
  addBox(bodyPivot, 0.04, 0.02, 0.01, mat('#c48878', 0.6, 0), 0, 0.87, -0.143)

  // Messy windswept hair — volume on top and sides
  addBox(bodyPivot, 0.38, 0.14, 0.32, hairWild, 0, 1.20, 0.04)
  addBox(bodyPivot, 0.30, 0.10, 0.28, hair, 0, 1.30, 0.06)
  addBox(bodyPivot, 0.14, 0.12, 0.22, hairWild, -0.16, 1.24, 0.08)
  addBox(bodyPivot, 0.14, 0.12, 0.22, hairWild, 0.16, 1.24, 0.08)
  addBox(bodyPivot, 0.10, 0.08, 0.18, hairDark, -0.10, 1.34, 0.02)
  addBox(bodyPivot, 0.10, 0.08, 0.18, hairDark, 0.10, 1.34, 0.02)
  addBox(bodyPivot, 0.08, 0.06, 0.16, hairGrey, -0.18, 1.14, 0.04)
  addBox(bodyPivot, 0.08, 0.06, 0.16, hairGrey, 0.18, 1.14, 0.04)

  // Long mutton-chop sideburns
  addBox(bodyPivot, 0.10, 0.28, 0.22, hairDark, -0.20, 1.00, 0.02)
  addBox(bodyPivot, 0.10, 0.28, 0.22, hairDark, 0.20, 1.00, 0.02)
  addBox(bodyPivot, 0.08, 0.14, 0.18, hair, -0.21, 0.88, 0.01)
  addBox(bodyPivot, 0.08, 0.14, 0.18, hair, 0.21, 0.88, 0.01)
  addBox(bodyPivot, 0.06, 0.10, 0.14, hairWild, -0.22, 0.78, -0.01)
  addBox(bodyPivot, 0.06, 0.10, 0.14, hairWild, 0.22, 0.78, -0.01)

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
