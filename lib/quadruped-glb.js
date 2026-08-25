import { humanoidGlbFit, loadHumanoidGlbPrototype, HUMANOID_GLB_YAW } from './humanoid-glb'

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
    if (!proto || !fit.parent) return
    const clone = proto.SkeletonUtils.clone(proto.gltf.scene)
    const meshes = []
    clone.traverse((obj) => {
      if (!obj.isMesh) return
      // Clone per instance: hit flashes write emissive on these materials.
      obj.material = obj.material.clone()
      obj.material.vertexColors = true
      if (tint) obj.material.color?.set(tint)
      obj.frustumCulled = false
      meshes.push(obj)
    })
    fit.add(clone)
    parent.userData.quadrupedGlbMeshes = meshes
    parent.userData.quadrupedGlbReady = true
    onReady?.(clone)
  })
  return fit
}

/** Emissive flash on every sculpt mesh — the sculpt has no separate skin/cloth. */
export function setQuadrupedFlash(parent, color, strength) {
  const meshes = parent?.userData?.quadrupedGlbMeshes
  if (!meshes) return
  for (const mesh of meshes) {
    if (!mesh.material?.emissive) continue
    mesh.material.emissive.set(color)
    mesh.material.emissiveIntensity = strength
  }
}
