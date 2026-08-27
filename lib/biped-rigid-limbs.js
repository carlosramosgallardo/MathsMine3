/**
 * Rigid biped limb shells for textured GLBs with no skeleton (Putin / Kim).
 *
 * Capsule drivers already swing arms/legs; the suit mesh stays A-pose unless we
 * carve it into torso + four rigid shells and parent those shells to the
 * capsules. Clothing never stretches — each piece rotates as a solid.
 */

export const BIPED_LIMB_IDS = Object.freeze(['la', 'ra', 'll', 'rl'])

/** Planted fit-local thresholds for putin.glb (feet y=0, crown ≈ 1.075). */
export const PUTIN_BIPED_PROFILE = Object.freeze({
  torsoY: 0.78,
  armLo: 0.38,
  armHi: 0.95,
  armX: 0.17,
  legHi: 0.50,
  legX: 0.045,
})

export function classifyStandingBipedVertex(x, y, z, profile = PUTIN_BIPED_PROFILE) {
  void z
  if (y > profile.torsoY) return 'torso'
  if (y > profile.armLo && y < profile.armHi && Math.abs(x) > profile.armX) {
    return x < 0 ? 'la' : 'ra'
  }
  if (y < profile.legHi && Math.abs(x) > profile.legX) {
    return x < 0 ? 'll' : 'rl'
  }
  return 'torso'
}

/**
 * Split a BufferGeometry by triangle majority vote.
 * Preserves position, normal, and uv/uv2 when present (textured props).
 */
export function splitBipedGeometry(THREE, geometry, classifyFn = classifyStandingBipedVertex) {
  const pos = geometry?.attributes?.position
  if (!pos || !THREE) return null
  const idx = geometry.index
  const triCount = idx ? idx.count / 3 : pos.count / 3
  const nor = geometry.attributes.normal
  const uv = geometry.attributes.uv
  const uv2 = geometry.attributes.uv2
  const ids = ['torso', ...BIPED_LIMB_IDS]
  const buckets = Object.fromEntries(ids.map((id) => [id, {
    pos: [], nor: [], uv: [], uv2: [], idx: [], map: new Map(),
  }]))

  const vertClass = new Array(pos.count)
  for (let i = 0; i < pos.count; i += 1) {
    vertClass[i] = classifyFn(pos.getX(i), pos.getY(i), pos.getZ(i))
  }

  const pushVert = (bucket, vi) => {
    if (bucket.map.has(vi)) return bucket.map.get(vi)
    const ni = bucket.pos.length / 3
    bucket.map.set(vi, ni)
    bucket.pos.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi))
    if (nor) bucket.nor.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi))
    else bucket.nor.push(0, 1, 0)
    if (uv) bucket.uv.push(uv.getX(vi), uv.getY(vi))
    if (uv2) bucket.uv2.push(uv2.getX(vi), uv2.getY(vi))
    return ni
  }

  for (let t = 0; t < triCount; t += 1) {
    const a = idx ? idx.getX(t * 3) : t * 3
    const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
    const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
    const ca = vertClass[a]
    const cb = vertClass[b]
    const cc = vertClass[c]
    let part = 'torso'
    if (ca === cb && cb === cc && ca !== 'torso') part = ca
    else if (ca === cb && ca !== 'torso') part = ca
    else if (cb === cc && cb !== 'torso') part = cb
    else if (ca === cc && ca !== 'torso') part = ca
    const bucket = buckets[part]
    bucket.idx.push(pushVert(bucket, a), pushVert(bucket, b), pushVert(bucket, c))
  }

  const out = {}
  for (const id of ids) {
    const b = buckets[id]
    if (!b.idx.length) {
      out[id] = null
      continue
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3))
    if (uv && b.uv.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2))
    if (uv2 && b.uv2.length) geo.setAttribute('uv2', new THREE.Float32BufferAttribute(b.uv2, 2))
    geo.setIndex(b.idx)
    geo.computeBoundingSphere()
    out[id] = geo
  }
  return out
}

