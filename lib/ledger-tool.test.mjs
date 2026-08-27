import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LEDGER_REST,
  ledgerTipEuler,
  poseLedgerSwing,
} from './ledger-tool.js'

test('ledgerTipEuler leaves a vertical stick unpitched', () => {
  const e = ledgerTipEuler(0, 1, 0)
  assert.ok(Math.abs(e.x) < 1e-9)
  assert.ok(Math.abs(e.z) < 1e-9)
})

test('ledgerTipEuler leans the tip toward +X (out) and −Z (forward)', () => {
  const out = ledgerTipEuler(0.4, 1, 0)
  assert.ok(out.z < 0, 'positive X aim rolls the blade outward')
  const fwd = ledgerTipEuler(0, 1, -0.4)
  assert.ok(fwd.x < 0, 'negative Z aim pitches the blade forward')
})

test('poseLedgerSwing rest is the upright sword hold', () => {
  const tool = { rotation: { x: 0, y: 0, z: 0 } }
  poseLedgerSwing(tool, { swing: 0 })
  assert.equal(tool.rotation.x, LEDGER_REST.x)
  assert.equal(tool.rotation.y, LEDGER_REST.y)
  assert.equal(tool.rotation.z, LEDGER_REST.z)
})

test('poseLedgerSwing cut aims the tip toward the look direction', () => {
  const rest = { rotation: { x: 0, y: 0, z: 0 } }
  const cut = { rotation: { x: 0, y: 0, z: 0 } }
  poseLedgerSwing(rest, { swing: 0 })
  poseLedgerSwing(cut, { swing: 1, aimX: 0, aimY: 0.2, aimZ: -1 })
  assert.ok(cut.rotation.x < rest.rotation.x, 'full swing pitches the tip toward the mira')
})
