/**
 * Single source of truth for which models ship an optimized derivative: the
 * offline generator (scripts/model-tools/optimize.mjs) and the test that
 * guards against a missing .runtime.glb both read this list, so adding a name
 * here is enough to pull it into both.
 */
export const RUNTIME_MODEL_NAMES = [
  'kim', 'putin', 'trump', 'macron', 'zelenski', 'milei-figure',
  'rl-car', 'man', 'tool-usb', 'nuclear',
]

const RUNTIME_MODELS = new Set(RUNTIME_MODEL_NAMES)

/**
 * One derivative serves Home and Mining alike: heavy decimation (~6–15% of the
 * source triangles), 512² WebP textures, same materials everywhere. There was
 * briefly a second, heavier tier for Home; the lighter one looked the same in
 * the carousel and the split only doubled bytes and upkeep. Preserves bones,
 * node names and UVs; authoring sources live outside public/ in
 * assets/model-sources/.
 */
export function runtimeModelUrl(url) {
  const match = /^\/models\/([a-z-]+)\.glb$/.exec(String(url))
  return match && RUNTIME_MODELS.has(match[1]) ? `/models/${match[1]}.runtime.glb` : url
}
