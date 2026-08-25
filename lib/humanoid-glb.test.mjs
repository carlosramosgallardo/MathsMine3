import test from 'node:test'
import assert from 'node:assert/strict'
import {
  HUMANOID_GLB_CROWN_Y,
  HUMANOID_GLB_SRC_YMIN,
  HUMANOID_GLB_SRC_YMAX,
  HUMANOID_GLB_SRC_NECK_Y,
  humanoidGlbFit,
  humanoidGlbHeadBounds,
  humanoidGlbHitBounds,
  humanoidGlbNeckY,
  triangleIsHead,
  glbSourceToParent,
  findHandAnchors,
  humanoidGlbHandSpan,
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

test('humanoidGlbHeadBounds matches the scanned skull, not the old mask cube', () => {
  const skull = humanoidGlbHeadBounds(1)
  const neck = humanoidGlbNeckY()
  assert.ok(Math.abs(skull.height - (HUMANOID_GLB_CROWN_Y - neck)) < 0.02)
  assert.ok(skull.width < 0.18)
  assert.ok(skull.depth < 0.18)
  assert.ok(skull.height < 0.22)
  assert.ok(skull.centerY > neck)
  assert.ok(skull.centerY < HUMANOID_GLB_CROWN_Y)
})

test('humanoidGlbHitBounds uses the scanned crown and neck', () => {
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

test('humanoidGlbHandSpan matches the scanned palm, not the old staff plug', () => {
  const span = humanoidGlbHandSpan(1)
  assert.ok(span > 0.04)
  assert.ok(span < 0.09)
  assert.ok(Math.abs(humanoidGlbHandSpan(1.14) / span - 1.14) < 1e-9)
})
