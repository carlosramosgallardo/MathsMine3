/** Greet turn: ease from spin yaw back to camera-facing. */
export function homeBossGreetYaw(boss, gt) {
  const yawFrom = Number.isFinite(boss.greetYawFrom) ? boss.greetYawFrom : boss.baseRotationY + (boss.spinYaw || 0)
  const yawDelta = ((yawFrom - boss.baseRotationY + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
  const turnIn = Math.sin(Math.min(1, gt / 0.25) * Math.PI * 0.5)
  return boss.baseRotationY + yawDelta * (1 - turnIn)
}

/** 3 s attack window envelope shared by home boss choreography. */
export function homeAttackEnvelope(at) {
  const bIn = Math.sin(Math.min(1, at / 0.15) * Math.PI * 0.5)
  const bOut = Math.sin(Math.min(1, (1 - at) / 0.20) * Math.PI * 0.5)
  return {
    blend: bIn * bOut,
    jumpH: Math.sin(at * Math.PI),
    windupP: Math.min(1, at / 0.30),
    strikeP: at >= 0.30 ? Math.min(1, (at - 0.30) / 0.25) : 0,
  }
}

export function homeGreetEnvelope(gt) {
  const bIn = Math.sin(Math.min(1, gt / 0.15) * Math.PI * 0.5)
  const bOut = Math.sin(Math.min(1, (1 - gt) / 0.15) * Math.PI * 0.5)
  return bIn * bOut
}

/** Lunge along attack-start facing (constant through the 3 s window). */
export function homeBossLunge(boss, jumpH, blend) {
  const lf = boss.lungseFacing ?? boss.group.rotation.y
  const reach = 0.42 * jumpH * blend
  boss.group.position.x += Math.sin(lf) * reach
  boss.group.position.z = boss.baseZ + Math.cos(lf) * reach
}

/** Shared hop + sway + lunge used by capsule Putin/Kim and rigid Kim. */
export function homeBossAttackHop(boss, { jumpH, blend, jumpScale = 0.22, t = 0 } = {}) {
  boss.group.position.y = boss.baseY + jumpH * jumpScale * blend
  boss.group.rotation.z = Math.sin(t * (boss.sway + 0.65)) * 0.014 * (1 - blend)
  homeBossLunge(boss, jumpH, blend)
}

/** Rigid textured bosses (Kim/Putin props) — no capsule limbs on the home rail. */
export function applyRigidHomeAttack(boss, at, t) {
  const { blend, jumpH, windupP, strikeP } = homeAttackEnvelope(at)
  const pivot = boss.bodyPivot
  if (!pivot) return
  pivot.position.y = Math.max(0, Math.sin(t * boss.bob) * 0.06) * (1 - blend) + 0.05 * windupP * blend
  pivot.position.z = (windupP * -0.08 + strikeP * -0.18) * blend
  pivot.rotation.x = (-0.12 * windupP + 0.08 * strikeP) * blend
  pivot.scale.setScalar(1 + (0.04 * windupP + 0.02 * strikeP) * blend)
  homeBossAttackHop(boss, { jumpH, blend, jumpScale: 0.18, t })
}

export function applyRigidHomeGreet(boss, gt, t) {
  const blend = homeGreetEnvelope(gt)
  boss.group.rotation.y = homeBossGreetYaw(boss, gt)
  boss.group.position.y = boss.baseY + Math.sin(t * 2.0) * 0.010
  boss.group.position.z = boss.baseZ
  boss.group.rotation.z = 0
  const wave = Math.sin(t * 3.2) * 0.28 * blend
  const pivot = boss.bodyPivot
  if (!pivot) return
  pivot.position.y = Math.sin(t * 2.2) * 0.025 + 0.04 * blend
  pivot.position.z = 0
  pivot.rotation.x = -0.08 * blend
  pivot.rotation.z = wave * 0.35
  pivot.scale.setScalar(1 + 0.03 * blend)
}

export function applyRigidHomeWalk(boss, t) {
  const pivot = boss.bodyPivot
  if (!pivot) return
  const step = Math.sin(t * 7) * 0.022
  pivot.position.y = (pivot.userData.baseY ?? 0) + Math.abs(step)
  pivot.rotation.x = -0.04
  pivot.position.z = step * 0.28
}

export function resetRigidHomeIdle(boss) {
  const pivot = boss.bodyPivot
  if (!pivot) return
  pivot.rotation.x = 0
  pivot.position.z = 0
  pivot.scale.setScalar(1)
}

export function isRigidTexturedBoss(bodyPivot) {
  // Capsule drivers articulate limbs — skip whole-mesh hop/lean walk.
  if (bodyPivot?.userData?.capsuleAnimDriver) return false
  return Boolean(bodyPivot?.userData?.statueGlbReady)
}

/** True when invisible/visible capsule limbs drive walk & attack. */
export function hasCapsuleAnimDriver(bodyPivot) {
  return Boolean(bodyPivot?.userData?.capsuleAnimDriver)
}

/** @deprecated use applyRigidHomeAttack */
export const applyKimRigidHomeAttack = applyRigidHomeAttack
/** @deprecated use applyRigidHomeGreet */
export const applyKimRigidHomeGreet = applyRigidHomeGreet
/** @deprecated use applyRigidHomeWalk */
export const applyKimRigidHomeWalk = applyRigidHomeWalk
/** @deprecated use resetRigidHomeIdle */
export const resetKimRigidHomeIdle = resetRigidHomeIdle
/** @deprecated use isRigidTexturedBoss */
export const isKimRigidStatue = isRigidTexturedBoss
