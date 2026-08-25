import test from 'node:test'
import assert from 'node:assert/strict'
import {
  QUADRUPED_ATTACK,
  QUADRUPED_GAIT,
  QUADRUPED_JUMP,
  animateQuadruped,
  applyQuadrupedPose,
  isQuadrupedBody,
  quadrupedPose,
} from './quadruped-motion.js'

function pivot(quadruped = true) {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    userData: quadruped ? { quadruped: true } : {},
  }
}

function samples(state, count = 240, span = 4) {
  const out = []
  for (let i = 0; i < count; i += 1) out.push(quadrupedPose({ ...state, time: (i / count) * span }))
  return out
}

test('a stopped body only breathes', () => {
  for (const pose of samples({ moving: 0 })) {
    assert.ok(Math.abs(pose.y) <= QUADRUPED_GAIT.idleBob + 1e-9)
    assert.equal(Math.abs(pose.roll), 0)
    assert.equal(Math.abs(pose.z), 0)
    assert.ok(Math.abs(pose.pitch) <= 0.011)
  }
})

test('crawling never sinks below the ground and stays inside the gait envelope', () => {
  const poses = samples({ moving: 1 })
  for (const pose of poses) {
    assert.ok(pose.y >= -1e-9, 'the body rises off the stride, never through the floor')
    assert.ok(pose.y <= QUADRUPED_GAIT.bob + 1e-9)
    assert.ok(Math.abs(pose.roll) <= QUADRUPED_GAIT.roll + 1e-9)
    assert.ok(Math.abs(pose.z) <= QUADRUPED_GAIT.surge + 1e-9)
    assert.ok(Math.abs(pose.pitch) <= QUADRUPED_GAIT.pitch + 1e-9)
  }
  assert.ok(
    poses.some((pose) => Math.abs(pose.pitch) > QUADRUPED_GAIT.pitch * 0.5),
    'the shoulders rock fore and aft',
  )
  assert.ok(
    poses.some((pose) => Math.abs(pose.roll) > QUADRUPED_GAIT.roll * 0.5),
    'the weight rolls between the left and right pair',
  )
})

test('gait amplitude scales with speed', () => {
  const peak = (moving) => samples({ moving }).reduce((max, pose) => Math.max(max, pose.y), 0)
  assert.ok(peak(0.5) < peak(1))
  assert.ok(peak(1) > QUADRUPED_GAIT.bob * 0.9)
})

test('the attack rears up first, then slams forward', () => {
  const rear = quadrupedPose({ time: 0, moving: 0, attackT: QUADRUPED_ATTACK.rearUntil * 0.9 })
  const slam = quadrupedPose({ time: 0, moving: 0, attackT: QUADRUPED_ATTACK.rearUntil + QUADRUPED_ATTACK.strikeSpan })
  assert.ok(rear.pitch < -0.3, 'nose up while rearing')
  assert.ok(rear.y > 0.05, 'front end lifts off the ground')
  assert.ok(rear.z < 0, 'draws back before striking')
  assert.ok(slam.pitch > 0.1, 'nose slams down on the strike')
  assert.ok(slam.z > 0.15, 'lunges forward at the target')
})

test('the attack settles back to the gait by the end of its window', () => {
  const end = quadrupedPose({ time: 0, moving: 0, attackT: 1 })
  const idle = quadrupedPose({ time: 0, moving: 0 })
  assert.ok(Math.abs(end.pitch - idle.pitch) < 1e-9)
  assert.ok(Math.abs(end.z - idle.z) < 1e-9)
})

test('a jump arcs up and comes back down', () => {
  const takeoff = quadrupedPose({ time: 0, moving: 1, jumpT: 0 })
  const apex = quadrupedPose({ time: 0, moving: 1, jumpT: 0.5 })
  const landing = quadrupedPose({ time: 0, moving: 1, jumpT: 1 })
  assert.ok(Math.abs(apex.y - takeoff.y - QUADRUPED_JUMP.height) < 1e-9)
  assert.ok(Math.abs(landing.y - takeoff.y) < 1e-9)
  assert.ok(apex.pitch < takeoff.pitch, 'tucks at the apex')
})

test('poses are written onto the pivot', () => {
  const host = pivot()
  applyQuadrupedPose(host, { y: 0.2, z: -0.1, pitch: 0.3, roll: -0.4 })
  assert.equal(host.position.y, 0.2)
  assert.equal(host.position.z, -0.1)
  assert.equal(host.rotation.x, 0.3)
  assert.equal(host.rotation.z, -0.4)
})

test('animateQuadruped only drives sculpt bodies', () => {
  const capsule = pivot(false)
  assert.equal(isQuadrupedBody(capsule), false)
  assert.equal(animateQuadruped(capsule, { time: 1, moving: 1 }), false)
  assert.equal(capsule.position.y, 0)

  const sculpt = pivot()
  assert.equal(animateQuadruped(sculpt, { time: 1, moving: 1 }), true)
  assert.ok(sculpt.position.y > 0 || sculpt.rotation.z !== 0)
})

test('bad input never produces NaN', () => {
  const pose = quadrupedPose({ time: NaN, moving: 'fast', attackT: null, jumpT: undefined })
  for (const value of Object.values(pose)) assert.ok(Number.isFinite(value))
})
