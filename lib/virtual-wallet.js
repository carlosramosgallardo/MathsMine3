/**
 * Derives a deterministic, privacy-preserving virtual wallet address for MM3
 * from a Google subject ID (the opaque unique user identifier from Google's
 * openid scope — never an email or name).
 *
 * Algorithm: SHA-256("mm3v1:" + googleSub) → first 20 bytes → 0x-prefixed hex.
 * The salt "mm3v1:" ensures the address is MM3-specific and not linkable to
 * other services using the same Google sub. One-way: the Google identity
 * cannot be recovered from the derived address.
 */
export async function deriveVirtualWallet(googleSub) {
  const input = new TextEncoder().encode(`mm3v1:${googleSub}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', input);
  const bytes = Array.from(new Uint8Array(hashBuffer)).slice(0, 20);
  return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}
