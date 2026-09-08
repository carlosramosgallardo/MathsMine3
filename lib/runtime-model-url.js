/**
 * Single source of truth for which models have an optimized derivative: the
 * offline generator (scripts/model-tools/optimize.mjs) and the test that
 * guards against a missing .runtime.glb both read this list, so adding a name
 * here is enough to pull it into both.
 */
export const RUNTIME_MODEL_NAMES = [
  'kim', 'putin', 'trump', 'macron', 'zelenski', 'milei', 'milei-figure',
  'rl-car', 'man', 'man-head', 'tool-usb', 'nuclear',
]

const RUNTIME_MODELS = new Set(RUNTIME_MODEL_NAMES)

/** Optimized derivatives preserve bones, node names and UVs; source assets remain available. */
export function runtimeModelUrl(url) {
  const match = /^\/models\/([a-z-]+)\.glb$/.exec(String(url))
  return match && RUNTIME_MODELS.has(match[1]) ? `/models/${match[1]}.runtime.glb` : url
}
