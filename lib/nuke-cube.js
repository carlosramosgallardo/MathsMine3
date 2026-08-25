/**
 * Decorative nuke chamber — Sketchfab "Nuclear Reactor Bomb Chamber" (CC BY)
 * baked to public/models/nuclear.glb, plus a local-only red button on top.
 * One per map (M1–M5) on guaranteed block-free spots, plus the home carousel
 * showcase. Pure client decor: the button toggle is LOCAL-ONLY — no Supabase,
 * no realtime, no collision beyond the reserved 3×3 keep-clear zone.
 */

export const NUKE_CUBE_MODEL_URL = '/models/nuclear.glb'
/** Same footprint as a minable block cube. */
export const NUKE_CUBE_SIZE = 0.985

/** One bomb per map, tucked in a free corner (clear of ambient obstacles and
    gateway corridor bands). The 3×3 zone around each is reserved from minable
    block placement — see addNukeCubeReservations / isInNukeCubeZone. */
export const NUKE_CUBE_POSITIONS = Object.freeze({
  '1': Object.freeze({ row: 2, col: 2 }),   // NW corner, by the M2 exit strip
  '2': Object.freeze({ row: 51, col: 3 }),  // SW corner, near the M1 entrance
  '3': Object.freeze({ row: 3, col: 51 }),  // NE corner, near the M1 entrance
  '4': Object.freeze({ row: 51, col: 3 }),  // SW corner, near the M1 entrance
  '5': Object.freeze({ row: 3, col: 51 }),  // NE corner, near the M1 entrance
})

export const NUKE_CUBE_INTERACT_RADIUS = 1.9

/** 3×3 keep-clear zone so no minable block lands on/next to the bomb. */
export function isInNukeCubeZone(mapId, row, col) {
  const pos = NUKE_CUBE_POSITIONS[String(mapId)]
  if (!pos) return false
  return Math.abs(row - pos.row) <= 1 && Math.abs(col - pos.col) <= 1
}

export function addNukeCubeReservations(mapId, reservedSet) {
  const pos = NUKE_CUBE_POSITIONS[String(mapId)]
  if (!pos || !reservedSet) return
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      reservedSet.add(`${pos.row + dr},${pos.col + dc}`)
    }
  }
}

const BUTTON_TRAVEL = 0.085
const PRESS_EASE_SPEED = 7

let protoPromise = null

async function loadNukePrototype(THREE) {
  if (typeof window === 'undefined') return null
  if (protoPromise) return protoPromise
  protoPromise = import('three/addons/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(NUKE_CUBE_MODEL_URL))
    .then((gltf) => {
      const root = gltf.scene
      root.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(root)
      const size = new THREE.Vector3()
      const center = new THREE.Vector3()
      box.getSize(size)
      box.getCenter(center)
      const span = Math.max(size.x, size.y, size.z) || 1
      const scale = NUKE_CUBE_SIZE / span
      const fit = new THREE.Group()
      fit.name = 'nukeChamberFit'
      // Centre XZ, plant on y=0, then fill the 0.985 cube.
      root.position.set(-center.x, -box.min.y, -center.z)
      fit.add(root)
      fit.scale.setScalar(scale)
      return fit
    })
    .catch((err) => {
      protoPromise = null
      console.warn('[nuke-cube]', err)
      return null
    })
  return protoPromise
}

function makeFallbackBody(THREE, lowDetail) {
  const mat = lowDetail
    ? new THREE.MeshLambertMaterial({ color: '#4a5232' })
    : new THREE.MeshStandardMaterial({ color: '#4a5232', roughness: 0.55, metalness: 0.25 })
  const cube = new THREE.Mesh(new THREE.BoxGeometry(NUKE_CUBE_SIZE, NUKE_CUBE_SIZE, NUKE_CUBE_SIZE), mat)
  cube.position.y = NUKE_CUBE_SIZE / 2
  cube.name = 'nukeFallbackBody'
  return cube
}

function makeRedButton(THREE, lowDetail) {
  const darkMat = lowDetail
    ? new THREE.MeshLambertMaterial({ color: '#1c1917' })
    : new THREE.MeshStandardMaterial({ color: '#1c1917', roughness: 0.5, metalness: 0.4 })
  const buttonMat = lowDetail
    ? new THREE.MeshLambertMaterial({ color: '#dc2626' })
    : new THREE.MeshStandardMaterial({
      color: '#dc2626',
      roughness: 0.35,
      metalness: 0.15,
      emissive: '#7f1d1d',
      emissiveIntensity: 0.55,
    })
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.21, 0.07, lowDetail ? 10 : 16),
    darkMat,
  )
  base.position.y = NUKE_CUBE_SIZE + 0.035
  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.13, 0.13, lowDetail ? 10 : 16),
    buttonMat,
  )
  button.position.y = NUKE_CUBE_SIZE + 0.07 + 0.055
  button.userData.baseY = button.position.y
  return { base, button }
}

/**
 * Build the nuke chamber visual. The textured GLB streams in async; a solid
 * olive cube holds the footprint until then. The red button stays procedural
 * so press animation keeps working the same in FPV and the home carousel.
 */
export function createNukeCubeVisual(THREE, lowDetail = false) {
  const group = new THREE.Group()
  group.name = 'nukeCube'
  group.userData.nukeCube = true
  group.userData.skipOcclusion = true

  const fallback = makeFallbackBody(THREE, lowDetail)
  group.add(fallback)

  const { base, button } = makeRedButton(THREE, lowDetail)
  group.add(base)
  group.add(button)

  loadNukePrototype(THREE).then((proto) => {
    if (!proto || !group.parent) return
    const clone = proto.clone(true)
    clone.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return
      obj.material = obj.material.clone()
      if (obj.material.map) {
        obj.material.map.colorSpace = THREE.SRGBColorSpace
        obj.material.map.anisotropy = 4
      }
      obj.frustumCulled = false
      obj.renderOrder = 4
    })
    fallback.removeFromParent()
    fallback.geometry.dispose()
    fallback.material.dispose()
    group.add(clone)
    group.userData.nukeGlbReady = true
  })

  group.userData.nukeButton = button
  group.userData.pressed = false
  group.userData.pressT = 0
  return { group, button }
}

/** Flips the button state; returns the new pressed state. Local-only. */
export function toggleNukeCube(group) {
  if (!group?.userData?.nukeButton) return false
  group.userData.pressed = !group.userData.pressed
  return group.userData.pressed
}

/** Per-frame: eases the red button toward its pressed/raised position. */
export function updateNukeCubeVisual(group, dt) {
  const button = group?.userData?.nukeButton
  if (!button) return
  const target = group.userData.pressed ? 1 : 0
  const t = group.userData.pressT ?? 0
  if (Math.abs(target - t) < 0.001) return
  const step = Math.min(Math.abs(target - t), Math.max(0, dt) * PRESS_EASE_SPEED)
  const next = t + Math.sign(target - t) * step
  group.userData.pressT = next
  button.position.y = (button.userData.baseY ?? 0) - next * BUTTON_TRAVEL
  button.scale.y = 1 - next * 0.3
  button.updateMatrix?.()
}
