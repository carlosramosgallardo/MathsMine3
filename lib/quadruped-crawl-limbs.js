/**
 * Rigid limb split for the fused Trump/Bibi crawl sculpt.
 *
 * The GLB has no skeleton — clothing must not stretch — so we carve the mesh
 * into a torso shell + four limb shells and swing those as rigid pivots.
 * Classification is in source mesh space (before the π plant yaw).
 */
export const TRUMP_CRAWL_LIMB_IDS = Object.freeze(['fl', 'fr', 'rl', 'rr'])

/**
 * Source-space regions for hands/knees on the crawl pose (trump.glb AABB
 * ≈ y 0…1.9, z −0.96…0.96; hands near z≈+0.6, shoes near z≈−0.68).
 */
export function classifyTrumpCrawlVertex(x, y, z) {
  // Bibi + Trump torso/head/chest stay rigid — clothing never stretches.
  if (y > 0.58) return 'torso'
  // Front hands / forearms (crawl head toward +Z); keep centre chest on torso.
  if (z > 0.28 && y < 0.58 && Math.abs(x) > 0.08) return x < 0 ? 'fl' : 'fr'
  // Rear knees / calves / shoes (−Z).
  if (z < -0.08 && y < 0.58 && Math.abs(x) > 0.05) return x < 0 ? 'rl' : 'rr'
  return 'torso'
}

/**
 * Joint anchors in source space — shoulders ahead, hips aft.
 * Sampled from dense clusters on the baked trump.glb crawl.
 */
export const TRUMP_CRAWL_JOINTS = Object.freeze({
  fl: Object.freeze({ x: -0.22, y: 0.52, z: 0.32 }),
  fr: Object.freeze({ x: 0.22, y: 0.52, z: 0.32 }),
  rl: Object.freeze({ x: -0.18, y: 0.48, z: -0.06 }),
  rr: Object.freeze({ x: 0.18, y: 0.48, z: -0.06 }),
})

/**
 * Split one BufferGeometry into torso + limb geometries (triangle majority vote).
 * Returns `{ torso, fl, fr, rl, rr }` BufferGeometries (may be null if empty).
 */
export function splitTrumpCrawlGeometry(THREE, geometry) {
  const pos = geometry?.attributes?.position
  if (!pos || !THREE) return null
  const idx = geometry.index
  const triCount = idx ? idx.count / 3 : pos.count / 3
  const buckets = {
    torso: { pos: [], nor: [], col: [], idx: [], map: new Map() },
    fl: { pos: [], nor: [], col: [], idx: [], map: new Map() },
    fr: { pos: [], nor: [], col: [], idx: [], map: new Map() },
    rl: { pos: [], nor: [], col: [], idx: [], map: new Map() },
    rr: { pos: [], nor: [], col: [], idx: [], map: new Map() },
  }
  const nor = geometry.attributes.normal
  const col = geometry.attributes.color

  const vertClass = new Array(pos.count)
  for (let i = 0; i < pos.count; i += 1) {
    vertClass[i] = classifyTrumpCrawlVertex(pos.getX(i), pos.getY(i), pos.getZ(i))
  }

  const pushVert = (bucket, vi) => {
    if (bucket.map.has(vi)) return bucket.map.get(vi)
    const ni = bucket.pos.length / 3
    bucket.map.set(vi, ni)
    bucket.pos.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi))
    if (nor) bucket.nor.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi))
    else bucket.nor.push(0, 1, 0)
    if (col) bucket.col.push(col.getX(vi), col.getY(vi), col.getZ(vi))
    else bucket.col.push(1, 1, 1)
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
  for (const id of ['torso', ...TRUMP_CRAWL_LIMB_IDS]) {
    const b = buckets[id]
    if (!b.idx.length) {
      out[id] = null
      continue
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3))
    geo.setIndex(b.idx)
    geo.computeBoundingSphere()
    out[id] = geo
  }
  return out
}

/**
 * Replace a single crawl mesh under `fit` with torso + four limb pivots.
 * Stores `fit.parent.userData.quadrupedLimbs` for the gait driver.
 */
