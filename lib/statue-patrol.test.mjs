import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyStatueAltitude,
  initStatuePatrol,
  statueFindPath,
  statueHitsWall,
  statueNearestWalkable,
  statuePlanLeg,
  statueWorldXZ,
  updateStatuePatrol,
} from './statue-patrol.js'

function wallMap(keys) {
  const m = new Map()
  for (const key of keys) m.set(key, {})
  return m
}

test('statueWorldXZ reads Three Vector3 x/z, never gx/gy', () => {
  const xz = statueWorldXZ({ position: { x: 44.5, y: 0, z: 10.5 } })
  assert.equal(xz.gx, 44.5)
  assert.equal(xz.gz, 10.5)
  const missing = statueWorldXZ({ position: {} })
  assert.equal(missing.gx, 0)
  assert.equal(missing.gz, 0)
})

test('initStatuePatrol keeps a finite plinth even if callers pass garbage', () => {
  const p = initStatuePatrol(undefined, undefined, 0, 0, 0)
  assert.equal(p.baseGx, 0)
  assert.equal(p.baseGz, 0)
  assert.equal(p.currentGx, 0)
  assert.equal(p.currentGz, 0)
})

test('statueFindPath walks around a wall instead of hopping through it', () => {
  const keys = []
  for (let row = 6; row <= 18; row++) keys.push(`${row},12`)
  const cellMap = wallMap(keys)
  const path = statueFindPath(8.5, 10.5, 16.5, 10.5, cellMap, null)
  assert.ok(path && path.length > 2)
  for (const step of path) {
    assert.equal(statueHitsWall(step.gx, step.gz, cellMap, null), false)
  }
  const last = path[path.length - 1]
  assert.ok(Math.abs(last.gx - 16.5) < 0.01)
  assert.ok(Math.abs(last.gz - 10.5) < 0.01)
})

test('statueFindPath stays in a pocket instead of teleporting through walls', () => {
  const keys = []
  for (let row = 8; row <= 12; row++) {
    for (let col = 8; col <= 12; col++) {
      if (row === 8 || row === 12 || col === 8 || col === 12) keys.push(`${row},${col}`)
    }
  }
  const cellMap = wallMap(keys)
  const path = statueFindPath(10.5, 10.5, 30.5, 30.5, cellMap, null)
  assert.ok(path)
  for (const step of path) {
    assert.equal(statueHitsWall(step.gx, step.gz, cellMap, null), false)
    assert.ok(step.gx > 8 && step.gx < 12)
    assert.ok(step.gz > 8 && step.gz < 12)
  }
})

test('statueNearestWalkable steps off a blocked cell', () => {
  const cellMap = wallMap(['10,10'])
  const free = statueNearestWalkable(10.5, 10.5, cellMap, null)
  assert.equal(statueHitsWall(free.gx, free.gz, cellMap, null), false)
})

test('statuePlanLeg never writes NaN targets', () => {
  const p = initStatuePatrol(44.5, 10.5, 1.2, 0, 0.35)
  p.currentGx = Number.NaN
  p.currentGz = Number.NaN
  statuePlanLeg(p, 4.5, 4.5, new Map(), null)
  assert.ok(Number.isFinite(p.currentGx))
  assert.ok(Number.isFinite(p.targetGx))
  assert.ok(Number.isFinite(p.targetGz))
})

test('after gazing the statue returns toward a finite plinth', () => {
  const root = { position: { x: 6, y: 0, z: 6 }, rotation: { y: 0 } }
  const p = initStatuePatrol(44.5, 10.5, 0, 0, 0.35)
  p.phase = 'gazing'
  p.gazeStartT = 0
  p.currentGx = 6
  p.currentGz = 6
  const motion = {
    patrol: p,
    root,
    mapId: '1',
    bodyPivot: { userData: {}, position: { y: 0 } },
  }
  updateStatuePatrol(motion, 11, 0.016, new Map(), null)
  assert.equal(p.phase, 'returning')
  assert.equal(p.baseGx, 44.5)
  assert.equal(p.baseGz, 10.5)
  assert.ok(Number.isFinite(p.targetGx) && Number.isFinite(p.targetGz))
  assert.ok(Number.isFinite(root.position.x) && Number.isFinite(root.position.z))
})

test('idle statues stand on the plinth deck, walkers drop to the floor once they leave', () => {
  const pivot = { userData: { baseY: 0.2 }, position: { y: 0 } }
  const p = initStatuePatrol(44.5, 10.5, 0)
  const motion = { patrol: p, bodyPivot: pivot }
  applyStatueAltitude(motion, p)
  assert.equal(pivot.position.y, 0.2)
  assert.equal(pivot.userData.strideFloorY, undefined)

  p.phase = 'walking'
  p.currentGx = 20
  p.currentGz = 20
  applyStatueAltitude(motion, p)
  assert.equal(pivot.position.y, 0)
  assert.equal(pivot.userData.strideFloorY, 0)

  p.currentGx = 44.6
  p.currentGz = 10.6
  applyStatueAltitude(motion, p)
  assert.equal(pivot.position.y, 0.2)
  assert.equal(pivot.userData.strideFloorY, 0.2)
})
