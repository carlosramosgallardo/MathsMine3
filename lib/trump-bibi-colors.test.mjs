import test from 'node:test'
import assert from 'node:assert/strict'

import { isTrumpDollarBillVertex, trumpDollarBillRgb } from './trump-bibi-colors.js'

test('Trump fishing-line bill selects the baked card coordinates', () => {
  assert.equal(isTrumpDollarBillVertex(-0.38, 0.54, 0.94), true)
  assert.equal(isTrumpDollarBillVertex(-0.32, 0.82, 0.84), true)
})

test('Trump dollar mask excludes the rod, line, and nearby body', () => {
  assert.equal(isTrumpDollarBillVertex(-0.38, 1.8, 0.96), false)
  assert.equal(isTrumpDollarBillVertex(-0.38, 0.54, 0.7), false)
  assert.equal(isTrumpDollarBillVertex(0, 0.54, 0.94), false)
})

test('Trump bill colour is recognisably dollar green', () => {
  const [r, g, b] = trumpDollarBillRgb(0.6)
  assert.ok(g > r * 2.5)
  assert.ok(g > b * 2)
})
