/** Shared full-body scan used by bots, bosses and statues. */
export const HUMANOID_GLB_URL = '/models/man.glb'

/** Same crown as the procedural head (old robot skull + antenna). */
export const HUMANOID_GLB_CROWN_Y = 1.075

/** Source AABB Y from man.glb (Y-up, feet at min, crown at max). */
export const HUMANOID_GLB_SRC_YMIN = -0.5000574
export const HUMANOID_GLB_SRC_YMAX = 0.4999291

/** Local Y where the skull starts — used to split body vs head. */
export const HUMANOID_GLB_SRC_NECK_Y = 0.34

/**
 * Source AABB of skull verts (y ≥ neck) in man.glb. Photo heads must match
 * this volume — not the old 0.64-tall mask cube.
 */
export const HUMANOID_GLB_SRC_HEAD = Object.freeze({
  minX: -0.057689,
  maxX: 0.065832,
  minY: 0.340029,
  maxY: 0.499921,
  minZ: -0.143905,
  maxZ: -0.011906,
})

/** Scan faces +Z; photo heads and the rig face −Z, so the mesh is yawed 180°. */
export const HUMANOID_GLB_YAW = Math.PI

export function humanoidGlbFit(srcYMin = HUMANOID_GLB_SRC_YMIN, srcYMax = HUMANOID_GLB_SRC_YMAX, crownY = HUMANOID_GLB_CROWN_Y) {
  const height = srcYMax - srcYMin
  const scale = crownY / (height > 0.001 ? height : 1)
  return { scale, offsetY: -srcYMin * scale }
}

/** Parent-space Y of the GLB neck cut (bottom of the skull). */
export function humanoidGlbNeckY() {
  const { scale, offsetY } = humanoidGlbFit()
  return HUMANOID_GLB_SRC_NECK_Y * scale + offsetY
}

/**
 * Parent-space skull box after fit + 180° yaw. `bulk` scales X/Z like the
 * scanned overlay; height stays the fitted crown-to-neck span.
 */
export function humanoidGlbHeadBounds(bulk = 1) {
  const { scale, offsetY } = humanoidGlbFit()
  const src = HUMANOID_GLB_SRC_HEAD
  const b = Number.isFinite(bulk) && bulk > 0 ? bulk : 1
  const yaw = HUMANOID_GLB_YAW
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const midX = ((src.minX + src.maxX) / 2) * scale * b
  const midZ = ((src.minZ + src.maxZ) / 2) * scale * b
  return {
    width: (src.maxX - src.minX) * scale * b,
    height: (src.maxY - src.minY) * scale,
    depth: (src.maxZ - src.minZ) * scale * b,
    centerX: c * midX + s * midZ,
    centerY: ((src.minY + src.maxY) / 2) * scale + offsetY,
    centerZ: -s * midX + c * midZ,
    neckY: HUMANOID_GLB_SRC_NECK_Y * scale + offsetY,
    crownY: HUMANOID_GLB_CROWN_Y,
  }
}

export function triangleIsHead(y0, y1, y2, cutY) {
  return (y0 + y1 + y2) / 3 >= cutY
}

/** Source-space point → parent space after fit scale, feet offset and 180° yaw. */
export function glbSourceToParent(point, { scale, offsetY, bulk = 1, yaw = HUMANOID_GLB_YAW } = humanoidGlbFit()) {
  const x = point.x * scale * bulk
  const y = point.y * scale + offsetY
  const z = point.z * scale * bulk
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { x: c * x + s * z, y, z: -s * x + c * z }
}

export function findHandAnchors(positions, count) {
  const left = []
  const right = []
  for (let i = 0; i < count; i += 1) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    if (y < 0.02) continue
    if (x <= -0.12) left.push({ x, y, z, score: -x })
    else if (x >= 0.12) right.push({ x, y, z, score: x })
  }
  const tip = (arr) => {
    if (!arr.length) return { x: 0, y: 0.2, z: -0.12 }
    arr.sort((a, b) => b.score - a.score)
    const n = Math.max(1, Math.min(arr.length, Math.floor(arr.length * 0.04) || 1))
    let sx = 0
    let sy = 0
    let sz = 0
    for (let i = 0; i < n; i += 1) {
      sx += arr[i].x
      sy += arr[i].y
      sz += arr[i].z
    }
    return { x: sx / n, y: sy / n, z: sz / n }
  }
  const leftTip = tip(left)
  const rightTip = tip(right)
  return {
    left: leftTip,
    right: rightTip,
    raised: leftTip.y >= rightTip.y ? 'left' : 'right',
  }
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

