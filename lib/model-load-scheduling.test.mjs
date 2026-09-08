import test from 'node:test'
import assert from 'node:assert/strict'
import { loadVisibleModel, openModelLoadGate, cancelModelLoadGate } from './model-load-scheduling.js'

const makeGate = () => ({ open: false, cancelled: false, pending: [] })
test('hidden carousel descendants do not fetch/decode until visible, once only', async () => {
  const gate = makeGate()
  let loads = 0
  const host = { parent: { userData: { modelLoadGate: gate } } }
  const result = loadVisibleModel(host, () => { loads++; return 'model' })
  await Promise.resolve()
  assert.equal(loads, 0)
  openModelLoadGate(gate)
  openModelLoadGate(gate)
  assert.equal(await result, 'model')
  assert.equal(loads, 1)
})
// Mirrors the real mount order: attach* helpers call in while the scene graph
// is still being built, and HomeMiningWorld3D only hangs the gate on each
// lineup group afterwards. Without the microtask hop in loadVisibleModel the
// walk would run too early, find no gate, and fetch every hidden model.
test('a gate attached later in the same tick still defers the load', async () => {
  const gate = makeGate()
  const host = { userData: {} }
  let loads = 0
  const result = loadVisibleModel(host, () => { loads++; return 'model' })
  host.userData.modelLoadGate = gate
  await Promise.resolve()
  assert.equal(loads, 0)
  openModelLoadGate(gate)
  assert.equal(await result, 'model')
  assert.equal(loads, 1)
})
test('unmount cancels pending models without starting their requests', async () => {
  const gate = makeGate()
  const result = loadVisibleModel({ userData: { modelLoadGate: gate } }, () => assert.fail('must not fetch'))
  await Promise.resolve()
  cancelModelLoadGate(gate)
  openModelLoadGate(gate)
  assert.equal(await result, null)
})
test('mining mounts and open carousel entries start normally and propagate failures', async () => {
  assert.equal(await loadVisibleModel({}, () => 'ready'), 'ready')
  const gate = makeGate()
  openModelLoadGate(gate)
  await assert.rejects(loadVisibleModel({userData:{modelLoadGate:gate}}, () => Promise.reject(new Error('offline'))), /offline/)
})
