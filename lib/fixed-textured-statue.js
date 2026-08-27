import { attachTexturedStatueGlb } from './quadruped-glb'
import { attachHumanoidGlb, HUMANOID_GLB_YAW } from './humanoid-glb'
import { attachStatuePlinth, statuePlinthTopY } from './statue-plinth'
import { attachCapsuleAnimDriver } from './capsule-anim-driver'

/**
 * Textured multi-mesh GLB. Plaza statues (Macron/Zelensky) can share Milei's
 * extracted plinth; rigid bosses (Kim/Putin) plant on the floor. Optional
 * invisible capsule limbs drive walk/attack while the GLB stays rigid, or a
 * skinned RPM avatar follows the capsule via bone sync.
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
  /** Fit-group yaw applied while planting the GLB (default π like other props). */
  glbYaw = HUMANOID_GLB_YAW,
  placeholderColor = '#4b5a3a',
  lowDetail = false,
  shadowRadius = 0.58,
  renderOrder = 5,
  /** Home-rail walkable statue (false for combat bosses). */
  walkableStatue = true,
  /** Milei-style beige pedestal under the figure (Macron/Zelensky). */
  withPlinth = false,
  /** Invisible capsule limbs for human walk / attack / sway. */
  withCapsuleDriver = false,
  /** Skinned RPM avatar: capsule drives bones, outfit never strips/deforms. */
  skinnedDriver = false,
  capsuleBulk = 1,
  capsuleSleeve = 'long',
  capsuleSkinSeed = 'statue',
  capsuleColors = null,
  /** Called after the GLB plants (ok or null). Use to mount rigid limb shells. */
  onGlbReady = null,
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
  // Feet sit on the plinth deck when present (same extract Milei's sculpt embeds).
  const deckY = withPlinth ? statuePlinthTopY() : 0
  bodyPivot.position.y = deckY
  bodyPivot.userData.baseY = deckY

  if (withPlinth) {
    attachStatuePlinth(THREE, group)
  }

  let capsuleParts = null
  if (withCapsuleDriver) {
    capsuleParts = attachCapsuleAnimDriver(THREE, bodyPivot, {
      bulk: capsuleBulk,
      sleeve: capsuleSleeve,
      skinSeed: capsuleSkinSeed,
      colors: capsuleColors,
      lowDetail,
      visibleLimbs: false,
    })
    group.userData.homeLeftArm = capsuleParts.leftArm
    group.userData.homeRightArm = capsuleParts.rightArm
    group.userData.homeLeftHand = capsuleParts.leftHand
    group.userData.homeRightHand = capsuleParts.rightHand
  }

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
    if (ok && !skinnedDriver) bodyPivot.userData.statueGlbReady = true
    if (ok) onGlbReady?.(group, bodyPivot)
    group.userData.onModelReady?.(group)
  }

  if (skinnedDriver && withCapsuleDriver) {
    attachHumanoidGlb(THREE, bodyPivot, {
      bulk: capsuleBulk,
      hideHead: false,
      preserveMap: true,
      url: modelUrl,
      sleeve: capsuleSleeve,
      hands: [capsuleParts.leftHand, capsuleParts.rightHand],
      bodyMeshes: capsuleParts.bodyMeshes,
      onReady: (clone) => finishModel(Boolean(clone)),
    })
  } else {
    attachTexturedStatueGlb(THREE, bodyPivot, {
      url: modelUrl,
      yaw: glbYaw,
      onReady: (clone) => finishModel(Boolean(clone)),
    })
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(shadowRadius, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.32, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  // Pedestal already grounds the figure — a ground disc paints the deck black.
  if (!withPlinth) group.add(shadow)

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

/** @deprecated Red eye flash retired — kept so statue call sites compile. */
export function flashFixedTexturedStatue() {}
