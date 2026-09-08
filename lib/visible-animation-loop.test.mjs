import test from 'node:test'
import assert from 'node:assert/strict'
import { startVisibleAnimationLoop } from './visible-animation-loop.js'

// Node has no DOM; restore every installed browser global after each case.
function setup(t, hidden = false) {
  const saved = new Map(['document', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const events = new EventTarget()
  const doc = { hidden, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) }
  let id = 0
  const pending = new Map()
  globalThis.document = doc
  globalThis.requestAnimationFrame = fn => { pending.set(++id, fn); return id }
  globalThis.cancelAnimationFrame = key => pending.delete(key)
  t.after(() => { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] } })
  return { pending, step(now) { const jobs = [...pending.values()]; pending.clear(); jobs.forEach(fn => fn(now)) }, visibility(hidden) { doc.hidden = hidden; events.dispatchEvent(new Event('visibilitychange')) } }
}

for (const refresh of [60, 120, 144, 240]) {
  test(`caps expensive work to 30 fps on a ${refresh} Hz display`, t => {
    const env = setup(t)
    let frames = 0
    const stop = startVisibleAnimationLoop(() => frames++)
    for (let n = 0; n < refresh * 10; n++) env.step(n * 1000 / refresh)
    assert.ok(frames >= 295 && frames <= 305, `${frames} frames in ten seconds`)
    stop()
    assert.equal(env.pending.size, 0)
  })
}

test('hidden pages stop scheduling, resume once, and stay stopped after unmount', t => {
  const env = setup(t, true)
  let frames = 0
  let pauses = 0
  const stop = startVisibleAnimationLoop(() => frames++, { onPause: () => pauses++ })
  assert.equal(env.pending.size, 0)
  env.visibility(false)
  env.visibility(false)
  assert.equal(env.pending.size, 1)
  env.step(0)
  assert.equal(frames, 1)
  env.visibility(true)
  assert.equal(env.pending.size, 0)
  assert.equal(pauses, 2)
  env.visibility(false)
  env.step(100000)
  assert.equal(frames, 2)
  stop()
  env.visibility(false)
  assert.equal(env.pending.size, 0)
})
