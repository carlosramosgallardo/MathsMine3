import test from 'node:test'
import assert from 'node:assert/strict'
import { unitRandom } from './game-random.js'

test('unitRandom returns a number in [0, 1)', () => {
  for (let i = 0; i < 32; i += 1) {
    const n = unitRandom()
    assert.equal(typeof n, 'number')
    assert.ok(n >= 0)
    assert.ok(n < 1)
  }
})

test('unitRandom is not a constant stream', () => {
  const seen = new Set(Array.from({ length: 8 }, () => unitRandom()))
  assert.ok(seen.size > 1)
})
