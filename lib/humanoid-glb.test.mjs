import test from 'node:test'
import assert from 'node:assert/strict'
import {
  HUMANOID_GLB_CROWN_Y,
  HUMANOID_GLB_SRC_YMIN,
  HUMANOID_GLB_SRC_YMAX,
  HUMANOID_GLB_SRC_NECK_Y,
  humanoidGlbFit,
  triangleIsHead,
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
