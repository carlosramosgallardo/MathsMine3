/**
 * Textured rocket-league battle car from public/models/rl-car.glb, shared by
 * the M2 pitch bot cars, the player's RL mount and the home showcase cars.
 *
 * The GLB is trimesh-generated: a flat node list (no transforms), meshes with
 * POSITION + TEXCOORD_0 + indices, and PBR materials with embedded PNG
 * baseColor textures. It is parsed by hand — no GLTFLoader dependency.
 *
 * Source axes are Z-up with the car length along X; instances are converted
 * to the game's convention (Y-up, nose toward -z, ground at y=0) and scaled
 * to the old voxel car footprint so mounts/boosts keep their anchors.
 */
export const RL_CAR_MODEL_URL = '/models/rl-car.glb'

// Old voxel car was ~1.3 long (z) — the GLB body is 4.25 long.
const RL_CAR_TARGET_LENGTH = 1.34

let protoPromise = null

async function parseRlCarGlb(THREE) {
  const res = await fetch(RL_CAR_MODEL_URL)
  if (!res.ok) throw new Error(`rl-car glb ${res.status}`)
  const buf = await res.arrayBuffer()
  const dv = new DataView(buf)
  const jsonLen = dv.getUint32(12, true)
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)))
  const binStart = 20 + jsonLen + 8

  const readAccessor = (index) => {
    const acc = json.accessors[index]
    const view = json.bufferViews[acc.bufferView]
    const offset = binStart + (view.byteOffset || 0) + (acc.byteOffset || 0)
    const Ctor = acc.componentType === 5125 ? Uint32Array
      : acc.componentType === 5123 ? Uint16Array : Float32Array
    const comps = acc.type === 'VEC3' ? 3 : acc.type === 'VEC2' ? 2 : 1
    return new Ctor(buf, offset, acc.count * comps)
  }

  // Embedded PNG textures → ImageBitmap → THREE.Texture (flipY=false: glTF
  // UVs use a top-left origin).
  const textures = await Promise.all((json.images || []).map(async (img) => {
    const view = json.bufferViews[img.bufferView]
    const blob = new Blob(
      [new Uint8Array(buf, binStart + (view.byteOffset || 0), view.byteLength)],
      { type: img.mimeType || 'image/png' },
    )
    const bitmap = await createImageBitmap(blob)
    const tex = new THREE.Texture(bitmap)
    tex.flipY = false
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }))

  const materials = (json.materials || []).map((mat) => {
    const pbr = mat.pbrMetallicRoughness || {}
    const texIndex = pbr.baseColorTexture?.index
    return new THREE.MeshStandardMaterial({
      map: Number.isInteger(texIndex) ? textures[json.textures?.[texIndex]?.source ?? texIndex] : null,
      color: new THREE.Color(...(pbr.baseColorFactor || [1, 1, 1]).slice(0, 3)),
      roughness: pbr.roughnessFactor ?? 0.6,
      metalness: pbr.metallicFactor ?? 0.1,
    })
  })

  // Assemble in glTF space, tracking surface area per material so the car
  // "body" (largest painted area) can be tinted per team.
  const root = new THREE.Group()
  const areaByMaterial = new Map()
  const vA = new THREE.Vector3(); const vB = new THREE.Vector3(); const vC = new THREE.Vector3()
  for (const meshDef of json.meshes || []) {
    for (const prim of meshDef.primitives || []) {
      const geo = new THREE.BufferGeometry()
      const pos = readAccessor(prim.attributes.POSITION)
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      if (Number.isInteger(prim.attributes.TEXCOORD_0)) {
        geo.setAttribute('uv', new THREE.BufferAttribute(readAccessor(prim.attributes.TEXCOORD_0), 2))
      }
      let idx = null
      if (Number.isInteger(prim.indices)) {
        idx = readAccessor(prim.indices)
        geo.setIndex(new THREE.BufferAttribute(idx, 1))
      }
      geo.computeVertexNormals()
      const matIndex = prim.material ?? 0
      let area = 0
      const triCount = (idx ? idx.length : pos.length / 3) / 3
      for (let t = 0; t < triCount; t += 1) {
        const i0 = (idx ? idx[t * 3] : t * 3) * 3
        const i1 = (idx ? idx[t * 3 + 1] : t * 3 + 1) * 3
        const i2 = (idx ? idx[t * 3 + 2] : t * 3 + 2) * 3
        vA.set(pos[i0], pos[i0 + 1], pos[i0 + 2])
        vB.set(pos[i1], pos[i1 + 1], pos[i1 + 2])
        vC.set(pos[i2], pos[i2 + 1], pos[i2 + 2])
        area += vB.sub(vA).cross(vC.sub(vA)).length() / 2
      }
      areaByMaterial.set(matIndex, (areaByMaterial.get(matIndex) || 0) + area)
      const mesh = new THREE.Mesh(geo, materials[matIndex])
      mesh.userData.rlCarMaterialIndex = matIndex
      mesh.frustumCulled = false
      root.add(mesh)
    }
  }
  let bodyMaterialIndex = 0
  let bestArea = -1
  for (const [matIndex, area] of areaByMaterial) {
    if (area > bestArea) { bestArea = area; bodyMaterialIndex = matIndex }
  }

  // Normalize to game space: Y-up, nose toward -z, ground on y=0, centred on
  // x/z. Measure the rotated (still unscaled) bounds, then translate the root
  // inside the scaled wrapper — root.position applies after its own rotation,
  // and norm's scale multiplies it, so pre-scale units are consistent.
  const norm = new THREE.Group()
  // -π/2 yaw: the GLB's nose points along -x, which must land on the game's
  // forward (-z); the boost thrusters then sit on the +z tail as expected.
  root.rotation.set(-Math.PI / 2, 0, -Math.PI / 2)
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
    protoPromise = parseRlCarGlb(THREE).catch((err) => {
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
