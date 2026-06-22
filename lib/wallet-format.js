export function formatWalletLabel(value, isSolver = false) {
  const wallet = String(value || '').trim();
  if (!wallet || wallet.length <= 7) return isSolver ? wallet + '@MM3' : wallet;
  const label = `${wallet.slice(0, 3)}.${wallet.slice(-3)}`;
  return isSolver ? label + '@MM3' : label;
}
