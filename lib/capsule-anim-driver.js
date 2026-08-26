import { buildHumanoidBody, humanSkinFromSeed } from './humanoid-body'

/**
 * Capsule limb driver under a rigid textured / sculpt GLB.
 * Default: only arms+legs are drawn (torso stays the GLB) so walk/attack read
 * as articulation without a hopping whole-mesh bob.
 */
export function attachCapsuleAnimDriver(THREE, parent, {
  bulk = 1,
  sleeve = 'long',
  skinSeed = 'statue',
  colors = null,
  lowDetail = false,
  /** Draw capsule arms/legs (torso capsules stay hidden under the GLB). */
  visibleLimbs = true,
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
  for (const mesh of parent.userData.proceduralHeadMeshes || []) {
    if (mesh) mesh.visible = false
  }

  const limbRoots = new Set([
    parts.leftArm, parts.rightArm, parts.leftLeg, parts.rightLeg,
  ].filter(Boolean))
  const underLimb = (obj) => {
    let n = obj
    while (n) {
      if (limbRoots.has(n)) return true
      n = n.parent
    }
    return false
  }
  for (const mesh of parts.bodyMeshes || []) {
    if (!mesh) continue
    // Always hide capsule torso — the GLB supplies the body shell.
    if (!underLimb(mesh)) {
      mesh.visible = false
      continue
    }
    mesh.visible = visibleLimbs
  }

  parent.userData.capsuleAnimDriver = true
  parent.userData.homeLeftArm = parts.leftArm
  parent.userData.homeRightArm = parts.rightArm
  parent.userData.homeLeftHand = parts.leftHand
  parent.userData.homeRightHand = parts.rightHand
  // Slightly wider A-pose so idle read as arms hanging, not T-pose stubs.
  for (const arm of parent.userData.humanArms || []) {
    if (!arm) continue
    const side = (arm.userData.baseX ?? arm.position.x) >= 0 ? 1 : -1
    arm.rotation.z = side * 0.16
    arm.userData.baseRotZ = arm.rotation.z
    arm.rotation.x = 0.06
  }
  return parts
}

/**
 * Arms hang relaxed at the sides (slight A-pose) with a tiny breath sway.
 */
export function relaxHumanoidArms(host, time = 0, intensity = 0.35) {
  const arms = host?.userData?.humanArms
  if (!arms) return
  for (const arm of arms) {
    const phase = arm.userData.swayPhase || 0
    const baseZ = arm.userData.baseRotZ || 0
    arm.rotation.x = Math.sin(time * 0.7 + phase) * 0.03 * intensity
    arm.rotation.z = baseZ + Math.sin(time * 0.55 + phase * 1.3) * 0.025 * intensity
    if (Number.isFinite(arm.userData.baseY)) arm.position.y = arm.userData.baseY
  }
}