function makeClothedMaterial(THREE, protoMat, colors = {}, sleeve = 'long') {
  const mat = protoMat.clone()
  mat.metalnessMap = null
  mat.roughnessMap = null
  mat.metalness = 0.04
  mat.roughness = 0.68
  mat.color.set('#ffffff')
  const skin = new THREE.Color(colors.skin || '#e8c4a8')
  const torso = new THREE.Color(colors.torso || '#334155')
  const legs = new THREE.Color(colors.legs || colors.torso || '#1e293b')
  const shoes = new THREE.Color(colors.shoes || '#1c1916')
  const sleeveMode = sleeve === 'bare' ? 2 : sleeve === 'short' ? 1 : 0
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSkin = { value: skin }
    shader.uniforms.uTorso = { value: torso }
    shader.uniforms.uLegs = { value: legs }
    shader.uniforms.uShoes = { value: shoes }
    shader.uniforms.uSleeve = { value: sleeveMode }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBodySrc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBodySrc = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vBodySrc;
uniform vec3 uSkin;
uniform vec3 uTorso;
uniform vec3 uLegs;
uniform vec3 uShoes;
uniform float uSleeve;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
vec3 region = uTorso;
if (vBodySrc.y < -0.42) region = uShoes;
else if (vBodySrc.y < 0.02) region = uLegs;
else if (vBodySrc.y >= 0.32) region = uSkin;
float arm = step(0.11, abs(vBodySrc.x)) * step(0.0, vBodySrc.y) * step(vBodySrc.y, 0.32);
if (arm > 0.5) {
  if (uSleeve > 1.5) region = uSkin;
  else if (uSleeve > 0.5 && vBodySrc.y < 0.16) region = uSkin;
  else region = uTorso;
}
diffuseColor.rgb *= region;`,
      )
  }
  mat.customProgramCacheKey = () => `humanoidGlbClothes-${sleeveMode}`
  return mat
}

function placeAt(parent, obj, point) {
  if (!obj || !parent || !point) return
  parent.add(obj)
  obj.position.set(point.x, point.y, point.z)
  obj.rotation.set(0, 0, 0)
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
      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace
        material.map.anisotropy = 8
      }
      const pos = source.geometry.getAttribute('position')
      const packed = []
      for (let i = 0; i < pos.count; i += 1) packed.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      const hands = findHandAnchors(packed, pos.count)
      return { bodyGeo, headGeo, material, hands }
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
  colors = {},
  sleeve = 'long',
  bodyMeshes = null,
  hands = [],
} = {}) {
  const fit = new THREE.Group()
  fit.name = 'humanoidGlbFit'
  const { scale, offsetY } = humanoidGlbFit()
  fit.scale.set(scale * bulk, scale, scale * bulk)
  fit.position.y = offsetY
  fit.rotation.y = HUMANOID_GLB_YAW
  parent.add(fit)
  parent.userData.useGlbHead = !hideHead
  parent.userData.humanoidGlbFit = fit
  parent.userData.humanoidGlbRestY = offsetY
  parent.userData.humanoidGlbRestZ = 0
  parent.userData.humanoidGlbLeftHand = hands[0]
  parent.userData.humanoidGlbRightHand = hands[1]

  const bodyHold = new THREE.Group()
  bodyHold.name = 'humanoidGlbBody'
  fit.add(bodyHold)
  if (bodyMeshes) bodyMeshes.push(bodyHold)
  parent.userData.humanoidGlbBody = bodyHold

  const headHold = hideHead ? null : new THREE.Group()
  if (headHold) {
    headHold.name = 'humanoidGlbHead'
    fit.add(headHold)
    parent.userData.humanoidGlbHead = headHold
  }

  loadHumanoidGlbPrototype(THREE).then((proto) => {
    if (!proto || !fit.parent) return
    const mat = makeClothedMaterial(THREE, proto.material, colors, sleeve)
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
        mesh.userData.glbSuppressed = true
        mesh.visible = false
      }
    }
    const left = glbSourceToParent(proto.hands.left, { scale, offsetY, bulk })
    const right = glbSourceToParent(proto.hands.right, { scale, offsetY, bulk })
    placeAt(parent, hands[0], left)
    placeAt(parent, hands[1], right)
    const raised = proto.hands.raised === 'left' ? left : right
    parent.userData.humanoidGlbRaisedPoint = raised
    dockHeldItemsToGlb(parent)
    parent.userData.humanoidGlbReady = true
    parent.userData.humanoidGlbRaised = proto.hands.raised
    if (parent.userData.humanoidGlbSeated) {
      seatHumanoidGlbInCar(parent, parent.userData.humanoidGlbSeatOpts)
    }
  })
  return fit
}

export function dockHeldItemsToGlb(parent) {
  const raised = parent?.userData?.humanoidGlbRaisedPoint
  const tool = parent?.userData?.tool
  if (!raised || !tool) return
  tool.position.set(raised.x, raised.y, raised.z)
  parent.userData.rlStandToolPos = tool.position.clone()
}

/** Hide the scanned torso/limbs and drop the skull into a cockpit. */
export function seatHumanoidGlbInCar(parent, { neckY = 0.48, neckZ = 0 } = {}) {
  if (!parent) return
  parent.userData.humanoidGlbSeatOpts = { neckY, neckZ }
  const body = parent.userData.humanoidGlbBody
  const fit = parent.userData.humanoidGlbFit
  if (body) body.visible = false
  for (const arm of parent.userData.humanArms || []) arm.visible = false
  for (const leg of parent.userData.humanLegs || []) leg.visible = false
  if (parent.userData.tool) parent.userData.tool.visible = false
  for (const hand of [parent.userData.humanoidGlbLeftHand, parent.userData.humanoidGlbRightHand]) {
    if (hand) hand.visible = false
  }
  if (!fit) return
  const { scale, offsetY } = humanoidGlbFit()
  const neckParentY = HUMANOID_GLB_SRC_NECK_Y * scale + offsetY
  fit.position.y = offsetY + (neckY - neckParentY)
  fit.position.z = neckZ
  parent.userData.humanoidGlbSeated = true
}

export function unseatHumanoidGlb(parent) {
  if (!parent) return
  const body = parent.userData.humanoidGlbBody
  const fit = parent.userData.humanoidGlbFit
  if (body) body.visible = true
  for (const arm of parent.userData.humanArms || []) arm.visible = true
  for (const leg of parent.userData.humanLegs || []) leg.visible = true
  if (parent.userData.tool) parent.userData.tool.visible = true
  if (fit) {
    fit.position.y = parent.userData.humanoidGlbRestY ?? fit.position.y
    fit.position.z = parent.userData.humanoidGlbRestZ ?? 0
  }
  parent.userData.humanoidGlbSeated = false
}
