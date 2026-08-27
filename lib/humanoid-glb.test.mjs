import test from 'node:test'
import assert from 'node:assert/strict'
import {
  HUMANOID_GLB_CROWN_Y,
  HUMANOID_GLB_SRC_YMIN,
  HUMANOID_GLB_SRC_YMAX,
  HUMANOID_GLB_SRC_NECK_Y,
  HUMANOID_GLB_SRC_TORSO_HALF_X,
  humanoidGlbFit,
  humanoidGlbHeadBounds,
  humanoidGlbHitBounds,
  humanoidGlbNeckY,
  triangleIsHead,
  glbSourceToParent,
  findHandAnchors,
  humanoidGlbHandSpan,
  glbLimbFromCapsule,
  syncHumanoidGlbPose,
  pickHumanoidGlbClip,
  posePlazaArmIdle,
  PLAZA_ARM_IDLE,
} from './humanoid-glb.js'

function arm(x, z, baseRotZ = 0) {
  return { rotation: { x, z }, userData: { baseRotZ } }
}

function hostWith(lArm, rArm, lLeg = { rotation: { x: 0 } }, rLeg = { rotation: { x: 0 } }) {
  return { userData: { humanArms: [lArm, rArm], humanLegs: [lLeg, rLeg] } }
}

test('glbLimbFromCapsule flips pitch so plugs aim parent −Z after the scan yaw', () => {
  const rest = glbLimbFromCapsule({ x: 0, z: 0.09 }, 0.09)
  assert.ok(Math.abs(rest.x) < 1e-12)
  assert.ok(Math.abs(rest.z) < 1e-12)
  const point = glbLimbFromCapsule({ x: 0.85, z: 0.09 - 1.22 + 0.58 }, 0.09)
  assert.ok(Math.abs(point.x + 0.85) < 1e-9)
  assert.ok(point.x < 0, 'forward capsule pitch becomes bone −X inside the yawed fit')
  assert.ok(Math.abs(point.z - (1.22 - 0.58)) < 1e-9)
})

test('syncHumanoidGlbPose copies capsule pitch onto identity-rest arm bones', () => {
  const bone = { rotation: { x: 0, z: 0 } }
  const rArm = { rotation: { x: 0.85, z: 0.09 }, userData: { baseRotZ: 0.09 } }
  const host = {
    userData: {
      humanoidGlbBones: { RightUpperArm: bone },
      humanArms: [{ rotation: { x: 0, z: 0 }, userData: {} }, rArm],
    },
  }
  syncHumanoidGlbPose(host)
  assert.ok(Math.abs(bone.rotation.x + 0.85) < 1e-9)
  assert.ok(Math.abs(bone.rotation.z) < 1e-12)
})

test('pickHumanoidGlbClip maps capsule poses onto named GLB clips', () => {
  assert.equal(pickHumanoidGlbClip({}), 'idle')
  assert.equal(pickHumanoidGlbClip(hostWith(arm(0, 0.09, 0.09), arm(0, 0.09, 0.09))), 'idle')
  assert.equal(pickHumanoidGlbClip(hostWith(
    arm(0, 0.09, 0.09),
    arm(0, 0.09, 0.09),
    { rotation: { x: 0.4 } },
    { rotation: { x: -0.4 } },
  )), 'walk')
  assert.equal(pickHumanoidGlbClip(hostWith(
    arm(0.38, 2.35),
    arm(0.38, -2.35),
    { rotation: { x: -0.55 } },
    { rotation: { x: -0.55 } },
  )), 'jump_flail')
  assert.equal(pickHumanoidGlbClip(hostWith(
    arm(0, 0.09, 0.09),
    arm(0.85, 0.09 - 1.22 + 0.58, 0.09),
  )), 'point_forward')
  assert.equal(pickHumanoidGlbClip(hostWith(
    arm(0.04, 0.09, 0.09),
    arm(2.0, 0.09 - 1.1, 0.09),
  )), 'salute_right')
})

test('humanoidGlbFit puts feet at y=0 and crown at 1.075', () => {
  const { scale, offsetY } = humanoidGlbFit()
  const feet = HUMANOID_GLB_SRC_YMIN * scale + offsetY
  const crown = HUMANOID_GLB_SRC_YMAX * scale + offsetY
  assert.ok(Math.abs(feet) < 0.001)
  assert.ok(Math.abs(crown - HUMANOID_GLB_CROWN_Y) < 0.001)
})

test('humanoidGlbFit keeps torso half-width under the 0.38 hit bound', () => {
  const { scale } = humanoidGlbFit()
  assert.ok(HUMANOID_GLB_SRC_TORSO_HALF_X * scale < 0.38)
})

test('humanoidGlbHeadBounds matches the mesh skull, not the old mask cube', () => {
  const skull = humanoidGlbHeadBounds(1)
  const neck = humanoidGlbNeckY()
  assert.ok(Math.abs(skull.height - (HUMANOID_GLB_CROWN_Y - neck)) < 0.02)
  assert.ok(skull.width < 0.18)
  assert.ok(skull.depth < 0.18)
  assert.ok(skull.height < 0.22)
  assert.ok(skull.centerY > neck)
  assert.ok(skull.centerY < HUMANOID_GLB_CROWN_Y)
})

