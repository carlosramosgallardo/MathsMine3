/**
 * Defer hidden carousel entries and bound concurrent model fetch/decode work.
 *
 * The microtask hop is load-bearing, not stylistic: attach* helpers run while
 * the scene graph is still being built, so `host` is not yet under the group
 * that carries the gate, and the walk below would find nothing and load
 * eagerly. Deferring to a microtask lets the caller's synchronous setup finish
 * (parenting included) before we look for a gate. Inline this and every hidden
 * model silently starts fetching again.
 */
const ready = []
let activeLoads = 0
let pumpScheduled = false

function scheduleLoads() {
  if (pumpScheduled) return
  pumpScheduled = true
  // Yield between batches so cached models cannot all decode in one microtask chain.
  setTimeout(() => {
    pumpScheduled = false
    while (activeLoads < 2 && ready.length) {
      const job = ready.shift()
      if (job.gate?.cancelled) {
        job.resolve(null)
        continue
      }
      activeLoads += 1
      Promise.resolve().then(job.load).then(job.resolve, job.reject).finally(() => {
        activeLoads -= 1
        if (ready.length) scheduleLoads()
      })
    }
  }, 0)
}

function enqueueModel(load, gate) {
  return new Promise((resolve, reject) => {
    ready.push({ load, gate, resolve, reject })
    scheduleLoads()
  })
}

export function loadVisibleModel(host, load) {
  return Promise.resolve().then(() => {
    for (let node = host; node; node = node.parent) {
      const gate = node.userData?.modelLoadGate
      if (!gate) continue
      if (gate.cancelled) return null
      if (gate.open) return enqueueModel(load, gate)
      return new Promise((resolve, reject) => {
        gate.pending.push({ load, resolve, reject })
      })
    }
    return enqueueModel(load)
  })
}

export function openModelLoadGate(gate) {
  if (!gate || gate.cancelled || gate.open) return
  gate.open = true
  for (const job of gate.pending.splice(0)) enqueueModel(job.load, gate).then(job.resolve, job.reject)
}

export function cancelModelLoadGate(gate) {
  if (!gate) return
  gate.cancelled = true
  for (const job of gate.pending.splice(0)) job.resolve(null)
}

export function createModelLoadGate() {
  return { open: false, cancelled: false, pending: [] }
}

/**
 * Open the gates of every entry within `radius` of (gx, gz). Mining keeps a
 * character's voxel stand-in (already on screen) until the player is close
 * enough for the model to matter; at ~26 cells inside a 768×480 framebuffer a
 * figure is ~30px tall and the stand-in is indistinguishable. Gates never
 * close again: a loaded model stays loaded.
 */
export function syncProximityGates(entries, gx, gz, radius) {
  const limit = radius * radius
  let opened = 0
  for (const entry of entries) {
    const gate = entry.gate
    if (!gate || gate.open || gate.cancelled) continue
    const dx = entry.group.position.x - gx, dz = entry.group.position.z - gz
    if (dx * dx + dz * dz > limit) continue
    openModelLoadGate(gate)
    opened += 1
  }
  return opened
}
