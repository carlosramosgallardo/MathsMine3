import { buildHumanoidBody, humanSkinFromSeed, walkHumanoidLegs } from './humanoid-body'

/**
 * Capsule limb driver under a rigid textured / sculpt GLB.
 * Torso capsules stay hidden. Limb capsules are visible only when the GLB body
 * is stripped (plaza statues); otherwise they stay invisible so they do not
 * double up on a full rigid mesh (Kim / Putin / Milei).
 */
export function attachCapsuleAnimDriver(THREE, parent, {
  bulk = 1,
  sleeve = 'long',
  skinSeed = 'statue',
  colors = null,
  lowDetail = false,
  /** Draw capsule arms/legs (false when the GLB still shows its own limbs). */
  visibleLimbs = false,
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

/**
 * Track gx/gy deltas and drive a walk cycle. Clears attack leg-splay (rotation.z)
 * whenever we are not mid-attack so Putin/Kim do not stay pigeon-toed.
 */
export function syncCapsuleLocomotion(bodyPivot, runtime, {
  moved,
  attacking = false,
  walkAmp = 0.48,
} = {}) {
  if (!bodyPivot || attacking) return
  const legs = bodyPivot.userData?.humanLegs
  if (legs) {
    legs[0].rotation.z = 0
    legs[1].rotation.z = 0
  }
  if (moved > 0.0008) {
    runtime.walkPhase = (runtime.walkPhase || 0) + moved * 14
    walkHumanoidLegs(bodyPivot, runtime.walkPhase, walkAmp)
  } else {
    walkHumanoidLegs(bodyPivot, 0, 0)
  }
}

/** gx/gy step since last sync (mutates runtime.prevGx/prevGy). */
export function bossMoveDelta(runtime) {
  const moved = Math.hypot(
    runtime.gx - (runtime.prevGx ?? runtime.gx),
    runtime.gy - (runtime.prevGy ?? runtime.gy),
  )
  runtime.prevGx = runtime.gx
  runtime.prevGy = runtime.gy
  return moved
}