test('humanoidGlbHitBounds uses the fitted crown and neck', () => {
  const bounds = humanoidGlbHitBounds(0.38)
  assert.equal(bounds.headTop, HUMANOID_GLB_CROWN_Y)
  assert.equal(bounds.headBottom, humanoidGlbNeckY())
  assert.equal(bounds.halfWidth, 0.38)
})

test('humanoidGlbHeadBounds bulk widens X/Z only', () => {
  const slim = humanoidGlbHeadBounds(1)
  const wide = humanoidGlbHeadBounds(1.14)
  assert.ok(Math.abs(wide.height - slim.height) < 1e-9)
  assert.ok(wide.width > slim.width)
  assert.ok(wide.depth > slim.depth)
})

test('triangleIsHead splits at the neck, not the chest', () => {
  assert.equal(triangleIsHead(1.70, 1.71, 1.72, HUMANOID_GLB_SRC_NECK_Y), true)
  assert.equal(triangleIsHead(0.50, 0.52, 0.48, HUMANOID_GLB_SRC_NECK_Y), false)
  const { scale, offsetY } = humanoidGlbFit()
  const neckWorld = HUMANOID_GLB_SRC_NECK_Y * scale + offsetY
  assert.ok(neckWorld > 0.72)
  assert.ok(neckWorld < HUMANOID_GLB_CROWN_Y)
})

test('glbSourceToParent yaws the mesh so the face matches −Z heads', () => {
  const { scale, offsetY } = humanoidGlbFit()
  const nose = glbSourceToParent({ x: 0, y: 1.7, z: 0.12 }, { scale, offsetY, bulk: 1 })
  assert.ok(nose.z < 0, 'after 180° yaw the +Z chest/face lands on −Z')
})

test('findHandAnchors picks the higher wrist as the raised hand', () => {
  const packed = [
    0.18, 0.12, -0.10,
    -0.18, 0.28, 0.10,
  ]
  const hands = findHandAnchors(packed, 2)
  assert.equal(hands.raised, 'left')
  assert.ok(hands.left.y > hands.right.y)
})

test('findHandAnchors sits in the palm, not on the fingertip', () => {
  const packed = [
    -0.18, 0.22, 0.12,
    -0.16, 0.21, 0.10,
    -0.15, 0.20, 0.09,
    0.18, 0.12, -0.10,
    0.16, 0.11, -0.09,
    0.15, 0.10, -0.08,
  ]
  const hands = findHandAnchors(packed, 6)
  assert.ok(hands.left.x > -0.18, 'left palm is inward of the far tip')
  assert.ok(hands.right.x < 0.18, 'right palm is inward of the far tip')
})

test('humanoidGlbHandSpan matches the palm, not the old staff plug', () => {
  const span = humanoidGlbHandSpan(1)
  assert.ok(span > 0.04)
  assert.ok(span < 0.09)
  assert.ok(Math.abs(humanoidGlbHandSpan(1.14) / span - 1.14) < 1e-9)
})

test('posePlazaArmIdle cheer and wave pose the arms differently', () => {
  const bone = () => ({ rotation: { x: 0, y: 0, z: 0 } })
  const cheer = {
    LeftUpperArm: bone(), RightUpperArm: bone(),
    LeftLowerArm: bone(), RightLowerArm: bone(),
    LeftHand: bone(), RightHand: bone(),
  }
  const wave = {
    LeftUpperArm: bone(), RightUpperArm: bone(),
    LeftLowerArm: bone(), RightLowerArm: bone(),
    LeftHand: bone(), RightHand: bone(),
  }
  const okCheer = posePlazaArmIdle({
    userData: { plazaArmIdle: PLAZA_ARM_IDLE.zelenskyCheer, humanoidGlbBones: cheer },
  }, 0.4)
  const okWave = posePlazaArmIdle({
    userData: { plazaArmIdle: PLAZA_ARM_IDLE.macronWave, humanoidGlbBones: wave },
  }, 0.4)
  assert.equal(okCheer, true)
  assert.equal(okWave, true)
  assert.ok(Math.abs(cheer.LeftUpperArm.rotation.x - cheer.RightUpperArm.rotation.x) < 0.2)
  assert.ok(Math.abs(wave.LeftUpperArm.rotation.x - wave.RightUpperArm.rotation.x) > 0.8)
  assert.notEqual(cheer.RightLowerArm.rotation.z, wave.RightLowerArm.rotation.z)
})

test('posePlazaArmIdle ignores unknown styles and missing bones', () => {
  assert.equal(posePlazaArmIdle({ userData: {} }), false)
  assert.equal(posePlazaArmIdle({
    userData: { plazaArmIdle: 'nope', humanoidGlbBones: {} },
  }), false)
})
