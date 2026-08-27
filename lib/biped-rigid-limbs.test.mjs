import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BIPED_LIMB_IDS,
  PUTIN_BIPED_PROFILE,
  classifyStandingBipedVertex,
  splitBipedGeometry,
} from './biped-rigid-limbs.js'

test('standing biped: outer arms and legs classify off the torso', () => {
  assert.equal(classifyStandingBipedVertex(-0.25, 0.55, 0, PUTIN_BIPED_PROFILE), 'la')
  assert.equal(classifyStandingBipedVertex(0.25, 0.55, 0, PUTIN_BIPED_PROFILE), 'ra')
  assert.equal(classifyStandingBipedVertex(-0.12, 0.2, 0, PUTIN_BIPED_PROFILE), 'll')
  assert.equal(classifyStandingBipedVertex(0.12, 0.2, 0, PUTIN_BIPED_PROFILE), 'rl')
})

test('chest and head stay on the rigid torso', () => {
  assert.equal(classifyStandingBipedVertex(0, 0.9, 0, PUTIN_BIPED_PROFILE), 'torso')
  assert.equal(classifyStandingBipedVertex(0.05, 0.6, 0, PUTIN_BIPED_PROFILE), 'torso')
})

test('splitBipedGeometry keeps uvs on textured shells', () => {
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
    -0.25, 0.5, 0,
    -0.22, 0.45, 0.02,
    -0.28, 0.48, -0.02,
    0, 0.9, 0,
    0.05, 0.92, 0,
    -0.05, 0.88, 0,
  ]
  const uvs = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]
  const geometry = {
    attributes: {
      position: new Attr(positions, 3),
      normal: new Attr([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3),
      uv: new Attr(uvs, 2),
    },
    index: new Idx([0, 1, 2, 3, 4, 5]),
  }
  const parts = splitBipedGeometry(THREE, geometry)
  assert.ok(parts.la)
  assert.ok(parts.torso)
  assert.ok(parts.la.attributes.uv)
  assert.equal(parts.la.attributes.uv.count, 3)
  assert.equal(parts.la.index.count, 3)
  for (const id of BIPED_LIMB_IDS) {
    if (id === 'la') continue
    assert.equal(parts[id], null)
  }
})
