import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BOSS_HEAD_MAP_TEXTURE_FLIP_Y,
  BOSS_HEAD_MAP_FRONT_U,
  BOSS_HEAD_MAP_FACE_V0,
  BOSS_HEAD_MAP_FACE_V_SPAN,
  headMapUvToPortraitNormalized,
} from './boss-head-photo.js'

test('boss head map texture uses flipY for SphereGeometry north pole', () => {
  assert.equal(BOSS_HEAD_MAP_TEXTURE_FLIP_Y, true)
})

test('headMapUvToPortraitNormalized maps front centre to portrait centre', () => {
  const midV = BOSS_HEAD_MAP_FACE_V0 + BOSS_HEAD_MAP_FACE_V_SPAN * 0.5
  const sample = headMapUvToPortraitNormalized(BOSS_HEAD_MAP_FRONT_U, midV)
  assert.ok(sample)
  assert.ok(Math.abs(sample.px - 0.5) < 0.001)
  assert.ok(Math.abs(sample.py - 0.5) < 0.001)
})

test('headMapUvToPortraitNormalized keeps forehead above chin on the baked map', () => {
  const brow = headMapUvToPortraitNormalized(BOSS_HEAD_MAP_FRONT_U, BOSS_HEAD_MAP_FACE_V0)
  const chin = headMapUvToPortraitNormalized(
    BOSS_HEAD_MAP_FRONT_U,
    BOSS_HEAD_MAP_FACE_V0 + BOSS_HEAD_MAP_FACE_V_SPAN,
  )
  assert.ok(brow && chin)
  assert.ok(brow.py < chin.py, 'forehead py must be less than chin py before GPU flipY')
})

test('headMapUvToPortraitNormalized rejects samples off the face shell', () => {
  assert.equal(headMapUvToPortraitNormalized(0.2, 0.5), null)
  assert.equal(headMapUvToPortraitNormalized(BOSS_HEAD_MAP_FRONT_U, 0.02), null)
})