export function mountTrumpCrawlLimbs(THREE, fit, sourceMesh) {
  if (!THREE || !fit || !sourceMesh?.geometry) return null
  const parts = splitTrumpCrawlGeometry(THREE, sourceMesh.geometry)
  if (!parts?.torso) return null

  const mat = sourceMesh.material
  const parent = fit
  // Drop the fused mesh; rebuild as rigid shells.
  sourceMesh.removeFromParent()
  sourceMesh.geometry.dispose()

  const torso = new THREE.Mesh(parts.torso, mat)
  torso.name = 'trumpCrawlTorso'
  torso.frustumCulled = false
  torso.castShadow = sourceMesh.castShadow
  parent.add(torso)

  const limbs = {}
  for (const id of TRUMP_CRAWL_LIMB_IDS) {
    const geo = parts[id]
    if (!geo) continue
    const joint = TRUMP_CRAWL_JOINTS[id]
    const pivot = new THREE.Group()
    pivot.name = `trumpCrawl_${id}`
    pivot.position.set(joint.x, joint.y, joint.z)
    // Shift verts into pivot-local space so rotations hinge at the joint.
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i += 1) {
      pos.setXYZ(i, pos.getX(i) - joint.x, pos.getY(i) - joint.y, pos.getZ(i) - joint.z)
    }
    pos.needsUpdate = true
    geo.computeBoundingSphere()
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = `trumpCrawlLimb_${id}`
    mesh.frustumCulled = false
    pivot.add(mesh)
    parent.add(pivot)
    limbs[id] = pivot
  }

  const host = fit.parent
  if (host) {
    host.userData.quadrupedLimbs = limbs
    host.userData.quadrupedLimbFit = fit
  }
  return limbs
}

/**
 * Contralateral crawl cycle: FL↔RR, FR↔RL. Rigid shells only — no skinning.
 * `amp` is peak shoulder/hip pitch (rad) at full gait gain.
 */
export function quadrupedLimbPose({ time = 0, moving = 0, attackT = null } = {}, amp = 0.55) {
  const gain = Math.min(1, Math.max(0, Number(moving) || 0))
  const gait = (Number(time) || 0) * 6.4
  const swing = amp * gain
  let fl = Math.sin(gait) * swing
  let fr = Math.sin(gait + Math.PI) * swing
  let rl = Math.sin(gait + Math.PI) * swing
  let rr = Math.sin(gait) * swing
  // Mild lift on the advancing side so feet clear the ground.
  const lift = 0.12 * gain
  const flY = Math.max(0, Math.sin(gait)) * lift
  const frY = Math.max(0, Math.sin(gait + Math.PI)) * lift
  const rlY = Math.max(0, Math.sin(gait + Math.PI)) * lift
  const rrY = Math.max(0, Math.sin(gait)) * lift

  if (Number.isFinite(attackT)) {
    const at = Math.min(1, Math.max(0, attackT))
    const rear = at < 0.42 ? (at / 0.42) : Math.max(0, 1 - (at - 0.42) / 0.35)
    // Plant front limbs, tuck rear while rearing.
    fl *= 1 - rear * 0.7
    fr *= 1 - rear * 0.7
    rl -= rear * 0.45
    rr -= rear * 0.45
  }

  return {
    fl: { pitch: fl, y: flY },
    fr: { pitch: fr, y: frY },
    rl: { pitch: rl, y: rlY },
    rr: { pitch: rr, y: rrY },
  }
}

/** Write limb pose onto pivots stored on the body host (`userData.quadrupedLimbs`). */
export function applyQuadrupedLimbPose(host, pose) {
  const limbs = host?.userData?.quadrupedLimbs
  if (!limbs || !pose) return
  for (const id of TRUMP_CRAWL_LIMB_IDS) {
    const pivot = limbs[id]
    const p = pose[id]
    if (!pivot || !p) continue
    pivot.rotation.x = p.pitch
    if (Number.isFinite(p.y)) pivot.position.y = TRUMP_CRAWL_JOINTS[id].y + p.y
  }
}
