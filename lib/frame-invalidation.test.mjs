import test from 'node:test'
import assert from 'node:assert/strict'
import { createFrameInvalidator } from './frame-invalidation.js'

function setup(t) {
  const names = ['document', 'requestAnimationFrame', 'cancelAnimationFrame']
  const saved = names.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  const events = new EventTarget()
  const doc = Object.assign(events, { hidden: false })
  const frames = new Map()
  let id = 0
  globalThis.document = doc
  globalThis.requestAnimationFrame = fn => { frames.set(++id, fn); return id }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  t.after(() => { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] } })
  return {
    frames,
    step(now) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(now)) },
    visibility(hidden) { doc.hidden = hidden; doc.dispatchEvent(new Event('visibilitychange')) },
  }
}

test('bursts of network and resize requests share one frame and leave no idle RAF', t => {
  const env = setup(t)
  let count = 0
  const draw = createFrameInvalidator(() => count++)
  for (let i = 0; i < 20; i++) draw.request()
  assert.equal(env.frames.size, 1)
  env.step(0)
  assert.equal(count, 1)
  assert.equal(env.frames.size, 0)
  draw.request()
  env.step(16)
  assert.equal(count, 1)
  env.step(34)
  assert.equal(count, 2)
  assert.equal(env.frames.size, 0)
  draw.dispose()
})

test('hidden updates render once on resume and never after disposal', t => {
  const env = setup(t)
  let count = 0
  const draw = createFrameInvalidator(() => count++)
  draw.request()
  env.visibility(true)
  for (let i = 0; i < 20; i++) draw.request()
  assert.equal(env.frames.size, 0)
  env.visibility(false)
  env.step(1000)
  assert.equal(count, 1)
  draw.request()
  draw.dispose()
  env.visibility(false)
  draw.request()
  assert.equal(env.frames.size, 0)
})
