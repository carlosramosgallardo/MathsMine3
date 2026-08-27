import { humanoidGlbFit, loadHumanoidGlbPrototype, makeStatueDisplayMaterial, makeVividAlbedoMaterial, HUMANOID_GLB_YAW, HUMANOID_GLB_CROWN_Y } from './humanoid-glb'

function attachVertexColoredGlb(THREE, parent, {
  url,
  fitName = 'vertexSculptFit',
  tint = null,
  fitFn = () => humanoidGlbFit(),
  tagQuadruped = false,
  logTag = 'vertex-sculpt-glb',
  onReady = null,
} = {}) {
  const fit = new THREE.Group()
  fit.name = fitName
  const { scale, offsetY } = fitFn()
  fit.scale.setScalar(scale)
  fit.position.y = offsetY
  fit.rotation.y = HUMANOID_GLB_YAW
  parent.add(fit)
  if (tagQuadruped) {
    parent.userData.quadruped = true
    parent.userData.quadrupedGlbFit = fit
  }

  loadHumanoidGlbPrototype(THREE, url).then((proto) => {
    if (!proto || !fit.parent) {
      onReady?.(null)
      return
    }
    const clone = proto.SkeletonUtils.clone(proto.gltf.scene)
    const meshes = []
    clone.traverse((obj) => {
      if (!obj.isMesh) return
      obj.material = makeVividAlbedoMaterial(THREE, {
        map: obj.material?.map || null,
        color: tint || 0xffffff,
        vertexColors: true,
      })
      if (tint) obj.material.color?.set(tint)
      obj.frustumCulled = false
      meshes.push(obj)
    })
    fit.add(clone)
    if (tagQuadruped) {
      parent.userData.quadrupedGlbMeshes = meshes
      parent.userData.quadrupedGlbReady = true
    }
    onReady?.(clone)
  }).catch((err) => {
    console.warn(`[${logTag}]`, url, err)
    onReady?.(null)
  })
  return fit
}

/**
 * Mount a rigid sculpt GLB (vertex-coloured, no skeleton) as a character body.
 *
 * Sculpts are baked to the same source height as the humanoid scan, so they
 * reuse `humanoidGlbFit()` and land with their feet on the parent's origin,
 * facing +Z at yaw 0 like every other body. There is nothing to skin: the whole
 * body is posed by lib/quadruped-motion.js from the parent pivot.
 */
export function attachQuadrupedGlb(THREE, parent, { url, tint = null, onReady = null, fitFn = null } = {}) {
  return attachVertexColoredGlb(THREE, parent, {
    url,
    fitName: 'quadrupedGlbFit',
    tint,
    tagQuadruped: true,
    logTag: 'quadruped-glb',
    fitFn: fitFn || (() => humanoidGlbFit()),
    onReady,
  })
}

/** Shared loader for vertex-coloured props (e.g. Milei plinth extract). */
export { attachVertexColoredGlb }

/** World AABB of verts whose Y sits in [yMin, yMax] (inclusive). */
function worldBoxYBand(THREE, root, yMin, yMax) {
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  let hits = 0
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry?.getAttribute) return
    const pos = obj.geometry.getAttribute('position')
    if (!pos) return
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld)
      if (v.y < yMin || v.y > yMax) continue
      box.expandByPoint(v)
      hits += 1
    }
  })
  return hits ? box : null
}

/**
 * Mount a multi-material textured statue prop (bake-prop-glb output). Fits the
 * AABB to the humanoid crown height with feet on y=0 — unlike sculpts, these
 * downloads are not pre-normalised.
 */
export function attachTexturedStatueGlb(THREE, parent, {
  url,
  targetHeight = HUMANOID_GLB_CROWN_Y,
  yaw = HUMANOID_GLB_YAW,
  onReady = null,
} = {}) {
  const fit = new THREE.Group()
  fit.name = 'statueGlbFit'
  parent.add(fit)
  parent.userData.statueGlbFit = fit

  loadHumanoidGlbPrototype(THREE, url).then((proto) => {
    if (!proto || !fit.parent) {
      onReady?.(null)
      return
    }
    // Props are rigid after bake-prop (skins already applied). SkeletonUtils is
    // for skinned scans — on multi-mesh RPM avatars it can drop transforms and
    // leave an empty pedestal with floating eye sprites.
    let clone
    try {
      clone = proto.gltf.scene.clone(true)
    } catch (err) {
      console.warn('[statue-glb] scene.clone failed', url, err)
      onReady?.(null)
      return
    }
    const meshes = []
    clone.traverse((obj) => {
      if (!obj.isMesh) return
      const src = obj.material
      const srcList = Array.isArray(src) ? src : [src]
      const next = []
      for (const sm of srcList) {
        if (!sm) continue
        const mat = makeStatueDisplayMaterial(THREE, sm, { side: THREE.DoubleSide })
        if (sm.map && !mat.map) {
          console.warn('[statue-glb] lost albedo map', url, obj.name, sm.name)
        }
        next.push(mat)
      }
      if (!next.length) return
      obj.material = next.length === 1 ? next[0] : next
      obj.visible = true
      obj.frustumCulled = false
      meshes.push(obj)
    })
    if (!meshes.length) {
      console.warn('[statue-glb] no meshes', url)
      onReady?.(null)
      return
    }
    fit.add(clone)
    // Measure while the fit group is isolated so parent pedestal/π yaw do not
    // contaminate the AABB. Yaw first, then plant: height from the full mesh,
    // XZ from the feet so a waving arm does not shove Zelensky/Macron off the
    // column deck.
    const holder = fit.parent
    if (holder) holder.remove(fit)
    fit.position.set(0, 0, 0)
    fit.scale.set(1, 1, 1)
    fit.rotation.set(0, yaw, 0)
    fit.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(fit)
    const size = box.getSize(new THREE.Vector3())
    if (!(size.y > 0.01)) {
      console.warn('[statue-glb] empty bounds', url, size)
      if (holder) holder.add(fit)
      onReady?.(null)
      return
    }
    const feet = worldBoxYBand(THREE, fit, box.min.y, box.min.y + size.y * 0.14)
    const cx = feet ? (feet.min.x + feet.max.x) * 0.5 : (box.min.x + box.max.x) * 0.5
    const cz = feet ? (feet.min.z + feet.max.z) * 0.5 : (box.min.z + box.max.z) * 0.5
    const scale = targetHeight / size.y
    fit.scale.setScalar(scale)
    fit.position.set(-cx * scale, -box.min.y * scale, -cz * scale)
    if (holder) holder.add(fit)
    parent.userData.quadrupedGlbMeshes = meshes
    parent.userData.statueGlbReady = true
    onReady?.(clone)
  }).catch((err) => {
    console.warn('[statue-glb]', url, err)
    onReady?.(null)
  })
  return fit
}

/** Emissive flash on every sculpt / textured-statue mesh. */
export function setQuadrupedFlash(parent, color, strength) {
  const meshes = parent?.userData?.quadrupedGlbMeshes
  if (!meshes) return
  for (const mesh of meshes) {
    if (!mesh.material?.emissive) continue
    mesh.material.emissive.set(color)
    mesh.material.emissiveIntensity = strength
  }
}
