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
    if (!proto || !fit.parent) {
      onReady?.(null)
      return
    }
    const clone = proto.SkeletonUtils.clone(proto.gltf.scene)
    const meshes = []
    clone.traverse((obj) => {
      if (!obj.isMesh) return
      // Clone per instance: hit flashes write emissive on these materials.
      obj.material = obj.material.clone()
      obj.material.vertexColors = true
      // Sketchfab sculpts bake dark vertex paint; COLOR_0 is the tint. Keep albedo
      // white so MAGA reds / skin / jackets stay saturated under ACES.
      obj.material.color?.setHex(0xffffff)
      if ('metalness' in obj.material) obj.material.metalness = 0
      if ('roughness' in obj.material) obj.material.roughness = 0.72
      if ('envMapIntensity' in obj.material) obj.material.envMapIntensity = 0.25
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
  targetHeight = HUMANOID_GLB_SRC_YMAX,
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
    let clone
    try {
      clone = proto.SkeletonUtils.clone(proto.gltf.scene)
    } catch (err) {
      console.warn('[statue-glb] SkeletonUtils.clone failed, falling back', url, err)
      clone = proto.gltf.scene.clone(true)
    }
    const meshes = []
    clone.traverse((obj) => {
      if (!obj.isMesh) return
      const src = obj.material
      try {
        obj.material = Array.isArray(src)
          ? src.map((m) => m.clone())
          : src.clone()
      } catch (err) {
        console.warn('[statue-glb] material clone failed', url, err)
        return
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of mats) {
        if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace
          mat.map.anisotropy = 8
          mat.map.needsUpdate = true
        }
        // Packed metal-rough maps from Sketchfab often blow the albedo to chrome
        // white under ACES — keep a matte painted look from baseColor only.
        if ('metalnessMap' in mat) mat.metalnessMap = null
        if ('roughnessMap' in mat) mat.roughnessMap = null
        if ('metalness' in mat) mat.metalness = Math.min(Number(mat.metalness) || 0, 0.08)
        if ('roughness' in mat) mat.roughness = Math.max(Number(mat.roughness) || 0.55, 0.55)
        if ('transparent' in mat) mat.transparent = Boolean(mat.transparent && mat.opacity < 0.99)
        if ('opacity' in mat && !mat.transparent) mat.opacity = 1
        if ('depthWrite' in mat) mat.depthWrite = true
        mat.side = THREE.DoubleSide
        mat.color?.setHex?.(0xffffff)
        mat.needsUpdate = true
      }
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
    fit.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(fit)
    const size = box.getSize(new THREE.Vector3())
    if (!(size.y > 0.01)) {
      console.warn('[statue-glb] empty bounds', url, size)
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
    fit.rotation.y = yaw
    // Reuse the sculpt flash path so hit / hover glow works on either body.
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
