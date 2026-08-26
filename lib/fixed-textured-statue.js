import { attachTexturedStatueGlb } from './quadruped-glb'
import { attachBotEyeGlows, setBossMaskEyesRed } from './boss-head-photo'
import { placeEyeGlowsFromFit } from './prop-eye-glows'
import { HUMANOID_GLB_YAW } from './humanoid-glb'
import { attachStatuePlinth, statuePlinthTopY } from './statue-plinth'
import { attachCapsuleAnimDriver } from './capsule-anim-driver'

/**
 * Textured multi-mesh GLB. Plaza statues (Macron/Zelensky) can share Milei's
 * extracted plinth; rigid bosses (Kim/Putin) plant on the floor. Optional
 * invisible capsule limbs drive walk/attack while the GLB stays rigid.
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
  /** Seed eye centres — overwritten from the fitted AABB once the GLB lands. */
  eyePoints = null,
  eyeSize = 0.07,
  eyeLine = 0.48,
  shadowRadius = 0.58,
  renderOrder = 5,
  /** Home-rail walkable statue (false for combat bosses). */
  walkableStatue = true,
  /** Milei-style beige pedestal under the figure (Macron/Zelensky). */
  withPlinth = false,
  /** Invisible capsule limbs for human walk / attack / sway. */
  withCapsuleDriver = false,
  capsuleBulk = 1,
  capsuleSleeve = 'long',
  capsuleSkinSeed = 'statue',
  capsuleColors = null,
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

  if (withCapsuleDriver) {
    const parts = attachCapsuleAnimDriver(THREE, bodyPivot, {
      bulk: capsuleBulk,
      sleeve: capsuleSleeve,
      skinSeed: capsuleSkinSeed,
      colors: capsuleColors,
      lowDetail,
    })
    group.userData.homeLeftArm = parts.leftArm
    group.userData.homeRightArm = parts.rightArm
    group.userData.homeLeftHand = parts.leftHand
    group.userData.homeRightHand = parts.rightHand
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

  attachBotEyeGlows(THREE, bodyPivot, {
    color: '#67e8f9',
    size: eyeSize,
    idleOpacity: 0,
    points: eyePoints || [
      { x: -0.04, y: 0.92, z: 0.12 },
      { x: 0.04, y: 0.92, z: 0.12 },
    ],
  })

  const finishModel = (ok) => {
    if (ok && placeholder.parent) {
      placeholder.removeFromParent()
      placeholder.geometry.dispose()
      placeholder.material.dispose()
    }
    if (ok) {
      // Textured RPM props are baked without skins (T-pose). Hide body/outfit
      // meshes so capsule limbs can hang and walk; keep head / eyes / hair.
      // Only plaza statues (withPlinth) — Kim/Putin keep their full textured shell.
      if (withCapsuleDriver && withPlinth) {
        const fit = bodyPivot.userData.statueGlbFit
        fit?.traverse((obj) => {
          if (!obj.isMesh) return
          const n = String(obj.name || '').toLowerCase()
          if (/head|eye|cornea|teeth|tooth|hair|brow|lash|beard|mustache|cap|hat|goggle|glass/.test(n)) return
          if (/body|outfit|avatarbody|trousers|shirt|jacket|shoe|boot|leg|arm|hand|foot/.test(n)) {
            obj.visible = false
            return
          }
          // Numbered accessory meshes (0/1/2) are usually hair / brows — keep.
          if (/^\d+$/.test(n)) return
        })
      }
      // After limb hide so skull/named-eye sampling ignores the T-pose torso.
      placeEyeGlowsFromFit(THREE, bodyPivot, { eyeLine, size: eyeSize })
    }
    group.userData.modelReady = true
    group.userData.onModelReady?.(group)
  }

  attachTexturedStatueGlb(THREE, bodyPivot, {
    url: modelUrl,
    yaw: glbYaw,
    onReady: (clone) => finishModel(Boolean(clone)),
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
