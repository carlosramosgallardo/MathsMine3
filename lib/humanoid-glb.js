/**
 * Default body for every character until it gets its own GLB. Baked from the
 * Sketchfab CC-BY "Male Body" scan by scripts/bake-humanoid-glb.mjs, which
 * normalises it to this space and auto-rigs the bones below (credits: README).
 */
export const HUMANOID_GLB_URL = '/models/man.glb'

/** Same crown as the procedural head (old robot skull + antenna). */
export const HUMANOID_GLB_CROWN_Y = 1.075

/** Source AABB Y of a baked body (Y-up, feet at 0, crown at max). */
export const HUMANOID_GLB_SRC_YMIN = 0
export const HUMANOID_GLB_SRC_YMAX = 1.895

/** Local Y where the skull starts — used to split body vs head. */
export const HUMANOID_GLB_SRC_NECK_Y = 1.65

/**
 * Source AABB of skull verts (y ≥ neck). Photo heads must match this volume —
 * not the old 0.64-tall mask cube.
 */
export const HUMANOID_GLB_SRC_HEAD = Object.freeze({
  minX: -0.1,
  maxX: 0.1,
  minY: 1.65,
  maxY: 1.895,
  minZ: -0.102,
  maxZ: 0.137,
})

/** Shoulder half-width (not the outstretched hands). Hit box stays ≤ 0.38. */
export const HUMANOID_GLB_SRC_TORSO_HALF_X = 0.28

/**
 * Bind-pose bands the clothing shader paints between (source units). Measured
 * on the baked body: shoes stop at the ankle, trousers at the waist, the arms
 * separate from the torso beyond ARM_X and the bare hands start at HAND_X.
 */
export const HUMANOID_GLB_SRC_CLOTHES = Object.freeze({
  shoeTopY: 0.105,
  waistY: 0.98,
  skinY: 1.6,
  armX: 0.22,
  armLoY: 0.86,
  armHiY: 1.5,
  elbowY: 1.2,
  handX: 0.42,
  handTopY: 1.02,
})

/** Mesh faces +Z; photo heads and the rig face −Z, so the overlay is yawed 180°. */
export const HUMANOID_GLB_YAW = Math.PI

export function humanoidGlbFit(srcYMin = HUMANOID_GLB_SRC_YMIN, srcYMax = HUMANOID_GLB_SRC_YMAX, crownY = HUMANOID_GLB_CROWN_Y) {
  const height = srcYMax - srcYMin
  const scale = crownY / (height > 0.001 ? height : 1)
  return { scale, offsetY: -srcYMin * scale }
}

/**
 * Saturated albedo read shared by Trump/Bibi sculpts and textured scans — white
 * tint, no metal/rough maps, same roughness as vertex-colour quadrupeds.
 */
export function makeVividAlbedoMaterial(THREE, {
  map = null,
  color = 0xffffff,
  vertexColors = false,
  transparent = false,
  opacity = 1,
  side = THREE.FrontSide,
} = {}) {
  const mat = new THREE.MeshStandardMaterial({
    map,
    color,
    vertexColors,
    metalness: 0,
    roughness: 0.72,
    envMapIntensity: 0.25,
    transparent,
    opacity,
    side,
    depthWrite: !transparent || opacity >= 0.99,
  })
  if (map) {
    mat.map.colorSpace = THREE.SRGBColorSpace
    mat.map.anisotropy = 8
    mat.map.minFilter = THREE.LinearMipmapLinearFilter
    mat.map.magFilter = THREE.LinearFilter
    mat.map.generateMipmaps = true
    mat.map.needsUpdate = true
  }
  return mat
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

/** Hit-box for bosses that share the scanned crown/neck. */
export function humanoidGlbHitBounds(halfWidth = 0.38, feet = 0.04) {
  return Object.freeze({
    headTop: HUMANOID_GLB_CROWN_Y,
    headBottom: humanoidGlbNeckY(),
    feet,
    halfWidth,
  })
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

/** Source-space ball around each palm used to place RJ45 / mini-USB hands. */
export const HUMANOID_GLB_SRC_HAND_RADIUS = 0.09

export function findHandAnchors(positions, count, radius = HUMANOID_GLB_SRC_HAND_RADIUS) {
  let leftTip = null
  let rightTip = null
  let leftScore = -Infinity
  let rightScore = -Infinity
  for (let i = 0; i < count; i += 1) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    if (y < 0) continue
    if (x <= -0.10) {
      const score = -x + y * 0.15
      if (score > leftScore) {
        leftScore = score
        leftTip = { x, y, z }
      }
    } else if (x >= 0.10) {
      const score = x + y * 0.15
      if (score > rightScore) {
        rightScore = score
        rightTip = { x, y, z }
      }
    }
  }
  const cluster = (tip) => {
    if (!tip) return { x: 0, y: 0.2, z: -0.12 }
    const r2 = radius * radius
    let sx = 0
    let sy = 0
    let sz = 0
    let n = 0
    for (let i = 0; i < count; i += 1) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]
      const dx = x - tip.x
      const dy = y - tip.y
      const dz = z - tip.z
      if (dx * dx + dy * dy + dz * dz > r2) continue
      sx += x
      sy += y
      sz += z
      n += 1
    }
    if (!n) return tip
    return { x: sx / n, y: sy / n, z: sz / n }
  }
  const left = cluster(leftTip)
  const right = cluster(rightTip)
  return {
    left,
    right,
    raised: left.y >= right.y ? 'left' : 'right',
  }
}

