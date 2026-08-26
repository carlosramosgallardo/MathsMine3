import { loadHumanoidGlbPrototype, makeVividAlbedoMaterial, HUMANOID_GLB_YAW } from './humanoid-glb'

/** Sketchfab Male Head (CC BY) — cockpit rider skull for RL-car bots. */
export const MAN_HEAD_GLB_URL = '/models/man-head.glb'

/**
 * Mount man-head.glb above a car cockpit. Fits the AABB so the chin sits near
 * `neckY` and the crown peeks above the tub; hides any procedural wallet head.
 */
export function attachManHeadInCar(THREE, parent, {
  url = MAN_HEAD_GLB_URL,
  neckY = 0.48,
  neckZ = 0,
  targetHeight = 0.42,
  onReady = null,
} = {}) {
  const fit = new THREE.Group()
  fit.name = 'manHeadCarFit'
  parent.add(fit)

  loadHumanoidGlbPrototype(THREE, url).then((proto) => {
    if (!proto || !fit.parent) {
      onReady?.(null)
      return
    }
    const clone = proto.SkeletonUtils.clone(proto.gltf.scene)
    clone.traverse((obj) => {
      if (!obj.isMesh) return
      // Sketchfab Male Head ships near-white vertex colours and no albedo map —
      // paint a flesh tone (ignore VC or the head reads as chalk).
      obj.material = makeVividAlbedoMaterial(THREE, {
        map: null,
        color: 0xd4a574,
        vertexColors: false,
      })
      obj.frustumCulled = false
    })
    fit.add(clone)
    fit.rotation.y = HUMANOID_GLB_YAW
    fit.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(fit)
    const size = box.getSize(new THREE.Vector3())
    if (!(size.y > 0.01)) {
      onReady?.(null)
      return
    }
    const scale = targetHeight / size.y
    fit.scale.setScalar(scale)
    // Chin at neckY, centered on X, pushed along +Z into the cabin.
    fit.position.set(
      -(box.min.x + box.max.x) * 0.5 * scale,
      neckY - box.min.y * scale,
      neckZ - (box.min.z + box.max.z) * 0.5 * scale,
    )
    for (const mesh of parent.userData.proceduralHeadMeshes || []) mesh.visible = false
    parent.userData.manHeadCarFit = fit
    parent.userData.humanoidGlbReady = true
    parent.userData.onHumanoidGlbReady?.(parent)
    onReady?.(clone)
  }).catch((err) => {
    console.warn('[man-head-car]', err)
    onReady?.(null)
  })
  return fit
}
