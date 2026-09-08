/**
 * Defer network/decode for hidden carousel entries; ordinary mining mounts start immediately.
 *
 * The microtask hop is load-bearing, not stylistic: attach* helpers run while
 * the scene graph is still being built, so `host` is not yet under the group
 * that carries the gate, and the walk below would find nothing and load
 * eagerly. Deferring to a microtask lets the caller's synchronous setup finish
 * (parenting included) before we look for a gate. Inline this and every hidden
 * model silently starts fetching again.
 */
export function loadVisibleModel(host, load) {
  return Promise.resolve().then(() => {
    for (let node = host; node; node = node.parent) {
      const gate = node.userData?.modelLoadGate
      if (!gate) continue
      if (gate.cancelled) return null
      if (gate.open) break
      return new Promise((resolve, reject) => {
        gate.pending.push({ load, resolve, reject })
      })
    }
    return load()
  })
}

export function openModelLoadGate(gate) {
  if (!gate || gate.cancelled || gate.open) return
  gate.open = true
  for (const job of gate.pending.splice(0)) Promise.resolve().then(job.load).then(job.resolve, job.reject)
}

export function cancelModelLoadGate(gate) {
  if (!gate) return
  gate.cancelled = true
  for (const job of gate.pending.splice(0)) job.resolve(null)
}
