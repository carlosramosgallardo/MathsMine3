/**
 * Shared triangle-majority geometry carve for rigid limb shells
 * (crawl quadruped + standing biped). Keeps clothing from stretching.
 */

/** Pick a non-torso part when at least two verts agree. */
export function majorityLimbPart(ca, cb, cc) {
  if (ca === cb && cb === cc && ca !== 'torso') return ca
  if (ca === cb && ca !== 'torso') return ca
  if (cb === cc && cb !== 'torso') return cb
  if (ca === cc && ca !== 'torso') return ca
  return 'torso'
}

/**
 * Split a BufferGeometry into named parts.
 * @param {object} opts
 * @param {string[]} opts.partIds
 * @param {(x:number,y:number,z:number)=>string} opts.classify
 * @param {boolean} [opts.withColor]
 * @param {boolean} [opts.withUv]
 */
export function splitRigidLimbGeometry(THREE, geometry, {
  partIds,
  classify,
  withColor = false,
  withUv = false,
} = {}) {
  const pos = geometry?.attributes?.position
  if (!pos || !THREE || !partIds?.length || !classify) return null
  const idx = geometry.index
  const triCount = idx ? idx.count / 3 : pos.count / 3
  const nor = geometry.attributes.normal
  const col = withColor ? geometry.attributes.color : null
  const uv = withUv ? geometry.attributes.uv : null
  const uv2 = withUv ? geometry.attributes.uv2 : null

  const buckets = Object.fromEntries(partIds.map((id) => [id, {
    pos: [], nor: [], col: [], uv: [], uv2: [], idx: [], map: new Map(),
  }]))

  const vertClass = new Array(pos.count)
  for (let i = 0; i < pos.count; i += 1) {
    vertClass[i] = classify(pos.getX(i), pos.getY(i), pos.getZ(i))
  }

  const pushVert = (bucket, vi) => {
    if (bucket.map.has(vi)) return bucket.map.get(vi)
    const ni = bucket.pos.length / 3
    bucket.map.set(vi, ni)
    bucket.pos.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi))
    if (nor) bucket.nor.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi))
    else bucket.nor.push(0, 1, 0)
    if (col) bucket.col.push(col.getX(vi), col.getY(vi), col.getZ(vi))
    else if (withColor) bucket.col.push(1, 1, 1)
    if (uv) bucket.uv.push(uv.getX(vi), uv.getY(vi))
    if (uv2) bucket.uv2.push(uv2.getX(vi), uv2.getY(vi))
    return ni
  }

  for (let t = 0; t < triCount; t += 1) {
    const a = idx ? idx.getX(t * 3) : t * 3
    const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
    const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
    const part = majorityLimbPart(vertClass[a], vertClass[b], vertClass[c])
    const bucket = buckets[part] || buckets.torso
    bucket.idx.push(pushVert(bucket, a), pushVert(bucket, b), pushVert(bucket, c))
  }

  const out = {}
  for (const id of partIds) {
    const b = buckets[id]
    if (!b.idx.length) {
      out[id] = null
      continue
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3))
    if (withColor) geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3))
    if (uv && b.uv.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2))
    if (uv2 && b.uv2.length) geo.setAttribute('uv2', new THREE.Float32BufferAttribute(b.uv2, 2))
    geo.setIndex(b.idx)
    geo.computeBoundingSphere()
    out[id] = geo
  }
  return out
}

/** Bake mesh verts into `parent` local space (positions + normals). */
export function bakeMeshIntoParent(THREE, parent, mesh) {
  const geo = mesh.geometry.clone()
  parent.updateMatrixWorld(true)
  mesh.updateMatrixWorld(true)
  const baked = new THREE.Matrix4().multiplyMatrices(
    new THREE.Matrix4().copy(parent.matrixWorld).invert(),
    mesh.matrixWorld,
  )
  applyMatrixToGeometry(THREE, geo, baked)
  return geo
}

/** Transform geometry from `fromParent` local into `toParent` local. */
export function reparentGeometry(THREE, geometry, fromParent, toParent) {
  fromParent.updateMatrixWorld(true)
  toParent.updateMatrixWorld(true)
  const xform = new THREE.Matrix4().multiplyMatrices(
    new THREE.Matrix4().copy(toParent.matrixWorld).invert(),
    fromParent.matrixWorld,
  )
  applyMatrixToGeometry(THREE, geometry, xform)
  geometry.computeBoundingSphere()
}

function applyMatrixToGeometry(THREE, geometry, matrix) {
  const pos = geometry.attributes.position
  const nor = geometry.attributes.normal
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(matrix)
    pos.setXYZ(i, v.x, v.y, v.z)
    if (nor) {
      n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize()
      nor.setXYZ(i, n.x, n.y, n.z)
    }
  }
  pos.needsUpdate = true
  if (nor) nor.needsUpdate = true
}
