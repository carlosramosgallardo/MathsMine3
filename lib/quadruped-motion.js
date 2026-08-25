/**
 * Body-level gait for characters whose GLB is a rigid, four-legged sculpt.
 *
 * The humanoid rig animates limbs (lib/humanoid-body.js); a crawling sculpt has
 * no bones to bend, so the movement has to read from how the whole body rides
 * the ground: a stride bob, the fore/aft rock of shoulders dipping as the hands
 * land, a weight roll from side to side, and a surge along the travel axis.
 *
 * Pure math, no three.js — `quadrupedPose` returns offsets in character units
 * (the same space as bodyPivot.position) and `applyQuadrupedPose` writes them.
 *
 * Sign conventions match the boss rig: visual forward is +Z at yaw 0, and a
 * positive pitch tips the nose down, so rearing up is negative.
 */

export const QUADRUPED_GAIT = Object.freeze({
  /** Gait cycle speed in rad/s at full walking speed. */
  strideRate: 6.4,
  /** Vertical rise of the body once per stride. */
  bob: 0.05,
  /** Shoulders dipping as the front limbs take the weight. */
  pitch: 0.085,
  /** Weight rolling between the left and right pair. */
  roll: 0.055,
  /** Push/glide along the travel axis. */
  surge: 0.045,
  /** Breathing while stopped. */
  idleBob: 0.014,
  idleRate: 1.7,
})

/** Rear-up-then-slam beat of the attack, as fractions of the attack window. */
export const QUADRUPED_ATTACK = Object.freeze({
  rearUntil: 0.42,
  strikeSpan: 0.26,
  rearPitch: 0.5,
  rearLift: 0.1,
  strikePitch: 0.62,
  strikeLunge: 0.24,
  drawBack: 0.06,
})

export const QUADRUPED_JUMP = Object.freeze({
  height: 0.34,
  tuckPitch: 0.22,
})

const clamp01 = (value) => (value > 1 ? 1 : value < 0 ? 0 : value)
const ease = (t) => t * t * (3 - 2 * t)

/**
 * Pose for one frame.
 *
 * @param {object} state
 * @param {number} state.time      seconds, drives the gait cycle
 * @param {number} state.moving    0 = stopped, 1 = full speed
 * @param {number|null} state.attackT 0..1 through an attack, else null
 * @param {number|null} state.jumpT   0..1 through a jump/pounce, else null
 * @returns {{y: number, z: number, pitch: number, roll: number}}
 */
export function quadrupedPose({ time = 0, moving = 0, attackT = null, jumpT = null } = {}) {
  const gain = clamp01(Number(moving) || 0)
  const t = Number(time) || 0
  const gait = t * QUADRUPED_GAIT.strideRate
  const idle = 1 - gain

  let y = Math.abs(Math.sin(gait)) * QUADRUPED_GAIT.bob * gain
    + Math.sin(t * QUADRUPED_GAIT.idleRate) * QUADRUPED_GAIT.idleBob * idle
  let z = Math.cos(gait * 2) * QUADRUPED_GAIT.surge * gain
  let pitch = Math.sin(gait * 2) * QUADRUPED_GAIT.pitch * gain
    + Math.sin(t * QUADRUPED_GAIT.idleRate * 0.8) * 0.01 * idle
  const roll = Math.sin(gait) * QUADRUPED_GAIT.roll * gain

  if (Number.isFinite(attackT)) {
    const at = clamp01(attackT)
    const rear = ease(clamp01(at / QUADRUPED_ATTACK.rearUntil))
    const strike = at > QUADRUPED_ATTACK.rearUntil
      ? ease(clamp01((at - QUADRUPED_ATTACK.rearUntil) / QUADRUPED_ATTACK.strikeSpan))
      : 0
    const settle = 1 - ease(clamp01((at - 0.75) / 0.25))
    pitch += (-rear * QUADRUPED_ATTACK.rearPitch + strike * QUADRUPED_ATTACK.strikePitch) * settle
    y += (rear * QUADRUPED_ATTACK.rearLift - strike * 0.05) * settle
    z += (-rear * QUADRUPED_ATTACK.drawBack + strike * QUADRUPED_ATTACK.strikeLunge) * settle
  }

  if (Number.isFinite(jumpT)) {
    const arc = Math.sin(clamp01(jumpT) * Math.PI)
    y += arc * QUADRUPED_JUMP.height
    pitch -= arc * QUADRUPED_JUMP.tuckPitch
  }

  return { y, z, pitch, roll }
}

/** Write a pose onto a bodyPivot-like object (three.js Object3D or a stub). */
export function applyQuadrupedPose(pivot, pose) {
  if (!pivot?.position || !pivot.rotation) return
  pivot.position.y = pose.y
  pivot.position.z = pose.z
  pivot.rotation.x = pose.pitch
  pivot.rotation.z = pose.roll
}

/** True when a body was built from a rigid sculpt instead of the capsule rig. */
export function isQuadrupedBody(pivot) {
  return Boolean(pivot?.userData?.quadruped)
}

/**
 * Showcase/idle animation shared by the home lineup and any caller that only
 * has a clock: crawls in place while `moving`, breathes otherwise.
 */
export function animateQuadruped(pivot, { time = 0, moving = 0, attackT = null, jumpT = null } = {}) {
  if (!isQuadrupedBody(pivot)) return false
  applyQuadrupedPose(pivot, quadrupedPose({ time, moving, attackT, jumpT }))
  return true
}
