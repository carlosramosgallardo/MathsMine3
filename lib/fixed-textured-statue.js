import { attachTexturedStatueGlb } from './quadruped-glb'
import { attachBotEyeGlows, setBossMaskEyesRed } from './boss-head-photo'

/**
 * Textured multi-mesh GLB on the floor (no plinth).
 * Plaza statues (Macron/Zelensky) and rigid bosses (Kim/Putin) share this plant.
 */
export function createFixedTexturedStatueVisual(THREE, {
  name,
  bodyName,
  flagKey,
  bossStatueId,
  modelUrl,
  scale,
  gx,
  gy,
  yaw = 0,
  placeholderColor = '#4b5a3a',
  lowDetail = false,
  /** Local eye centres on bodyPivot (after π yaw); face looks along +Z. */
  eyePoints = null,
  eyeSize = 0.07,
  shadowRadius = 0.58,
  renderOrder = 5,
  /** Home-rail walkable statue (false for combat bosses). */
  walkableStatue = true,
} = {}) {
  const group = new THREE.Group()
  group.name = name
  group.userData[flagKey] = true
  if (bossStatueId != null) group.userData.bossStatueId = bossStatueId
  group.userData.skipOcclusion = true
  if (walkableStatue) {
    group.userData.statueFixed = false
    group.userData.statueWalks = true
  }

  const bodyPivot = new THREE.Group()
  bodyPivot.name = bodyName
  group.add(bodyPivot)
  group.userData.bodyPivot = bodyPivot
  bodyPivot.userData.baseY = 0

  // Invisible stand-in: never flash a coloured slab while the GLB streams in.
  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 1.35, 0.4),
    lowDetail
      ? new THREE.MeshLambertMaterial({ color: placeholderColor })
      : new THREE.MeshStandardMaterial({ color: placeholderColor, roughness: 0.8, metalness: 0.06 }),
  )
  placeholder.position.y = 0.7
  placeholder.visible = false
  bodyPivot.add(placeholder)
  group.userData.modelReady = false

  const finishModel = (ok) => {
    if (ok && placeholder.parent) {
      placeholder.removeFromParent()
      placeholder.geometry.dispose()
      placeholder.material.dispose()
    }
    group.userData.modelReady = true
    group.userData.onModelReady?.(group)
  }

  attachTexturedStatueGlb(THREE, bodyPivot, {
    url: modelUrl,
    onReady: (clone) => finishModel(Boolean(clone)),
  })

  attachBotEyeGlows(THREE, bodyPivot, {
    color: '#67e8f9',
    size: eyeSize,
    idleOpacity: 0,
    points: eyePoints || [
      { x: -0.045, y: 1.52, z: 0.14 },
      { x: 0.045, y: 1.52, z: 0.14 },
    ],
  })

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(shadowRadius, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.32, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  group.add(shadow)

  bodyPivot.rotation.y = Math.PI
  group.scale.setScalar(scale)
  group.position.set(gx, 0, gy)
  group.rotation.y = yaw
  group.matrixAutoUpdate = true
  group.frustumCulled = false
  bodyPivot.traverse((obj) => {
    if (!obj.isMesh) return
    obj.frustumCulled = false
    obj.renderOrder = renderOrder
  })

  return { group, bodyPivot }
}

/** Hit / hover: red on eye sprites only — never the body mesh. */
export function flashFixedTexturedStatue(group, ms = 1500) {
  if (!group) return
  if (group.userData.eyeRedTimer) clearTimeout(group.userData.eyeRedTimer)
  setBossMaskEyesRed(group, true)
  group.userData.eyeRedTimer = setTimeout(() => {
    setBossMaskEyesRed(group, false)
    group.userData.eyeRedTimer = null
  }, ms)
}
