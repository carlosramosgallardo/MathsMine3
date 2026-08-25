/**
 * Textured rocket-league battle car from public/models/rl-car.glb, shared by
 * the M2 pitch bot cars, the player's RL mount and the home showcase cars.
 *
 * The GLB is the Sketchfab "Fennec" download baked by scripts/bake-prop-glb.mjs
 * (credits in README): a proper node hierarchy — chassis, painted body, glass,
 * lights and four wheel instances — so it loads through GLTFLoader. Instances
 * are converted to the game's convention (Y-up, nose toward -z, ground at y=0)
 * and scaled to the old voxel car footprint so mounts/boosts keep their anchors.
 */
export const RL_CAR_MODEL_URL = '/models/rl-car.glb'

// Old voxel car was ~1.3 long (z) — the GLB body is 140 units long.
const RL_CAR_TARGET_LENGTH = 1.34

/** Material that takes the team tint, best match first: painted shell, then trim. */
const RL_CAR_BODY_MATERIALS = [/body/i, /paint/i]

let protoPromise = null

async function loadRlCarGlb(THREE) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
  const gltf = await new GLTFLoader().loadAsync(RL_CAR_MODEL_URL)
  const root = gltf.scene

  // Index materials as they appear and track surface area per material, so the
  // painted shell (largest tintable area) can be recoloured per team.
  const materials = []
  const areaByMaterial = new Map()
  const vA = new THREE.Vector3(); const vB = new THREE.Vector3(); const vC = new THREE.Vector3()
  root.traverse((obj) => {
    if (!obj.isMesh) return
    obj.frustumCulled = false
    let matIndex = materials.indexOf(obj.material)
    if (matIndex < 0) {
      matIndex = materials.length
      materials.push(obj.material)
    }
    obj.userData.rlCarMaterialIndex = matIndex
    const pos = obj.geometry.getAttribute('position')
    const idx = obj.geometry.getIndex()
    const triCount = (idx ? idx.count : pos.count) / 3
    let area = 0
    for (let t = 0; t < triCount; t += 1) {
      vA.fromBufferAttribute(pos, idx ? idx.getX(t * 3) : t * 3)
      vB.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 1) : t * 3 + 1)
      vC.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 2) : t * 3 + 2)
      area += vB.sub(vA).cross(vC.sub(vA)).length() / 2
    }
    areaByMaterial.set(matIndex, (areaByMaterial.get(matIndex) || 0) + area)
  })

  const widestMatch = (test) => {
    let pick = -1
    let bestArea = -1
    materials.forEach((material, index) => {
      if (test && !test.test(material.name || '')) return
      const area = areaByMaterial.get(index) || 0
      if (area > bestArea) { bestArea = area; pick = index }
    })
    return pick
  }
  let bodyMaterialIndex = 0
  for (const test of [...RL_CAR_BODY_MATERIALS, null]) {
    const pick = widestMatch(test)
    if (pick >= 0) { bodyMaterialIndex = pick; break }
  }
  // Team tints replace the stock paint, so the untinted car reads neutral.
  materials[bodyMaterialIndex]?.color?.setHex(0xffffff)

  // Normalize to game space: Y-up, nose toward -z, ground on y=0, centred on
  // x/z. Measure the rotated (still unscaled) bounds, then translate the root
  // inside the scaled wrapper — root.position applies after its own rotation,
  // and norm's scale multiplies it, so pre-scale units are consistent.
  const norm = new THREE.Group()
  // The headlights sit on +x, so a quarter turn puts the nose on the game's
  // forward (-z) and the boost thrusters on the +z tail as expected.
  root.rotation.set(0, Math.PI / 2, 0)
  norm.add(root)
  norm.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(norm)
  const length = Math.max(0.001, box.max.z - box.min.z)
  norm.scale.setScalar(RL_CAR_TARGET_LENGTH / length)
  root.position.set(
    -(box.min.x + box.max.x) / 2,
    -box.min.y,
    -(box.min.z + box.max.z) / 2,
  )

  const proto = new THREE.Group()
  proto.add(norm)
  return { proto, materials, bodyMaterialIndex }
}

export function loadRlCarPrototype(THREE) {
  if (!protoPromise) {
    protoPromise = loadRlCarGlb(THREE).catch((err) => {
      protoPromise = null
      throw err
    })
  }
  return protoPromise
}

/**
 * Async-attaches a textured car instance under `parent`. Geometry and textures
 * are shared with every other instance; only tinted materials are cloned.
 * `tint` (optional CSS color) recolors the car body; near-white tints are
 * skipped so the stock paint stays untouched.
 */
export function attachRlCarModel(THREE, parent, { tint = null, lowDetail = false, castShadow = false, onReady = null } = {}) {
  loadRlCarPrototype(THREE).then(({ proto, bodyMaterialIndex }) => {
    if (!parent || parent.userData.rlCarModelAttached) return
    parent.userData.rlCarModelAttached = true
    const instance = proto.clone(true)
    let tintColor = null
    if (tint) {
      const c = new THREE.Color(tint)
      // Skip near-white tints (Aserejee) — the stock paint already reads white.
      if (Math.min(c.r, c.g, c.b) < 0.85) tintColor = c
    }
    instance.traverse((obj) => {
      if (!obj.isMesh) return
      obj.frustumCulled = false
      obj.castShadow = castShadow
      if (tintColor && obj.userData.rlCarMaterialIndex === bodyMaterialIndex) {
        const mat = obj.material.clone()
        mat.color.copy(tintColor)
        mat.emissive = tintColor.clone().multiplyScalar(0.12)
        mat.emissiveIntensity = 1
        obj.material = mat
      }
    })
    void lowDetail
    parent.add(instance)
    onReady?.(instance)
  }).catch(() => {})
}

/**
 * Cockpit tub — dark side coamings, seat back and rear deck around the
 * rl-car.glb cabin (car-local z +0.18) so a rider's torso reads seated IN
 * a closed cockpit instead of perched on the bodywork. Shared by the FPV
 * mount and the home showcase bot cars; car-local units, scales with the car.
 */
export function addRlCockpitTub(THREE, car, { lowDetail = false } = {}) {
  if (!car || car.userData.rlCockpitTub) return car?.userData.rlCockpitTub || null
  const tubMat = lowDetail
    ? new THREE.MeshLambertMaterial({ color: '#0e1622' })
    : new THREE.MeshStandardMaterial({ color: '#0e1622', roughness: 0.5, metalness: 0.3, flatShading: true })
  const tub = new THREE.Group()
  tub.name = 'rlCockpitTub'
  for (const side of [-1, 1]) {
    const coaming = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.20, 0.50), tubMat)
    coaming.position.set(side * 0.215, 0.34, 0.18)
    tub.add(coaming)
  }
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.375, 0.28, 0.06), tubMat)
  seatBack.position.set(0, 0.40, 0.40)
  tub.add(seatBack)
  const rearDeck = new THREE.Mesh(new THREE.BoxGeometry(0.375, 0.06, 0.16), tubMat)
  rearDeck.position.set(0, 0.29, 0.50)
  tub.add(rearDeck)
  car.add(tub)
  car.userData.rlCockpitTub = tub
  return tub
}
