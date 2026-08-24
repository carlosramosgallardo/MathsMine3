import test from 'node:test'
import assert from 'node:assert/strict'
import {
  HUMANOID_GLB_CROWN_Y,
  HUMANOID_GLB_SRC_YMIN,
  HUMANOID_GLB_SRC_YMAX,
  HUMANOID_GLB_SRC_NECK_Y,
  humanoidGlbFit,
  triangleIsHead,
  glbSourceToParent,
  findHandAnchors,
} from './humanoid-glb.js'

test('humanoidGlbFit puts feet at y=0 and crown at 1.075', () => {
  const { scale, offsetY } = humanoidGlbFit()
  const feet = HUMANOID_GLB_SRC_YMIN * scale + offsetY
  const crown = HUMANOID_GLB_SRC_YMAX * scale + offsetY
  assert.ok(Math.abs(feet) < 0.001)
  assert.ok(Math.abs(crown - HUMANOID_GLB_CROWN_Y) < 0.001)
})

test('humanoidGlbFit keeps half-width under the 0.38 hit bound', () => {
  const { scale } = humanoidGlbFit()
  assert.ok(0.197 * scale < 0.38)
})

test('triangleIsHead splits at the neck, not the chest', () => {
  assert.equal(triangleIsHead(0.40, 0.41, 0.42, HUMANOID_GLB_SRC_NECK_Y), true)
  assert.equal(triangleIsHead(0.00, 0.02, -0.01, HUMANOID_GLB_SRC_NECK_Y), false)
  const { scale, offsetY } = humanoidGlbFit()
  const neckWorld = HUMANOID_GLB_SRC_NECK_Y * scale + offsetY
  assert.ok(neckWorld > 0.72)
  assert.ok(neckWorld < HUMANOID_GLB_CROWN_Y)
})

test('glbSourceToParent yaws the scan so the face matches −Z heads', () => {
  const { scale, offsetY } = humanoidGlbFit()
  const nose = glbSourceToParent({ x: 0, y: 0.4, z: 0.12 }, { scale, offsetY, bulk: 1 })
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
