/** Shared auto-rigged full-body scan used by bots, bosses and statues. */
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
export const HUMANOID_GLB_SRC_HAND_RADIUS = 0.055

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

function attachConnectorToHandBone(bone, connector, bulk) {
  if (!bone || !connector) return
  bone.add(connector)
  // Plug insertion is −Y; rest bones are identity so −Y hangs down the
  // forearm and swings forward (parent −Z) when the upper arm pitches.
  connector.position.set(0, -HUMANOID_GLB_SRC_HAND_RADIUS * 0.55, 0)
  connector.rotation.set(0, 0, 0)
  const native = connector.userData.connectorNative
  if (!native) return
  const palm = HUMANOID_GLB_SRC_HAND_RADIUS
  const b = Number.isFinite(bulk) && bulk > 0 ? bulk : 1
  connector.scale.set(palm / native, (palm * b) / native, palm / native)
}

function applyLimb(bone, capsule) {
  if (!bone || !capsule) return
  const pose = glbLimbFromCapsule(capsule.rotation, capsule.userData.baseRotZ || 0)
  bone.rotation.x = pose.x
  bone.rotation.z = pose.z
}

function copyCapsulePoseToGlbBones(host) {
  const bones = host?.userData?.humanoidGlbBones
  if (!bones) return
  const [lArm, rArm] = host.userData.humanArms || []
  const [lLeg, rLeg] = host.userData.humanLegs || []
  applyLimb(bones.LeftUpperArm, lArm)
  applyLimb(bones.RightUpperArm, rArm)
  applyLimb(bones.LeftUpperLeg, lLeg)
  applyLimb(bones.RightUpperLeg, rLeg)
}

function dockToolFromRaisedBone(host) {
  const tool = host?.userData?.tool
  const raised = host?.userData?.humanoidGlbRaisedBone
  if (!tool || !raised?.matrixWorld) return
  const tmp = host.userData.humanoidGlbTmpV3 || (host.userData.humanoidGlbTmpV3 = raised.position.clone())
  tmp.setFromMatrixPosition(raised.matrixWorld)
  host.worldToLocal(tmp)
  tool.position.copy(tmp)
  tool.updateMatrix()
  if (tool.updateWorldMatrix) tool.updateWorldMatrix(false, true)
  host.userData.humanoidGlbRaisedPoint = tool.position.clone()
  host.userData.rlStandToolPos = tool.position.clone()
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
    copyCapsulePoseToGlbBones(this)
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

let protoPromise = null

export function loadHumanoidGlbPrototype(THREE) {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (!protoPromise) {
    protoPromise = Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/utils/SkeletonUtils.js'),
    ]).then(([{ GLTFLoader }, SkeletonUtils]) => (
      new GLTFLoader().loadAsync(HUMANOID_GLB_URL).then((gltf) => {
        let source = null
        gltf.scene.traverse((obj) => {
          if (obj.isSkinnedMesh && !source) source = obj
          else if (obj.isMesh && !source) source = obj
        })
        if (!source?.geometry) throw new Error('man.glb has no mesh')
        const material = source.material
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace
          material.map.anisotropy = 8
        }
        return { gltf, source, material, SkeletonUtils }
      })
    )).catch((err) => {
      protoPromise = null
      console.warn('[humanoid-glb]', err)
      return null
    })
  }
  return protoPromise
}

/**
 * Overlay the auto-rigged scan on the capsule animation rig. Limb/head
 * bones follow the capsule pose so RJ45/USB stay in the palms and the plug
 * points forward when a boss aims at the player. `hideHead` (bosses/statues)
 * drops the scanned skull so the portrait stays; bots keep it for the RL-car.
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

  loadHumanoidGlbPrototype(THREE).then((proto) => {
    if (!proto || !fit.parent) return
    const clone = proto.SkeletonUtils.clone(proto.gltf.scene)
    let skinned = null
    clone.traverse((obj) => {
      if (obj.isSkinnedMesh && !skinned) skinned = obj
    })
    const mat = makeClothedMaterial(THREE, proto.material, colors, sleeve)
    if (skinned) {
      const split = splitGeometryByY(THREE, skinned.geometry, HUMANOID_GLB_SRC_NECK_Y)
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
    } else {
      clone.traverse((obj) => {
        if (obj.isMesh) obj.material = mat
      })
    }
    bodyHold.add(clone)
    const bones = collectNamed(clone, HUMANOID_GLB_BONE_NAMES)
    parent.userData.humanoidGlbBones = bones
    if (hideHead && bones.Head) bones.Head.scale.setScalar(0.001)
    if (hands[0]?.userData?.connectorNative) attachConnectorToHandBone(bones.LeftHand, hands[0], bulk)
    if (hands[1]?.userData?.connectorNative) attachConnectorToHandBone(bones.RightHand, hands[1], bulk)
    parent.userData.humanoidGlbRaisedBone = bones.LeftHand || bones.RightHand
    if (bodyMeshes) {
      for (const mesh of bodyMeshes) {
        if (mesh === bodyHold || !mesh.isMesh) continue
        if (hands.some((hand) => isUnder(mesh, hand))) continue
        mesh.userData.glbSuppressed = true
        mesh.visible = false
      }
    }
    hookGlbPoseSync(parent)
    parent.updateMatrixWorld(true)
    parent.userData.humanoidGlbReady = true
    parent.userData.humanoidGlbRaised = parent.userData.humanoidGlbRaisedBone === bones.LeftHand ? 'left' : 'right'
    if (parent.userData.humanoidGlbSeated) {
      seatHumanoidGlbInCar(parent, parent.userData.humanoidGlbSeatOpts)
    }
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

/** Hide the scanned torso/limbs and drop the skull into a cockpit. */
export function seatHumanoidGlbInCar(parent, { neckY = 0.48, neckZ = 0 } = {}) {
  if (!parent) return
  parent.userData.humanoidGlbSeatOpts = { neckY, neckZ }
  const bodyMesh = parent.userData.humanoidGlbBodyMesh
  const body = parent.userData.humanoidGlbBody
  const fit = parent.userData.humanoidGlbFit
  if (bodyMesh) bodyMesh.visible = false
  else if (body) body.visible = false
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
