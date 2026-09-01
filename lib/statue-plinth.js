import { loadHumanoidGlbPrototype, makeStatueDisplayMaterial } from './humanoid-glb'
import { trailerModelUrl } from './trailer-model-url'

/** Lightweight token pedestal (Birdy.82 / Sketchfab CC BY 4.0). */
export const STATUE_PLINTH_URL = '/models/pedestal.glb'

/**
 * Native height of pedestal.glb after its authored node transforms.
 * Runtime planting subtracts its negative min Y before measuring the deck.
 */
export const STATUE_PLINTH_HEIGHT = 40.498

/** @deprecated use STATUE_PLINTH_HEIGHT — kept so older plaza math still compiles. */
export const STATUE_PLINTH_SRC_YMAX = STATUE_PLINTH_HEIGHT

/** 400-unit native diameter → 1.4 local units (≈2.17 world units in plazas). */
export const STATUE_PLINTH_SCALE = 0.0035

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
 * Plant the lightweight token at y=0, brand it with the official MM3 token
 * face/palette, then lift the figure onto the measured deck.
 */
export function attachStatuePlinth(THREE, parent, { onReady = null } = {}) {
  const fit = new THREE.Group()
  fit.name = 'statuePlinthFit'
  parent.add(fit)
  parent.userData.statuePlinthFit = fit

  loadHumanoidGlbPrototype(THREE, trailerModelUrl(STATUE_PLINTH_URL)).then((proto) => {
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
      // The source token's axe card is replaced by the official MM3 face.
      if (/plane/i.test(obj.name)) {
        obj.visible = false
        return
      }
      const src = obj.material
      const sourceMaterial = Array.isArray(src) ? src.find(Boolean) : src
      const material = makeStatueDisplayMaterial(THREE, sourceMaterial, { side: THREE.DoubleSide })
      material.color.set('#071018')
      material.metalness = 0.68
      material.roughness = 0.3
      material.emissive.set('#00d9ff')
      material.emissiveIntensity = 0.1
      obj.material = material
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
    // Official token decal on the top deck. MeshBasic keeps the logo colours
    // identical to the website instead of letting scene lights wash them out.
    const logoTexture = new THREE.TextureLoader().load('/mm3-token.png')
    logoTexture.colorSpace = THREE.SRGBColorSpace
    const logoMaterial = new THREE.MeshBasicMaterial({
      map: logoTexture,
      transparent: true,
      side: THREE.DoubleSide,
    })
    logoMaterial.userData.ownedMap = true
    const logo = new THREE.Mesh(
      new THREE.CircleGeometry(150, 48),
      logoMaterial,
    )
    logo.name = 'mm3PedestalLogo'
    logo.rotation.x = -Math.PI / 2
    logo.position.y = box.max.y + 0.8
    fit.add(logo)

    // Thin official-palette edge rings make the low-poly base read clearly
    // without adding another image or a heavy baked texture.
    for (const [y, color] of [[box.min.y + 2.5, '#00d9ff'], [box.max.y - 2.5, '#ff2bd6']]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(188, 5, 6, 64),
        new THREE.MeshBasicMaterial({ color }),
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = y
      fit.add(ring)
    }
    if (holder) holder.add(fit)
    syncStatueDeckFromPlinth(THREE, parent, fit)
    onReady?.(clone)
  }).catch((err) => {
    console.warn('[statue-plinth]', err)
    onReady?.(null)
  })
  return fit
}
