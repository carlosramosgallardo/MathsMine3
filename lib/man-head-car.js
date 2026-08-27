import { loadHumanoidGlbPrototype, makeVividAlbedoMaterial, HUMANOID_GLB_YAW } from './humanoid-glb'

/** Sketchfab Male Head (CC BY) — cockpit rider skull for RL-car bots. */
export const MAN_HEAD_GLB_URL = '/models/man-head.glb'

/**
 * Mount man-head.glb on a parent (prefer the RL-car itself, car-local units).
 * Fits with a robust AABB so the skull sits in the cabin.
 */
export function attachManHeadInCar(THREE, parent, {
  url = MAN_HEAD_GLB_URL,
  /** Chin / neck sit height in car-local (cockpit tub seat ≈ 0.40). */
  neckY = 0.40,
  /** Forward seat offset in car-local (tub centre ≈ z 0.18). */
  neckZ = 0.18,
  /** Fitted skull height in car-local units. */
  targetHeight = 0.28,
  onReady = null,
} = {}) {
  const fit = new THREE.Group()
  fit.name = 'manHeadCarFit'
  parent.add(fit)
  parent.userData.manHeadCarFit = fit

  loadHumanoidGlbPrototype(THREE, url).then((proto) => {
    if (!proto || !fit.parent) {
      onReady?.(null)
      return
    }
    const clone = proto.SkeletonUtils.clone(proto.gltf.scene)
    clone.name = 'manHeadMesh'
    clone.traverse((obj) => {
      if (!obj.isMesh) return
      obj.material = makeVividAlbedoMaterial(THREE, {
        map: null,
        color: 0xd4a574,
        vertexColors: false,
      })
      obj.frustumCulled = false
    })

    for (const child of [...fit.children]) fit.remove(child)

    // Measure in isolation so the parent car scale never contaminates AABB.
    const holder = fit.parent
    if (holder) holder.remove(fit)
    fit.position.set(0, 0, 0)
    fit.scale.set(1, 1, 1)
    fit.rotation.set(0, HUMANOID_GLB_YAW, 0)
    fit.add(clone)
    fit.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(clone)
    if (box.isEmpty()) {
      if (holder) holder.add(fit)
      onReady?.(null)
      return
    }
    const size = box.getSize(new THREE.Vector3())
    const sizeY = size.y
    if (!(sizeY > 0.01)) {
      if (holder) holder.add(fit)
      onReady?.(null)
      return
    }

    const scale = targetHeight / sizeY
    const center = box.getCenter(new THREE.Vector3())
    fit.scale.setScalar(scale)
    fit.position.set(
      -center.x * scale,
      neckY - box.min.y * scale,
      neckZ - center.z * scale,
    )
    if (holder) holder.add(fit)
    fit.userData.baseY = fit.position.y

    parent.userData.humanoidGlbReady = true
    parent.userData.onHumanoidGlbReady?.(parent)
    onReady?.(clone)
  }).catch((err) => {
    console.warn('[man-head-car]', err)
    onReady?.(null)
  })
  return fit
}
