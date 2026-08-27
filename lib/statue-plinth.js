import { loadHumanoidGlbPrototype, makeStatueDisplayMaterial } from './humanoid-glb'

/** Textured Roman column base (Tanit XR / Sketchfab CC BY-NC-SA). */
export const STATUE_PLINTH_URL = '/models/statue-plinth.glb'

/**
 * Deck height in character units (feet at y=0, crown ≈ 1.075).
 * Keep this modest: the scan is ~3.2× wider than it is tall, so a tall deck
 * becomes a plaza-wide disc that collides with neighbour nameplates.
 */
export const STATUE_PLINTH_HEIGHT = 0.2

/** @deprecated use STATUE_PLINTH_HEIGHT — kept so older plaza math still compiles. */
export const STATUE_PLINTH_SRC_YMAX = STATUE_PLINTH_HEIGHT

/** World-space Y of the plinth deck under a statue figure. */
export function statuePlinthTopY() {
  return STATUE_PLINTH_HEIGHT
}

/** Shared plaza group scale so Milei / Zelensky / Macron pedestals match in world size. */
export const STATUE_PLAZA_GROUP_SCALE = 1.55

/**
 * Plant the Roman column base at y=0 with its deck at STATUE_PLINTH_HEIGHT.
 */
export function attachStatuePlinth(THREE, parent, { onReady = null } = {}) {
  const fit = new THREE.Group()
  fit.name = 'statuePlinthFit'
  parent.add(fit)
  parent.userData.statuePlinthFit = fit

  loadHumanoidGlbPrototype(THREE, STATUE_PLINTH_URL).then((proto) => {
    if (!proto || !fit.parent) {
      onReady?.(null)
      return
    }
    let clone
    try {
      clone = proto.gltf.scene.clone(true)
    } catch (err) {
      console.warn('[statue-plinth] scene.clone failed', err)
      onReady?.(null)
      return
    }
    clone.traverse((obj) => {
      if (!obj.isMesh) return
      const src = obj.material
      const srcList = Array.isArray(src) ? src : [src]
      const next = []
      for (const sm of srcList) {
        if (!sm) continue
        next.push(makeStatueDisplayMaterial(THREE, sm, { side: THREE.DoubleSide }))
      }
      if (!next.length) return
      obj.material = next.length === 1 ? next[0] : next
      obj.visible = true
      obj.frustumCulled = false
    })
    fit.add(clone)
    const holder = fit.parent
    if (holder) holder.remove(fit)
    fit.position.set(0, 0, 0)
    fit.scale.set(1, 1, 1)
    fit.rotation.set(0, 0, 0)
    fit.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(fit)
    const size = box.getSize(new THREE.Vector3())
    if (!(size.y > 0.01)) {
      console.warn('[statue-plinth] empty bounds', size)
      if (holder) holder.add(fit)
      onReady?.(null)
      return
    }
    const scale = STATUE_PLINTH_HEIGHT / size.y
    fit.scale.setScalar(scale)
    fit.position.set(
      -(box.min.x + box.max.x) * 0.5 * scale,
      -box.min.y * scale,
      -(box.min.z + box.max.z) * 0.5 * scale,
    )
    if (holder) holder.add(fit)
    onReady?.(clone)
  }).catch((err) => {
    console.warn('[statue-plinth]', err)
    onReady?.(null)
  })
  return fit
}
