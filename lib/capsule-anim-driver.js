import { buildHumanoidBody, humanSkinFromSeed } from './humanoid-body'

/**
 * Invisible capsule limb driver under a rigid textured / sculpt GLB.
 * Walk/attack/sway call sites already look for `userData.humanArms` /
 * `humanLegs`; the GLB itself stays rigid (no skins on Kim/Putin/etc.).
 */
export function attachCapsuleAnimDriver(THREE, parent, {
  bulk = 1,
  sleeve = 'long',
  skinSeed = 'statue',
  colors = null,
  lowDetail = false,
  visible = false,
} = {}) {
  const skin = humanSkinFromSeed(skinSeed)
  const palette = colors || {
    skin,
    torso: '#1e293b',
    arms: '#1e293b',
    legs: '#0f172a',
    shoes: '#111827',
    sole: '#020617',
    belt: '#1c1916',
  }
  const mat = (color, roughness = 0.8, metalness = 0.05) => (
    lowDetail
      ? new THREE.MeshLambertMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness, metalness })
  )
  const parts = buildHumanoidBody(THREE, parent, {
    mat,
    colors: palette,
    lowDetail,
    bulk,
    sleeve,
    photoHead: true,
    skipGlb: true,
    handStyle: 'sphere',
  })
  // Hide capsule flesh — the textured GLB is the visible body.
  if (!visible) {
    for (const mesh of parts.bodyMeshes || []) {
      if (mesh) mesh.visible = false
    }
    parent.traverse((obj) => {
      if (obj.isMesh && obj.userData?.proceduralHead) obj.visible = false
    })
    for (const mesh of parent.userData.proceduralHeadMeshes || []) {
      if (mesh) mesh.visible = false
    }
  }
  parent.userData.capsuleAnimDriver = true
  parent.userData.homeLeftArm = parts.leftArm
  parent.userData.homeRightArm = parts.rightArm
  parent.userData.homeLeftHand = parts.leftHand
  parent.userData.homeRightHand = parts.rightHand
  return parts
}
