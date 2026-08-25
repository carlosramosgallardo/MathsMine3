import { humanoidGlbFit, loadHumanoidGlbPrototype, makeTexturedMaterial, makeVividAlbedoMaterial, HUMANOID_GLB_YAW, HUMANOID_GLB_CROWN_Y } from './humanoid-glb'

/**
 * Mount a rigid sculpt GLB (vertex-coloured, no skeleton) as a character body.
 *
 * Sculpts are baked to the same source height as the humanoid scan, so they
 * reuse `humanoidGlbFit()` and land with their feet on the parent's origin,
 * facing +Z at yaw 0 like every other body. There is nothing to skin: the whole
 * body is posed by lib/quadruped-motion.js from the parent pivot.
 */
export function attachQuadrupedGlb(THREE, parent, { url, tint = null, onReady = null } = {}) {
  const fit = new THREE.Group()
  fit.name = 'quadrupedGlbFit'
  const { scale, offsetY } = humanoidGlbFit()
  fit.scale.setScalar(scale)
  fit.position.y = offsetY
  fit.rotation.y = HUMANOID_GLB_YAW
  parent.add(fit)
  parent.userData.quadruped = true
  parent.userData.quadrupedGlbFit = fit

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
    parent.userData.quadrupedGlbMeshes = meshes
    parent.userData.quadrupedGlbReady = true
    onReady?.(clone)
  }).catch((err) => {
    console.warn('[quadruped-glb]', url, err)
    onReady?.(null)
  })
  return fit
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
        next.push(makeTexturedMaterial(THREE, sm, { side: THREE.DoubleSide }))
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
    // contaminate the AABB; apply facing yaw before measuring so plant offsets
    // keep the figure centered on the plinth (Kim/Macron/Zelensky).
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
    const scale = targetHeight / size.y
    fit.scale.setScalar(scale)
    fit.position.set(
      -(box.min.x + box.max.x) * 0.5 * scale,
      -box.min.y * scale,
      -(box.min.z + box.max.z) * 0.5 * scale,
    )
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
