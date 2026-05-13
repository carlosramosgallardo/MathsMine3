export function colorFromAddress(addr = '') {
  const safe = String(addr).toLowerCase().replace(/^0x/, '');
  let hash = 0;
  for (let i = 0; i < safe.length; i++) hash = (hash * 31 + safe.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const saturation = 70;
  const lightness = 55;
  const k = (n) => (n + hue / 30) % 12;
  const a = (saturation / 100) * Math.min(lightness / 100, 1 - lightness / 100);
  const f = (n) => lightness / 100 - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

// Pool codes use a separate namespace so their colors never clash with wallet colors
export function colorFromPool(poolCode = '') {
  return colorFromAddress('pool:' + String(poolCode).toUpperCase());
}
