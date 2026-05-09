export function formatWalletLabel(value) {
  const wallet = String(value || '').trim();
  if (!wallet || wallet.length <= 7) return wallet;
  return `${wallet.slice(0, 3)}.${wallet.slice(-3)}`;
}
