/** Shared full-body scan used by bots, bosses and statues. */
export const HUMANOID_GLB_URL = '/models/man.glb'

/** Same crown as the procedural head (old robot skull + antenna). */
export const HUMANOID_GLB_CROWN_Y = 1.075

/** Source AABB Y from man.glb (Y-up, feet at min, crown at max). */
export const HUMANOID_GLB_SRC_YMIN = -0.5000574
export const HUMANOID_GLB_SRC_YMAX = 0.4999291

/** Local Y where the skull starts — used to split body vs head. */
export const HUMANOID_GLB_SRC_NECK_Y = 0.34

export function humanoidGlbFit(srcYMin = HUMANOID_GLB_SRC_YMIN, srcYMax = HUMANOID_GLB_SRC_YMAX, crownY = HUMANOID_GLB_CROWN_Y) {
  const height = srcYMax - srcYMin
  const scale = crownY / (height > 0.001 ? height : 1)
  return { scale, offsetY: -srcYMin * scale }
}

export function triangleIsHead(y0, y1, y2, cutY) {
  return (y0 + y1 + y2) / 3 >= cutY
}

/** Two geometries sharing vertex buffers: body below `cutY`, head on/above it. */
export function splitGeometryByY(THREE, geometry, cutY) {
  const pos = geometry.getAttribute('position')
  const idx = geometry.getIndex()
  const bodyIdx = []
  const headIdx = []
  const triCount = idx ? idx.count : pos.count
  for (let i = 0; i < triCount; i += 3) {
    const a = idx ? idx.getX(i) : i
    const b = idx ? idx.getX(i + 1) : i + 1
    const c = idx ? idx.getX(i + 2) : i + 2
    const dest = triangleIsHead(pos.getY(a), pos.getY(b), pos.getY(c), cutY) ? headIdx : bodyIdx
    dest.push(a, b, c)
  }
  const share = (indices) => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', pos)
    const normal = geometry.getAttribute('normal')
    if (normal) geo.setAttribute('normal', normal)
    const uv = geometry.getAttribute('uv')
    if (uv) geo.setAttribute('uv', uv)
    geo.setIndex(indices)
    return geo
  }
  return { bodyGeo: share(bodyIdx), headGeo: share(headIdx) }
}

function isUnder(obj, ancestor) {
  let node = obj
  while (node) {
    if (node === ancestor) return true
    node = node.parent
  }
  return false
}

let protoPromise = null

export function loadHumanoidGlbPrototype(THREE) {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (!protoPromise) {
    protoPromise = import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => (
      new GLTFLoader().loadAsync(HUMANOID_GLB_URL)
    )).then((gltf) => {
      let source = null
      gltf.scene.traverse((obj) => {
        if (obj.isMesh && !source) source = obj
      })
      if (!source?.geometry) throw new Error('man.glb has no mesh')
      const { bodyGeo, headGeo } = splitGeometryByY(THREE, source.geometry, HUMANOID_GLB_SRC_NECK_Y)
      const material = source.material
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace
      if (material.map) material.map.anisotropy = 8
      if (material.metalnessMap) material.metalnessMap.anisotropy = 4
      material.roughness = 0.55
      material.metalness = 0.12
      return { bodyGeo, headGeo, material }
    }).catch((err) => {
      protoPromise = null
      console.warn('[humanoid-glb]', err)
      return null
    })
  }
  return protoPromise
}

/**
 * Overlay the scanned body on the existing animation rig. USB/RJ45 hands stay
 * on the arm groups; capsule flesh hides once the GLB is ready. `hideHead`
 * (bosses/statues) keeps the photo head; bots keep the scanned skull so the
 * RL-car mount can hide only the body mesh.
 */
export function attachHumanoidGlb(THREE, parent, {
  bulk = 1,
  hideHead = false,
  tint = null,
  bodyMeshes = null,
  hands = [],
} = {}) {
  const fit = new THREE.Group()
  fit.name = 'humanoidGlbFit'
  const { scale, offsetY } = humanoidGlbFit()
  fit.scale.set(scale * bulk, scale, scale * bulk)
  fit.position.y = offsetY
  parent.add(fit)
  parent.userData.useGlbHead = !hideHead

  const bodyHold = new THREE.Group()
  bodyHold.name = 'humanoidGlbBody'
  fit.add(bodyHold)
  if (bodyMeshes) bodyMeshes.push(bodyHold)

  const headHold = hideHead ? null : new THREE.Group()
  if (headHold) {
    headHold.name = 'humanoidGlbHead'
    fit.add(headHold)
  }

  loadHumanoidGlbPrototype(THREE).then((proto) => {
    if (!proto || !fit.parent) return
    const mat = proto.material.clone()
    if (tint) {
      mat.color = new THREE.Color('#ffffff').lerp(new THREE.Color(tint), 0.18)
    }
    const body = new THREE.Mesh(proto.bodyGeo, mat)
    body.name = 'humanoidGlbBodyMesh'
    body.frustumCulled = false
    bodyHold.add(body)
    if (headHold) {
      const head = new THREE.Mesh(proto.headGeo, mat)
      head.name = 'humanoidGlbHeadMesh'
      head.frustumCulled = false
      headHold.add(head)
      const procedural = parent.userData.proceduralHeadMeshes
      if (procedural) {
        for (const mesh of procedural) mesh.visible = false
      }
    }
    if (bodyMeshes) {
      for (const mesh of bodyMeshes) {
        if (mesh === bodyHold || !mesh.isMesh) continue
        if (hands.some((hand) => isUnder(mesh, hand))) continue
        mesh.visible = false
      }
    }
    parent.userData.humanoidGlbReady = true
  })
  return fit
}
