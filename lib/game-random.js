/**
 * Cryptographic unit-interval RNG (Sonar javascript:S2245).
 * Uses Web Crypto so the same helper works in Next server and the browser.
 */
export function unitRandom() {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0] / 0x1_0000_0000
}
