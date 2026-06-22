export function isAnonymousWallet(value) {
  const wallet = String(value || '').trim().toLowerCase()
  return /^anon(?:$|[-:])/.test(wallet)
}