function bakeMeshPositionsInto(parent, mesh, THREE) {
  const geo = mesh.geometry.clone()
  const pos = geo.attributes.position
  parent.updateMatrixWorld(true)
  mesh.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert()
  const baked = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld)
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  const nor = geo.attributes.normal
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(baked)
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(baked)
    pos.setXYZ(i, v.x, v.y, v.z)
    if (nor) {
      n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize()
      nor.setXYZ(i, n.x, n.y, n.z)
    }
  }
  pos.needsUpdate = true
  if (nor) nor.needsUpdate = true
  return geo
}

function reparentGeometryLocal(THREE, geometry, fromParent, toParent) {
  fromParent.updateMatrixWorld(true)
  toParent.updateMatrixWorld(true)
  const invTo = new THREE.Matrix4().copy(toParent.matrixWorld).invert()
  const xform = new THREE.Matrix4().multiplyMatrices(invTo, fromParent.matrixWorld)
  const pos = geometry.attributes.position
  const nor = geometry.attributes.normal
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(xform)
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(xform)
    pos.setXYZ(i, v.x, v.y, v.z)
    if (nor) {
      n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize()
      nor.setXYZ(i, n.x, n.y, n.z)
    }
  }
  pos.needsUpdate = true
  if (nor) nor.needsUpdate = true
  geometry.computeBoundingSphere()
}

/**
 * Carve every textured mesh under `statueGlbFit` into torso + limb shells and
 * parent limb shells to the invisible capsule arm/leg pivots.
 */
export function mountBipedLimbsOnCapsules(THREE, bodyPivot, {
  profile = PUTIN_BIPED_PROFILE,
  classify = null,
} = {}) {
  if (!THREE || !bodyPivot) return null
  const fit = bodyPivot.userData.statueGlbFit
  const arms = bodyPivot.userData.humanArms
  const legs = bodyPivot.userData.humanLegs
  if (!fit || !arms?.[0] || !arms?.[1] || !legs?.[0] || !legs?.[1]) return null
  if (bodyPivot.userData.bipedLimbsMounted) return bodyPivot.userData.bipedLimbs

  const classifyFn = classify || ((x, y, z) => classifyStandingBipedVertex(x, y, z, profile))
  const targets = {
    torso: fit,
    la: arms[0],
    ra: arms[1],
    ll: legs[0],
    rl: legs[1],
  }

  const sourceMeshes = []
  fit.traverse((obj) => {
    if (obj.isMesh && obj.geometry) sourceMeshes.push(obj)
  })
  if (!sourceMeshes.length) return null

  const mounted = { torso: [], la: [], ra: [], ll: [], rl: [] }
  bodyPivot.updateMatrixWorld(true)

  for (const mesh of sourceMeshes) {
    const baked = bakeMeshPositionsInto(bodyPivot, mesh, THREE)
    const parts = splitBipedGeometry(THREE, baked, classifyFn)
    baked.dispose()
    if (!parts) continue
    mesh.visible = false

    for (const id of ['torso', ...BIPED_LIMB_IDS]) {
      const geo = parts[id]
      if (!geo) continue
      const host = targets[id]
      if (id !== 'torso') reparentGeometryLocal(THREE, geo, bodyPivot, host)
      const shell = new THREE.Mesh(geo, mesh.material)
      shell.name = `biped_${id}_${mesh.name || 'mesh'}`
      shell.frustumCulled = false
      shell.castShadow = mesh.castShadow
      shell.receiveShadow = mesh.receiveShadow
      shell.renderOrder = mesh.renderOrder
      host.add(shell)
      mounted[id].push(shell)
    }
  }

  bodyPivot.userData.bipedLimbs = mounted
  bodyPivot.userData.bipedLimbsMounted = true
  // Keep flash helpers pointing at visible shells.
  const flashMeshes = []
  for (const id of ['torso', ...BIPED_LIMB_IDS]) flashMeshes.push(...mounted[id])
  bodyPivot.userData.quadrupedGlbMeshes = flashMeshes
  return mounted
}
