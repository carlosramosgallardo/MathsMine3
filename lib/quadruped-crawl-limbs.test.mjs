import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TRUMP_CRAWL_JOINTS,
  TRUMP_CRAWL_LIMB_IDS,
  applyQuadrupedLimbPose,
  classifyTrumpCrawlVertex,
  quadrupedLimbPose,
  splitTrumpCrawlGeometry,
} from './quadruped-crawl-limbs.js'

test('front hands and rear shoes classify as opposite limb pairs', () => {
  assert.equal(classifyTrumpCrawlVertex(-0.4, 0.05, 0.6), 'fl')
  assert.equal(classifyTrumpCrawlVertex(0.4, 0.05, 0.6), 'fr')
  assert.equal(classifyTrumpCrawlVertex(-0.2, 0.12, -0.68), 'rl')
  assert.equal(classifyTrumpCrawlVertex(0.2, 0.12, -0.68), 'rr')
})

test('head and chest stay on the rigid torso', () => {
  assert.equal(classifyTrumpCrawlVertex(-0.1, 1.2, 0.55), 'torso')
  assert.equal(classifyTrumpCrawlVertex(0, 0.7, 0), 'torso')
  assert.equal(classifyTrumpCrawlVertex(0.02, 0.3, 0.4), 'torso')
})

test('contralateral crawl: FL swings with RR, FR with RL', () => {
  const pose = quadrupedLimbPose({ time: 0.2, moving: 1 })
  assert.ok(Math.abs(pose.fl.pitch - pose.rr.pitch) < 1e-9)
  assert.ok(Math.abs(pose.fr.pitch - pose.rl.pitch) < 1e-9)
  assert.ok(Math.abs(pose.fl.pitch + pose.fr.pitch) < 1e-9)
})

test('stopped crawl holds limbs still', () => {
  const pose = quadrupedLimbPose({ time: 1.5, moving: 0 })
  for (const id of TRUMP_CRAWL_LIMB_IDS) {
    assert.equal(Math.abs(pose[id].pitch), 0)
    assert.equal(Math.abs(pose[id].y), 0)
  }
})

test('applyQuadrupedLimbPose writes pitch and lift onto pivots', () => {
  const limbs = {}
  for (const id of TRUMP_CRAWL_LIMB_IDS) {
    limbs[id] = {
      rotation: { x: 0 },
      position: { y: TRUMP_CRAWL_JOINTS[id].y },
    }
  }
  const host = { userData: { quadrupedLimbs: limbs } }
  const pose = quadrupedLimbPose({ time: 0.25, moving: 1 })
  applyQuadrupedLimbPose(host, pose)
  for (const id of TRUMP_CRAWL_LIMB_IDS) {
    assert.equal(limbs[id].rotation.x, pose[id].pitch)
    assert.equal(limbs[id].position.y, TRUMP_CRAWL_JOINTS[id].y + pose[id].y)
  }
})

test('splitTrumpCrawlGeometry majority-votes triangles into rigid shells', () => {
  // Minimal Fake THREE BufferGeometry API
  class Attr {
    constructor(arr, itemSize) {
      this.array = Float32Array.from(arr)
      this.itemSize = itemSize
      this.count = arr.length / itemSize
    }
    getX(i) { return this.array[i * this.itemSize] }
    getY(i) { return this.array[i * this.itemSize + 1] }
    getZ(i) { return this.array[i * this.itemSize + 2] }
  }
  class Idx {
    constructor(arr) {
      this.array = Uint16Array.from(arr)
      this.count = arr.length
    }
    getX(i) { return this.array[i] }
  }
  const THREE = {
    BufferGeometry: class {
      constructor() { this.attributes = {}; this.index = null }
      setAttribute(name, attr) { this.attributes[name] = attr }
      setIndex(arr) { this.index = { count: arr.length, array: arr } }
      computeBoundingSphere() {}
    },
    Float32BufferAttribute: class {
      constructor(arr, itemSize) {
        this.array = Float32Array.from(arr)
        this.itemSize = itemSize
        this.count = arr.length / itemSize
      }
    },
  }

  const positions = [
    -0.4, 0.1, 0.55,
    -0.35, 0.05, 0.6,
    -0.3, 0.12, 0.5,
    0, 0.8, 0,
    0.05, 0.85, 0.05,
    -0.05, 0.82, -0.05,
  ]
  const normals = [
    0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0,
  ]
  const colors = new Array(18).fill(1)
  const geometry = {
    attributes: {
      position: new Attr(positions, 3),
      normal: new Attr(normals, 3),
      color: new Attr(colors, 3),
    },
    index: new Idx([0, 1, 2, 3, 4, 5]),
  }

  const parts = splitTrumpCrawlGeometry(THREE, geometry)
  assert.ok(parts.fl)
  assert.ok(parts.torso)
  assert.equal(parts.fl.index.count, 3)
  assert.equal(parts.torso.index.count, 3)
})
