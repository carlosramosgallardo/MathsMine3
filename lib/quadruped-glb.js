import { humanoidGlbFit, loadHumanoidGlbPrototype, HUMANOID_GLB_YAW, HUMANOID_GLB_SRC_YMAX } from './humanoid-glb'

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
      // Sketchfab sculpts bake dark vertex paint; keep the albedo white so
      // COLOR_0 is the only tint, and drop metal so cloth/skin read as paint.
      obj.material.color?.setHex(0xffffff)
      if ('metalness' in obj.material) obj.material.metalness = 0
      if ('roughness' in obj.material) obj.material.roughness = 0.78
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

/**
 * Mount a multi-material textured statue prop (bake-prop-glb output). Fits the
 * AABB to the humanoid crown height with feet on y=0 — unlike sculpts, these
 * downloads are not pre-normalised.
 */
export function attachTexturedStatueGlb(THREE, parent, {
  url,
  targetHeight = HUMANOID_GLB_SRC_YMAX,
  yaw = HUMANOID_GLB_YAW,
  onReady = null,
} = {}) {
  const fit = new THREE.Group()
  fit.name = 'statueGlbFit'
  parent.add(fit)
  parent.userData.statueGlbFit = fit

  loadHumanoidGlbPrototype(THREE, url).then((proto) => {
    if (!proto || !fit.parent) return
    const clone = proto.SkeletonUtils.clone(proto.gltf.scene)
    const meshes = []
    clone.traverse((obj) => {
      if (!obj.isMesh) return
      obj.material = obj.material.clone()
      if (obj.material.map) {
        obj.material.map.colorSpace = THREE.SRGBColorSpace
        obj.material.map.anisotropy = 4
      }
      if ('metalness' in obj.material) obj.material.metalness = Math.min(Number(obj.material.metalness) || 0, 0.12)
      if ('roughness' in obj.material) obj.material.roughness = Math.max(Number(obj.material.roughness) || 0.6, 0.55)
      obj.frustumCulled = false
      meshes.push(obj)
    })
    fit.add(clone)
    fit.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(fit)
    const size = box.getSize(new THREE.Vector3())
    const scale = targetHeight / Math.max(size.y, 0.001)
    fit.scale.setScalar(scale)
    fit.position.set(
      -(box.min.x + box.max.x) * 0.5 * scale,
      -box.min.y * scale,
      -(box.min.z + box.max.z) * 0.5 * scale,
    )
    fit.rotation.y = yaw
    // Reuse the sculpt flash path so hit / hover glow works on either body.
    parent.userData.quadrupedGlbMeshes = meshes
    parent.userData.statueGlbReady = true
    onReady?.(clone)
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