/** World-space fist span so RJ45 / mini-USB match the scanned palms. */
export function humanoidGlbHandSpan(bulk = 1) {
  const { scale } = humanoidGlbFit()
  const b = Number.isFinite(bulk) && bulk > 0 ? bulk : 1
  return HUMANOID_GLB_SRC_HAND_RADIUS * scale * b
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
    for (const name of Object.keys(geometry.attributes)) {
      geo.setAttribute(name, geometry.getAttribute(name))
    }
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

/** RJ45 / mini-USB plugs stay on the bones; sphere fists hide with the capsule. */
export function keepProceduralHandWithGlb(mesh, hands) {
  return (hands || []).some((hand) => Boolean(hand?.userData?.connectorNative) && isUnder(mesh, hand))
}

/** Share (do not clone) a GLTFLoader map — cloning before decode leaves a permanent null image. */
export function prepareSharedGltfMap(THREE, map) {
  if (!map) return null
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = Math.max(map.anisotropy || 0, 8)
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.magFilter = THREE.LinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true
  return map
}

/**
 * Albedo for Kim/Macron/Zelensky props: keep the GLTF material's map by reference
 * (shared cache). Stripping metal/rough maps and forcing metalness 0 prevents the
 * white chrome look under ACES + home PointLights.
 */
export function makeStatueDisplayMaterial(THREE, protoMat, { side = THREE.DoubleSide } = {}) {
  if (!protoMat) {
    return new THREE.MeshStandardMaterial({
      color: 0x8a8a8a,
      metalness: 0,
      roughness: 0.72,
      side,
    })
  }
  const mat = protoMat.clone()
  mat.side = side
  mat.metalness = 0
  mat.roughness = Number.isFinite(mat.roughness) ? Math.max(0.55, mat.roughness) : 0.72
  mat.metalnessMap = null
  mat.roughnessMap = null
  mat.normalMap = null
  mat.envMapIntensity = 0.2
  mat.emissive?.setHex?.(0x000000)
  mat.emissiveIntensity = 0
  if (mat.map) {
    prepareSharedGltfMap(THREE, mat.map)
    mat.color?.setHex?.(0xffffff)
    mat.userData.sharedGltfMap = true
  } else if (mat.color) {
    // No albedo map (eyelashes etc.) — keep the GLTF factor colour.
  }
  mat.needsUpdate = true
  return mat
}

/** Runtime albedo for a GLTFLoader material — always shares cached `.map` textures. */
export function makeTexturedMaterial(THREE, protoMat, { side = THREE.FrontSide } = {}) {
  const map = prepareSharedGltfMap(THREE, protoMat?.map || null)
  const mat = makeVividAlbedoMaterial(THREE, {
    map,
    color: map ? 0xffffff : (protoMat?.color?.getHex?.() ?? 0x2a2a2a),
    vertexColors: false,
    transparent: Boolean(protoMat?.transparent && protoMat?.opacity < 0.99),
    opacity: protoMat?.transparent ? protoMat.opacity : 1,
    side,
  })
  if (map) mat.userData.sharedGltfMap = true
  return mat
}

function makeClothedMaterial(THREE, protoMat, colors = {}, sleeve = 'long') {
  const mat = protoMat.clone()
  mat.vertexColors = false
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
  const band = HUMANOID_GLB_SRC_CLOTHES
  const f = (value) => value.toFixed(3)
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
if (vBodySrc.y < ${f(band.shoeTopY)}) region = uShoes;
else if (vBodySrc.y < ${f(band.waistY)}) region = uLegs;
else if (vBodySrc.y >= ${f(band.skinY)}) region = uSkin;
float arm = step(${f(band.armX)}, abs(vBodySrc.x)) * step(${f(band.armLoY)}, vBodySrc.y) * step(vBodySrc.y, ${f(band.armHiY)});
if (arm > 0.5) {
  if (uSleeve > 1.5) region = uSkin;
  else if (uSleeve > 0.5 && vBodySrc.y < ${f(band.elbowY)}) region = uSkin;
  else region = uTorso;
}
// Hands stay bare whatever the sleeve is.
if (abs(vBodySrc.x) > ${f(band.handX)} && vBodySrc.y < ${f(band.handTopY)}) region = uSkin;
diffuseColor.rgb *= region;`,
      )
  }
  mat.customProgramCacheKey = () => `humanoidGlbClothes-${sleeveMode}`
  return mat
}

/**
 * Capsule +X pitch aims at parent −Z (forward). Bones live under
 * HUMANOID_GLB_YAW, which flips X and Z, so the same Euler would point
 * backward. Negate pitch and yaw-roll when copying capsule → bone.
 */
export const HUMANOID_GLB_CAPSULE_PITCH = -1

/** Map a capsule limb Euler onto an identity-rest auto-rig bone. */
export function glbLimbFromCapsule(rotation, baseRotZ = 0) {
  const pitch = HUMANOID_GLB_CAPSULE_PITCH
  return {
    x: rotation.x * pitch + 0,
    z: (rotation.z - baseRotZ) * pitch + 0,
  }
}

function collectNamed(root, names) {
  const map = {}
  root.traverse((obj) => {
    if (obj.name && names.includes(obj.name)) map[obj.name] = obj
  })
  return map
}

/** Standard humanoid names plus Ready Player Me / Sketchfab suffixes (_013, etc.). */
const HUMANOID_BONE_ALIASES = Object.freeze({
  Hips: [/^Hips$/i, /^Hips_/],
  Spine: [/^Spine$/i, /^Spine_02$/],
  Chest: [/^Chest$/i, /^Spine2_/],
  Neck: [/^Neck$/i, /^Neck2_/],
  Head: [/^Head$/i, /^Head_/],
  LeftShoulder: [/^LeftShoulder$/i, /^LeftShoulder_/],
  LeftUpperArm: [/^LeftUpperArm$/i, /^LeftArm_/],
  LeftLowerArm: [/^LeftLowerArm$/i, /^LeftForeArm_\d+$/],
  LeftHand: [/^LeftHand$/i, /^LeftHand_\d+$/],
  RightShoulder: [/^RightShoulder$/i, /^RightShoulder_/],
  RightUpperArm: [/^RightUpperArm$/i, /^RightArm_/],
  RightLowerArm: [/^RightLowerArm$/i, /^RightForeArm_\d+$/],
  RightHand: [/^RightHand$/i, /^RightHand_\d+$/],
  LeftUpperLeg: [/^LeftUpperLeg$/i, /^LeftUpLeg_/],
  LeftLowerLeg: [/^LeftLowerLeg$/i, /^LeftLeg_/],
  LeftFoot: [/^LeftFoot$/i, /^LeftFoot_/],
  RightUpperLeg: [/^RightUpperLeg$/i, /^RightUpLeg_/],
  RightLowerLeg: [/^RightLowerLeg$/i, /^RightLeg_/],
  RightFoot: [/^RightFoot$/i, /^RightFoot_/],
})

/** Palm offset in RightHand-local units so the USB grip sits in the fist, not the wrist. */
const USB_PALM_LOCAL = Object.freeze({ x: 0.018, y: -0.042, z: 0.012 })

function findBoneByAlias(root, patterns) {
  let found = null
  root.traverse((obj) => {
    if (found || !obj.name) return
    for (const pattern of patterns) {
      if (pattern.test(obj.name)) {
        found = obj
        return
      }
    }
  })
  return found
}

export function collectHumanoidBones(root) {
  const bones = {}
  for (const [canonical, patterns] of Object.entries(HUMANOID_BONE_ALIASES)) {
    const hit = findBoneByAlias(root, patterns)
    if (hit) bones[canonical] = hit
  }
  return bones
}

function isRpmTposeArmBone(bone) {
  return /^(Left|Right)(Arm|ForeArm)_/.test(bone?.name || '')
}

function attachConnectorToHandBone(bone, connector, bulk) {
  if (!bone || !connector) return
  bone.add(connector)
  // A-pose rest uses identity bones with a sideways offset; aim the plug (−Y)
  // along that incoming bone so clips that pitch the arm take the jack with them.
  const along = bone.position.clone()
  if (along.lengthSq() > 1e-8) {
    along.normalize()
    const down = along.clone()
    down.set(0, -1, 0)
    connector.quaternion.setFromUnitVectors(down, along)
  } else {
    connector.rotation.set(0, 0, 0)
  }
  connector.position.set(0, -HUMANOID_GLB_SRC_HAND_RADIUS * 0.55, 0)
  const native = connector.userData.connectorNative
  if (!native) return
  const palm = HUMANOID_GLB_SRC_HAND_RADIUS
  const b = Number.isFinite(bulk) && bulk > 0 ? bulk : 1
  connector.scale.set(palm / native, (palm * b) / native, palm / native)
}

function applyLimb(bone, capsule, side = 1) {
  if (!bone || !capsule) return
  const pose = glbLimbFromCapsule(capsule.rotation, capsule.userData.baseRotZ || 0)
  if (isRpmTposeArmBone(bone)) {
    // Zelensky/Macron RPM: local +X rest drop lands A-pose. Local ±Z roll
    // (older Mixamo-style map) lifts the hands into the face on these rigs.
    bone.rotation.x = Math.PI / 2 + pose.x
    bone.rotation.z = pose.z * (side < 0 ? 1 : -1) * 0.35
  } else {
    bone.rotation.x = pose.x
    bone.rotation.z = pose.z
  }
}

export const PLAZA_ARM_IDLE = Object.freeze({
  zelenskyCheer: 'zelenskyCheer',
  macronWave: 'macronWave',
})

function snapshotBoneRests(bones) {
  const rest = {}
  for (const [name, bone] of Object.entries(bones || {})) {
    if (bone?.quaternion && Number.isFinite(bone.quaternion.w)) {
      rest[name] = {
        x: bone.quaternion.x,
        y: bone.quaternion.y,
        z: bone.quaternion.z,
        w: bone.quaternion.w,
      }
    } else if (bone?.rotation) {
      rest[name] = {
        euler: { x: bone.rotation.x || 0, y: bone.rotation.y || 0, z: bone.rotation.z || 0 },
      }
    }
  }
  return rest
}

function restoreBoneRest(bone, rest) {
  if (!bone || !rest) return
  if (bone.quaternion?.set && Number.isFinite(rest.w)) {
    bone.quaternion.set(rest.x, rest.y, rest.z, rest.w)
    return
  }
  if (rest.euler && bone.rotation) {
    bone.rotation.x = rest.euler.x
    bone.rotation.y = rest.euler.y
    bone.rotation.z = rest.euler.z
  }
}

function restorePlazaBoneRests(host) {
  const bones = host?.userData?.humanoidGlbBones
  const rest = host?.userData?.humanoidGlbBoneRest
  if (!bones || !rest) return
  for (const [name, snap] of Object.entries(rest)) {
    restoreBoneRest(bones[name], snap)
  }
}

/** Local Euler on top of the RPM rest pose — never overwrite the bind quaternion. */
function addLocalEuler(bone, dx, dy, dz) {
  if (!bone) return
  if (typeof bone.rotateX === 'function') {
    if (dx) bone.rotateX(dx)
    if (dy) bone.rotateY(dy)
    if (dz) bone.rotateZ(dz)
    return
  }
  if (!bone.rotation) return
  bone.rotation.x = (bone.rotation.x || 0) + dx
  bone.rotation.y = (bone.rotation.y || 0) + dy
  bone.rotation.z = (bone.rotation.z || 0) + dz
}

/** Zelensky: both arms pumping overhead like a stadium cheer. */
function poseZelenskyCheer(bones, t) {
  const pump = Math.sin(t * 5.8)
  const flap = Math.sin(t * 11.6)
  addLocalEuler(bones.LeftUpperArm, 0, flap * 0.08, -1.15 + pump * 0.25)
  addLocalEuler(bones.RightUpperArm, 0, -flap * 0.08, 1.15 - pump * 0.25)
  addLocalEuler(bones.LeftLowerArm, 0.1, 0.55 + pump * 0.12, 0)
  addLocalEuler(bones.RightLowerArm, 0.1, -0.55 - pump * 0.12, 0)
  addLocalEuler(bones.LeftHand, 0, 0, flap * 0.22)
  addLocalEuler(bones.RightHand, 0, 0, -flap * 0.22)
}

/** Macron: left hand on hip, right arm a fussy little diplomatic wave. */
function poseMacronWave(bones, t) {
  const flap = Math.sin(t * 8.4)
  const nod = Math.sin(t * 2.2) * 0.06
  addLocalEuler(bones.LeftUpperArm, nod, 0.08, -0.42)
  addLocalEuler(bones.LeftLowerArm, 0.08, 0.95, 0.12)
  addLocalEuler(bones.LeftHand, 0.08, 0, 0.2)
  addLocalEuler(bones.RightUpperArm, nod, 0.18, 1.05)
  addLocalEuler(bones.RightLowerArm, 0.05, -1.05, flap * 0.65)
  addLocalEuler(bones.RightHand, 0, flap * 0.18, flap * 0.35)
}

/**
 * Funny per-statue arm idle on the live RPM skeleton (bind pose stays
 * original — we do not bake A-pose spikes into the mesh).
 */
export function posePlazaArmIdle(host, time = null) {
  const style = host?.userData?.plazaArmIdle
  const bones = host?.userData?.humanoidGlbBones
  if (!style || !bones) return false
  let t = 0
  if (Number.isFinite(time)) t = time
  else if (Number.isFinite(host.userData.plazaArmTime)) t = host.userData.plazaArmTime
  restorePlazaBoneRests(host)
  if (style === PLAZA_ARM_IDLE.zelenskyCheer) poseZelenskyCheer(bones, t)
  else if (style === PLAZA_ARM_IDLE.macronWave) poseMacronWave(bones, t)
  else return false
  return true
}

function copyCapsulePoseToGlbBones(host) {
  if (host?.userData?.freezeGlbPose) return
  const bones = host?.userData?.humanoidGlbBones
  if (!bones) return
  const now = typeof performance !== 'undefined' ? performance.now() * 0.001 : 0
  host.userData.plazaArmTime = now
  if (posePlazaArmIdle(host, now)) return
  const [lArm, rArm] = host.userData.humanArms || []
  const [lLeg, rLeg] = host.userData.humanLegs || []
  applyLimb(bones.LeftUpperLeg, lLeg, -1)
  applyLimb(bones.RightUpperLeg, rLeg, 1)
  applyLimb(bones.LeftUpperArm, lArm, -1)
  applyLimb(bones.RightUpperArm, rArm, 1)
  // Soft wrist sway — hands only (forearms/torso stay on the A-pose rest).
  const t = Number(host.userData.handSwayTime) || 0
  const amp = Number.isFinite(host.userData.handSwayAmp) ? host.userData.handSwayAmp : 0.35
  if (bones.LeftHand && amp > 0) {
    const w = Math.sin(t * 1.55) * 0.14 * amp
    const r = Math.sin(t * 1.15 + 0.9) * 0.09 * amp
    bones.LeftHand.rotation.x = w
    bones.LeftHand.rotation.z = r
  }
  if (bones.RightHand && amp > 0) {
    const w = Math.sin(t * 1.55 + 0.4) * 0.14 * amp
    const r = Math.sin(t * 1.15 + 1.4) * 0.09 * amp
    bones.RightHand.rotation.x = -w * 0.9
    bones.RightHand.rotation.z = -r
  }
}

/** Drive light wrist sway on skinned plaza statues (Zelensky / Macron). */
export function setHumanoidHandSway(host, time, intensity = 0.35) {
  if (!host) return
  host.userData.handSwayTime = time
  host.userData.handSwayAmp = intensity
}

/** Map the live capsule pose onto a named GLB clip. */
export function pickHumanoidGlbClip(host) {
  const [lArm, rArm] = host?.userData?.humanArms || []
  if (!lArm || !rArm) return 'idle'
  const [lLeg, rLeg] = host.userData.humanLegs || []
  const lX = lArm.rotation.x
  const rX = rArm.rotation.x
  const armZ = Math.max(Math.abs(lArm.rotation.z), Math.abs(rArm.rotation.z))
  const lLegX = lLeg?.rotation.x || 0
  const rLegX = rLeg?.rotation.x || 0
  const legX = Math.max(Math.abs(lLegX), Math.abs(rLegX))
  const rDz = rArm.rotation.z - (rArm.userData.baseRotZ || 0)
  if (armZ > 2.1 && (lLegX < -0.4 || rLegX < -0.4)) return 'jump_flail'
  if (armZ > 1.15 && legX > 0.4) return 'jump_flap'
  if (armZ > 2.1) return 'both_arms_up'
  if (rX > 2.2 && lX > 2.2) return 'both_arms_up'
  if (rX > 1.85 && rDz < -0.7 && lX < 0.5) return 'salute_right'
  if (rX > 1.4 && lX > 1.4) return 'point_forward'
  if (rX > 1.55 && rX < 2.15 && Math.abs(rDz) > 0.2 && lX < 0.8) return 'wave_right'
  if (rX > 0.45 && rX < 1.4 && rDz < -0.35) return 'point_forward'
  if (legX > 0.12) return 'walk'
  return 'idle'
}

const HUMANOID_GLB_HOLD_CLIPS = new Set(['point_forward', 'salute_right'])

function playHumanoidGlbClip(host, name) {
  const actions = host?.userData?.humanoidGlbActions
  if (!actions || !actions[name] || host.userData.humanoidGlbClip === name) return
  const prevName = host.userData.humanoidGlbClip
  const prev = prevName ? actions[prevName] : null
  const next = actions[name]
  host.userData.humanoidGlbClip = name
  next.reset()
  next.enabled = true
  next.setEffectiveWeight(1)
  next.fadeIn(0.12)
  next.play()
  if (prev && prev !== next) prev.fadeOut(0.12)
}

function tickHumanoidGlbMixer(host) {
  const mixer = host?.userData?.humanoidGlbMixer
  if (!mixer) {
    copyCapsulePoseToGlbBones(host)
    return
  }
  playHumanoidGlbClip(host, pickHumanoidGlbClip(host))
  const now = typeof performance !== 'undefined' ? performance.now() : 0
  const prev = host.userData.humanoidGlbClipMs || now
  host.userData.humanoidGlbClipMs = now
  mixer.update(Math.min(0.05, Math.max(0, (now - prev) / 1000)))
}

function dockToolFromRaisedBone(host) {
  const tool = host?.userData?.tool
  const raised = host?.userData?.humanoidGlbRaisedBone
  if (!tool || !raised?.matrixWorld) return
  const tmp = host.userData.humanoidGlbTmpV3 || (host.userData.humanoidGlbTmpV3 = raised.position.clone())
  tmp.set(USB_PALM_LOCAL.x, USB_PALM_LOCAL.y, USB_PALM_LOCAL.z)
  if (typeof raised.localToWorld === 'function') raised.localToWorld(tmp)
  else tmp.setFromMatrixPosition(raised.matrixWorld)
  host.worldToLocal(tmp)
  tool.position.copy(tmp)
  tool.updateMatrix()
  if (tool.updateWorldMatrix) tool.updateWorldMatrix(false, true)
  host.userData.humanoidGlbRaisedPoint = tool.position.clone()
  host.userData.rlStandToolPos = tool.position.clone()
}

/** Attach an RPM plaza skeleton so capsule legs + plazaArmIdle can pose it. */
export function bindPlazaStatueSkin(parent, clone) {
  if (!parent || !clone) return
  const bones = collectHumanoidBones(clone)
  parent.userData.humanoidGlbBones = bones
  parent.userData.humanoidGlbBoneRest = snapshotBoneRests(bones)
  parent.userData.humanoidGlbReady = true
  hookGlbPoseSync(parent)
}

function hookGlbPoseSync(parent) {
  if (parent.userData.humanoidGlbMatrixHooked) return
  parent.userData.humanoidGlbMatrixHooked = true
  const orig = parent.updateMatrixWorld
  parent.updateMatrixWorld = function hookHumanoidGlbMatrixWorld(force) {
    if (this.userData.humanoidGlbSyncing) {
      orig.call(this, force)
      return
    }
    this.userData.humanoidGlbSyncing = true
    tickHumanoidGlbMixer(this)
    orig.call(this, force)
    dockToolFromRaisedBone(this)
    this.userData.humanoidGlbSyncing = false
  }
}

const HUMANOID_GLB_BONE_NAMES = [
  'Hips', 'Spine', 'Chest', 'Neck', 'Head',
  'LeftShoulder', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand',
  'RightShoulder', 'RightUpperArm', 'RightLowerArm', 'RightHand',
  'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot',
  'RightUpperLeg', 'RightLowerLeg', 'RightFoot',
]

/** One prototype per character GLB; instances share its geometry and skeleton. */
const protoPromises = new Map()

export function loadHumanoidGlbPrototype(THREE, url = HUMANOID_GLB_URL) {
  if (typeof window === 'undefined') return Promise.resolve(null)
  const cached = protoPromises.get(url)
  if (cached) return cached
  const promise = Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/utils/SkeletonUtils.js'),
  ]).then(([{ GLTFLoader }, SkeletonUtils]) => (
    new GLTFLoader().loadAsync(url).then((gltf) => {
      let source = null
      gltf.scene.traverse((obj) => {
        if (obj.isSkinnedMesh && !source) source = obj
        else if (obj.isMesh && !source) source = obj
        if (!obj.isMesh) return
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const m of mats) {
          if (m?.map) prepareSharedGltfMap(THREE, m.map)
        }
      })
      if (!source?.geometry) throw new Error(`${url} has no mesh`)
      const material = source.material
      return { gltf, source, material, SkeletonUtils }
    })
  )).catch((err) => {
    protoPromises.delete(url)
    console.warn('[humanoid-glb]', err)
    return null
  })
  protoPromises.set(url, promise)
  return promise
}

/**
 * Overlay the A-pose GLB on the capsule rig. A body that ships named clips
 * (idle, walk, jumps, point, wave, salute) plays them from the live capsule
 * pose; a body that only has bones — the baked scans — is posed by copying the
 * capsule rotations onto them. Either way RJ45/USB stay in the palms.
 * `hideHead` (bosses/statues) drops the mesh skull so the portrait stays; bots
 * keep it for the RL-car. `url` picks a per-character body.
 */
export function attachHumanoidGlb(THREE, parent, {
  bulk = 1,
  hideHead = false,
  colors = {},
  sleeve = 'long',
  bodyMeshes = null,
  hands = [],
  url = HUMANOID_GLB_URL,
  /** Keep the baked albedo (per-character scans) instead of the cloth tint shader. */
  preserveMap = false,
  /** Y-split for skinned scans: neck (default) or waist for RL-car riders. */
  bodyCutY = HUMANOID_GLB_SRC_NECK_Y,
  onReady = null,
} = {}) {
  const fit = new THREE.Group()
  fit.name = 'humanoidGlbFit'
  const { scale, offsetY } = humanoidGlbFit()
  // Textured scans (preserveMap) keep uniform scale so jacket/neck UVs stay
  // coherent — bulk-width stretch was banding Putin's shoulders.
  if (preserveMap) fit.scale.setScalar(scale)
  else fit.scale.set(scale * bulk, scale, scale * bulk)
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

  loadHumanoidGlbPrototype(THREE, url).then((proto) => {
    if (!proto || !fit.parent) {
      onReady?.(null)
      parent.userData.onHumanoidGlbReady?.(parent)
      return
    }
    const clone = proto.SkeletonUtils.clone(proto.gltf.scene)
    let skinned = null
    clone.traverse((obj) => {
      if (obj.isSkinnedMesh && !skinned) skinned = obj
    })
    const mat = (preserveMap && proto.material?.map)
      ? makeTexturedMaterial(THREE, proto.material)
      : makeClothedMaterial(THREE, proto.material, colors, sleeve)
    if (skinned) {
      if (preserveMap && proto.material?.map) {
        // One continuous mesh — the neck Y-split breaks UVs on baked scans and
        // reads as a speckled white collar (Putin home rail).
        skinned.material = mat
        skinned.frustumCulled = false
        parent.userData.humanoidGlbBodyMesh = skinned
        parent.userData.humanoidGlbHeadMesh = skinned
        parent.userData.humanoidGlbHead = skinned
        const procedural = parent.userData.proceduralHeadMeshes
        if (procedural) {
          for (const mesh of procedural) mesh.visible = false
        }
      } else {
      const split = splitGeometryByY(THREE, skinned.geometry, bodyCutY)
      const bind = skinned.bindMatrix.clone()
      const skel = skinned.skeleton
      const holder = skinned.parent || clone
      const body = new THREE.SkinnedMesh(split.bodyGeo, mat)
      body.name = 'humanoidGlbBodyMesh'
      body.frustumCulled = false
      body.bind(skel, bind)
      holder.add(body)
      parent.userData.humanoidGlbBodyMesh = body
      if (!hideHead) {
        const head = new THREE.SkinnedMesh(split.headGeo, mat)
        head.name = 'humanoidGlbHeadMesh'
        head.frustumCulled = false
        head.bind(skel, bind)
        holder.add(head)
        parent.userData.humanoidGlbHead = head
        parent.userData.humanoidGlbHeadMesh = head
        const procedural = parent.userData.proceduralHeadMeshes
        if (procedural) {
          for (const mesh of procedural) mesh.visible = false
        }
      }
      skinned.removeFromParent()
      }
    } else {
      clone.traverse((obj) => {
        if (obj.isMesh) obj.material = mat
      })
    }
    bodyHold.add(clone)
    const clips = (proto.gltf.animations || []).filter((clip) => clip?.name)
    if (clips.length) {
      const mixer = new THREE.AnimationMixer(clone)
      const actions = {}
      for (const clip of clips) {
        const action = mixer.clipAction(clip)
        if (HUMANOID_GLB_HOLD_CLIPS.has(clip.name)) {
          action.setLoop(THREE.LoopOnce, 1)
          action.clampWhenFinished = true
        } else {
          action.setLoop(THREE.LoopRepeat, Infinity)
        }
        actions[clip.name] = action
      }
      parent.userData.humanoidGlbMixer = mixer
      parent.userData.humanoidGlbActions = actions
    }
    const bones = collectHumanoidBones(clone)
    const named = collectNamed(clone, HUMANOID_GLB_BONE_NAMES)
    for (const name of HUMANOID_GLB_BONE_NAMES) {
      if (!bones[name] && named[name]) bones[name] = named[name]
    }
    parent.userData.humanoidGlbBones = bones
    if (hideHead && bones.Head) bones.Head.scale.setScalar(0.001)
    if (hands[0]?.userData?.connectorNative) attachConnectorToHandBone(bones.LeftHand, hands[0], bulk)
    if (hands[1]?.userData?.connectorNative) attachConnectorToHandBone(bones.RightHand, hands[1], bulk)
    parent.userData.humanoidGlbRaisedBone = bones.RightHand || bones.LeftHand
    if (bodyMeshes) {
      for (const mesh of bodyMeshes) {
        if (mesh === bodyHold || !mesh.isMesh) continue
        if (keepProceduralHandWithGlb(mesh, hands)) continue
        mesh.userData.glbSuppressed = true
        mesh.visible = false
      }
    }
    hookGlbPoseSync(parent)
    parent.updateMatrixWorld(true)
    parent.userData.humanoidGlbReady = true
    parent.userData.humanoidGlbRaised = parent.userData.humanoidGlbRaisedBone === bones.RightHand ? 'right' : 'left'
    if (parent.userData.humanoidGlbSeated) {
      seatHumanoidGlbInCar(parent, parent.userData.humanoidGlbSeatOpts)
    }
    onReady?.(clone)
    parent.userData.onHumanoidGlbReady?.(parent)
  }).catch((err) => {
    console.warn('[humanoid-glb]', url, err)
    onReady?.(null)
    parent.userData.onHumanoidGlbReady?.(parent)
  })
  hookGlbPoseSync(parent)
  return fit
}

/** Copy capsule arm/leg pose onto the auto-rig so the scan and plugs move together. */
export function syncHumanoidGlbPose(host) {
  copyCapsulePoseToGlbBones(host)
  dockToolFromRaisedBone(host)
}

export function dockHeldItemsToGlb(parent) {
  const raised = parent?.userData?.humanoidGlbRaisedPoint
  const tool = parent?.userData?.tool
  if (!raised || !tool) return
  tool.position.set(raised.x, raised.y, raised.z)
  parent.userData.rlStandToolPos = tool.position.clone()
}

function keepGlbMountVisible(parent, part) {
  return part === parent.userData.humanoidGlbBody
    || part === parent.userData.humanoidGlbFit
    || part === parent.userData.humanoidGlbHead
    || part === parent.userData.humanoidGlbHeadMesh
    || part === parent.userData.tool
}

/** Hide legs/capsule limbs and drop the man.glb skull into a cockpit. */
export function seatHumanoidGlbInCar(parent, { neckY = 0.48, neckZ = 0 } = {}) {
  if (!parent) return
  parent.userData.humanoidGlbSeatOpts = { neckY, neckZ }
  const bodyMesh = parent.userData.humanoidGlbBodyMesh
  const body = parent.userData.humanoidGlbBody
  const fit = parent.userData.humanoidGlbFit
  const headMesh = parent.userData.humanoidGlbHeadMesh
  // Hide below-waist mesh (legs poke under the car). Keep the scanned upper
  // body — and the USB in the right hand — seated in the cabin.
  if (bodyMesh && bodyMesh !== headMesh) bodyMesh.visible = false
  if (body) body.visible = true
  if (headMesh) headMesh.visible = true
  for (const mesh of parent.userData.proceduralHeadMeshes || []) {
    mesh.visible = false
  }
  for (const arm of parent.userData.humanArms || []) arm.visible = false
  for (const leg of parent.userData.humanLegs || []) leg.visible = false
  if (parent.userData.tool) parent.userData.tool.visible = true
  for (const hand of [parent.userData.humanoidGlbLeftHand, parent.userData.humanoidGlbRightHand]) {
    if (hand) hand.visible = false
  }
  for (const part of parent.userData.bodyParts || []) {
    if (!part || keepGlbMountVisible(parent, part)) continue
    part.visible = false
  }
  if (!fit) {
    parent.userData.humanoidGlbSeated = true
    return
  }
  const { scale, offsetY } = humanoidGlbFit()
  const neckParentY = HUMANOID_GLB_SRC_NECK_Y * scale + offsetY
  fit.position.y = offsetY + (neckY - neckParentY)
  fit.position.z = neckZ
  const headLocalY = (HUMANOID_GLB_SRC_HEAD.minY + HUMANOID_GLB_SRC_HEAD.maxY) * 0.5 * scale + fit.position.y
  void headLocalY
  parent.userData.humanoidGlbSeated = true
}

/**
 * RL-car mount: hide legs/arms/capsule and peek the scanned man.glb torso+head
 * above the cockpit tub. Safe to call before the GLB finishes — re-invoke from
 * onHumanoidGlbReady when the split meshes exist. The USB staff stays visible
 * in the right hand, sticking up and out of the window.
 */
export function applyHumanoidCarMount(parent, { neckY = 0.48, neckZ = 0 } = {}) {
  if (!parent) return
  seatHumanoidGlbInCar(parent, { neckY, neckZ })
  const lower = parent.userData.humanoidGlbBodyMesh
  const upperMesh = parent.userData.humanoidGlbHeadMesh
  for (const part of [
    parent.userData.leftFoot,
    parent.userData.rightFoot,
    parent.userData.leftSole,
    parent.userData.rightSole,
    ...(parent.userData.humanLegs || []),
    ...(parent.userData.humanArms || []),
    lower && lower !== upperMesh ? lower : null,
    parent.userData.humanoidGlbLeftHand,
    parent.userData.humanoidGlbRightHand,
  ]) {
    if (part) part.visible = false
  }
  const upper = upperMesh || parent.userData.humanoidGlbHead
  if (upper) upper.visible = true
  if (parent.userData.humanoidGlbBody) parent.userData.humanoidGlbBody.visible = true
  if (parent.userData.tool) parent.userData.tool.visible = true
  for (const mesh of parent.userData.proceduralHeadMeshes || []) mesh.visible = false
}

/** Apply car mount when `when` is true (or immediately if no predicate). */
export function hookHumanoidCarMount(parent, opts, { when = null } = {}) {
  const mount = () => applyHumanoidCarMount(parent, opts)
  if (!when || when(parent)) mount()
  const prev = parent.userData.onHumanoidGlbReady
  parent.userData.onHumanoidGlbReady = (host) => {
    prev?.(host)
    if (!when || when(host)) mount()
  }
}

export function unseatHumanoidGlb(parent) {
  if (!parent) return
  const bodyMesh = parent.userData.humanoidGlbBodyMesh
  const body = parent.userData.humanoidGlbBody
  const fit = parent.userData.humanoidGlbFit
  if (bodyMesh) bodyMesh.visible = true
  if (body) body.visible = true
  for (const arm of parent.userData.humanArms || []) arm.visible = true
  for (const leg of parent.userData.humanLegs || []) leg.visible = true
  if (parent.userData.tool) parent.userData.tool.visible = true
  for (const hand of [parent.userData.humanoidGlbLeftHand, parent.userData.humanoidGlbRightHand]) {
    if (hand) hand.visible = true
  }
  if (fit) {
    fit.position.y = parent.userData.humanoidGlbRestY ?? fit.position.y
    fit.position.z = parent.userData.humanoidGlbRestZ ?? 0
  }
  parent.userData.humanoidGlbSeated = false
}
