import { humanoidGlbFit, loadHumanoidGlbPrototype, makeVividAlbedoMaterial, HUMANOID_GLB_YAW } from './humanoid-glb'

/** Vertex-coloured plinth extracted from milei.glb (see bake-milei-plinth-glb.mjs). */
export const STATUE_PLINTH_URL = '/models/statue-plinth.glb'

/** Source-space height of the baked plinth mesh (feet at y=0). */
export const STATUE_PLINTH_SRC_YMAX = 0.108

/** World-space Y of the plinth deck — same scale Milei uses on the home rail. */
export function statuePlinthTopY() {
  const { scale, offsetY } = humanoidGlbFit()
  return STATUE_PLINTH_SRC_YMAX * scale + offsetY
}

/**
 * Milei-style beige pedestal for Macron/Zelensky/etc. Milei's own sculpt already
 * includes the base; every other statue gets this shared extract.
 */
export function attachStatuePlinth(THREE, parent, { onReady = null } = {}) {
  const fit = new THREE.Group()
  fit.name = 'statuePlinthFit'
  const { scale, offsetY } = humanoidGlbFit()
  fit.scale.setScalar(scale)
  fit.position.y = offsetY
  fit.rotation.y = HUMANOID_GLB_YAW
  parent.add(fit)

  loadHumanoidGlbPrototype(THREE, STATUE_PLINTH_URL).then((proto) => {
    if (!proto || !fit.parent) {
      onReady?.(null)
      return
    }
    const clone = proto.SkeletonUtils.clone(proto.gltf.scene)
    clone.traverse((obj) => {
      if (!obj.isMesh) return
      obj.material = makeVividAlbedoMaterial(THREE, {
        map: obj.material?.map || null,
        color: 0xffffff,
        vertexColors: true,
      })
      obj.frustumCulled = false
    })
    fit.add(clone)
    onReady?.(clone)
  }).catch((err) => {
    console.warn('[statue-plinth]', err)
    onReady?.(null)
  })
  return fit
}
