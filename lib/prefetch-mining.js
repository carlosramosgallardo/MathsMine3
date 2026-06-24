let prefetchStarted = false

/** Warm /mining JS chunks + map snapshot before navigation (hover/focus). */
export function prefetchMiningRoute() {
  if (typeof window === 'undefined' || prefetchStarted) return
  prefetchStarted = true

  void fetch('/api/mining-snapshot?map=1', { priority: 'low' }).catch(() => {})
  void import('@/components/MiningChain3D').catch(() => {})
  void import('@/components/MiningChain3DFPV').catch(() => {})
}
