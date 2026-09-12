/**
 * Single source of truth for which models have optimized derivatives: the
 * offline generator (scripts/model-tools/optimize.mjs) and the test that
 * guards against a missing derivative both read this list, so adding a name
 * here is enough to pull it into both.
 */
export const RUNTIME_MODEL_NAMES = [
  'kim', 'putin', 'trump', 'macron', 'zelenski', 'milei-figure',
  'rl-car', 'man', 'tool-usb', 'nuclear',
]

/**
 * Every model ships in two tiers, both generated from assets/model-sources/:
 *  - runtime: Home carousel. Full silhouette (error-capped decimation), 1024²
 *    textures, linear filtering.
 *  - retro:   Mining. Pixel-art look on purpose — heavy decimation, 256²
 *    textures drawn with nearest filtering inside the 768×480 retro
 *    framebuffer, so the same faces read as chunky low-poly sprites at a
 *    fraction of the bytes and triangles.
 */
export const MODEL_TIERS = ['runtime', 'retro']

const RUNTIME_MODELS = new Set(RUNTIME_MODEL_NAMES)

function modelTierUrl(url, tier) {
  const match = /^\/models\/([a-z-]+)\.glb$/.exec(String(url))
  return match && RUNTIME_MODELS.has(match[1]) ? `/models/${match[1]}.${tier}.glb` : url
}

/** Optimized derivatives preserve bones, node names and UVs; authoring sources live outside public/ in assets/model-sources/. */
export function runtimeModelUrl(url) {
  return modelTierUrl(url, 'runtime')
}

export function retroModelUrl(url) {
  return modelTierUrl(url, 'retro')
}
