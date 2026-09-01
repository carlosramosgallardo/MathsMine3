/** Selects reduced GLBs only for the local trailer recorder. */
export function trailerModelUrl(url) {
  if (typeof window === 'undefined' || window.__MM3_TRAILER_LIGHT_TEXTURES__ !== true) return url
  return String(url).replace(/\.glb$/i, '.lite.glb')
}
