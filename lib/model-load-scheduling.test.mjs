import test from 'node:test'
import assert from 'node:assert/strict'
import { loadVisibleModel, openModelLoadGate, cancelModelLoadGate, createModelLoadGate, syncProximityGates } from './model-load-scheduling.js'

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

test('model batches limit concurrent decoding and continue after a failed load', async () => {
  let active = 0
  let peak = 0
  const jobs = Array.from({ length: 6 }, (_, i) => loadVisibleModel({}, async () => {
    active++
    peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active--
    if (i === 1) throw new Error('bad model')
    return i
  }))
  const results = await Promise.allSettled(jobs)
  assert.equal(peak, 2)
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 5)
  assert.equal(results[1].status, 'rejected')
})

test('navigation cancels even an opened gate before its queued load starts', async () => {
  const gate = makeGate()
  const result = loadVisibleModel({ userData: { modelLoadGate: gate } }, () => assert.fail('cancelled model fetched'))
  await Promise.resolve()
  openModelLoadGate(gate)
  cancelModelLoadGate(gate)
  assert.equal(await result, null)
})

test('syncProximityGates opens only the gates within radius, and never re-closes them', async () => {
  const near = { group: { position: { x: 10, z: 10 } }, gate: createModelLoadGate() }
  const far = { group: { position: { x: 60, z: 10 } }, gate: createModelLoadGate() }
  let loads = 0
  const result = loadVisibleModel({ userData: { modelLoadGate: near.gate } }, () => { loads++; return 'near' })
  loadVisibleModel({ userData: { modelLoadGate: far.gate } }, () => assert.fail('far model must not fetch'))
  await Promise.resolve()
  assert.equal(syncProximityGates([near, far], 12, 12, 26), 1)
  assert.equal(await result, 'near')
  assert.equal(loads, 1)
  assert.equal(far.gate.open, false)
  // Walking away does not unload: the near gate stays open.
  assert.equal(syncProximityGates([near, far], 200, 200, 26), 0)
  assert.equal(near.gate.open, true)
})
