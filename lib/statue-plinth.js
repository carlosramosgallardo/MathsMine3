import { loadHumanoidGlbPrototype, makeStatueDisplayMaterial } from './humanoid-glb'

/** Textured Roman column base (Tanit XR / Sketchfab CC BY-NC-SA). */
export const STATUE_PLINTH_URL = '/models/statue-plinth.glb'

/**
 * Native deck height of statue-plinth.glb (min Y ≈ 0, max Y ≈ 0.58).
 * Do not squash this to a stub: mining extracts the mesh to a scaled world
 * group, and shrinking it to 0.2 left the visible column waist-high while
 * figures still stood at 0.2.
 */
export const STATUE_PLINTH_HEIGHT = 0.58

/** @deprecated use STATUE_PLINTH_HEIGHT — kept so older plaza math still compiles. */
export const STATUE_PLINTH_SRC_YMAX = STATUE_PLINTH_HEIGHT

/** Shrink the native pedestal mesh to half its scanned footprint/height. */
export const STATUE_PLINTH_SCALE = 0.5

/** Local Y of the plinth deck under a statue figure (before AABB sync). */
export function statuePlinthTopY() {
  return STATUE_PLINTH_HEIGHT * STATUE_PLINTH_SCALE
}

/** Shared plaza group scale so Milei / Zelensky / Macron pedestals match in world size. */
export const STATUE_PLAZA_GROUP_SCALE = 1.55

/** Put the figure's feet on the real world deck of this plinth mesh. */
export function syncStatueDeckFromPlinth(THREE, parent, fit) {
  const pivot = parent?.userData?.bodyPivot
  if (!pivot || !fit || !THREE) return
  parent.updateMatrixWorld(true)
  fit.updateMatrixWorld(true)
  const worldBox = new THREE.Box3().setFromObject(fit)
  const sy = parent.scale?.y || 1
  const deck = (worldBox.max.y - parent.position.y) / sy
  if (!(Number.isFinite(deck) && deck > 0.04)) return
  pivot.userData.baseY = deck
  if (!Number.isFinite(pivot.userData.strideFloorY)) pivot.position.y = deck
}

/**
 * Plant the Roman column at y=0 with its native proportions, then lift the
 * figure onto the measured deck (home carousel and mining extract).
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
    fit.scale.setScalar(STATUE_PLINTH_SCALE)
    fit.position.set(
      -(box.min.x + box.max.x) * 0.5 * STATUE_PLINTH_SCALE,
      -box.min.y * STATUE_PLINTH_SCALE,
      -(box.min.z + box.max.z) * 0.5 * STATUE_PLINTH_SCALE,
    )
    if (holder) holder.add(fit)
    syncStatueDeckFromPlinth(THREE, parent, fit)
    onReady?.(clone)
  }).catch((err) => {
    console.warn('[statue-plinth]', err)
    onReady?.(null)
  })
  return fit
}
