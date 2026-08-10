export function isAnonymousWallet(value) {
  const wallet = String(value || '').trim().toLowerCase()
  return /^anon(?:$|[-:])/.test(wallet)
}

/** Canonical EVM address used across MM3 (Google virtual wallets included). */
export function isValidEthWallet(value) {
  return /^0x[0-9a-f]{40}$/.test(String(value || '').trim().toLowerCase())
}

/** Wallets that may appear in ranking / portal totals. */
export function isRankableWallet(value) {
  const wallet = String(value || '').trim().toLowerCase()
  return isValidEthWallet(wallet) && !isAnonymousWallet(wallet)
}
