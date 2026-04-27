export const MARKET_COMMANDS = [
  {
    key: 'mm3-023',
    emoji: '🛰',
    command: '/wall [freakingAI@MM3] solve => (log10(100000)*(4000+x))+(12*(300+x))+((6000+3*x)/3) = ?',
    solve: (x) => (5 * (4000 + x)) + (12 * (300 + x)) + ((6000 + 3 * x) / 3),
  },
  {
    key: 'mm3-05c',
    emoji: '🌐',
    command: '/wall [freakingAI@MM3] solve => (7000+x)+(13*200)+(x*4) = ?',
    solve: (x) => (7000 + x) + (13 * 200) + (x * 4),
  },
  {
    key: 'mm3-0b9',
    emoji: '🔭',
    command: '/wall [freakingAI@MM3] solve => 9000+(8*x)+(3600/3) = ?',
    solve: (x) => 9000 + (8 * x) + (3600 / 3),
  },
  {
    key: 'mm3-11b',
    emoji: '🧬',
    command: '/wall [freakingAI@MM3] solve => 11000+(21*x)+(1440/2) = ?',
    solve: (x) => 11000 + (21 * x) + (1440 / 2),
  },
  {
    key: 'mm3-184',
    emoji: '💠',
    command: '/wall [freakingAI@MM3] solve => (12000+x*17)+(4096/4) = ?',
    solve: (x) => (12000 + x * 17) + (4096 / 4),
  },
  {
    key: 'mm3-1e7',
    emoji: '⚡',
    command: '/wall [freakingAI@MM3] solve => 15000+(x*23)+(2048/2) = ?',
    solve: (x) => 15000 + (x * 23) + (2048 / 2),
  },
  {
    key: 'mm3-244',
    emoji: '🌀',
    command: '/wall [freakingAI@MM3] solve => 18000+(x*31)+(7777%1000) = ?',
    solve: (x) => 18000 + (x * 31) + (7777 % 1000),
  },
  {
    key: 'mm3-26d',
    emoji: '🔴',
    command: '/wall [freakingAI@MM3] solve => 22000+(x*37)+(9999/3) = ?',
    solve: (x) => 22000 + (x * 37) + (9999 / 3),
  },
  {
    key: 'mm3-2ca',
    emoji: '⭐',
    command: '/wall [freakingAI@MM3] solve => 26000+(x*41)+(12345%678) = ?',
    solve: (x) => 26000 + (x * 41) + (12345 % 678),
  },
  {
    key: 'mm3-30e',
    emoji: '💎',
    command: '/wall [freakingAI@MM3] solve => 30000+(x*47)+(8192/4) = ?',
    solve: (x) => 30000 + (x * 47) + (8192 / 4),
  },
];

export function getMarketCommandForKey(key) {
  return MARKET_COMMANDS.find((entry) => entry.key === key) || null;
}

export function findMarketCommandByText(text) {
  const normalized = normalizeCommandText(text);
  return MARKET_COMMANDS.find((entry) => normalizeCommandText(entry.command) === normalized) || null;
}

export function normalizeCommandText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

export function getUtcDayWindow(date = new Date()) {
  const start = new Date(date);
  const reset = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    dayKey: start.toISOString(),
    startAt: start.toISOString(),
    resetAt: reset.toISOString(),
  };
}

export function computeMarketCommandCode(commandEntry, wallet, dayKey, now = Date.now()) {
  const seed = `${commandEntry?.key || ''}:${wallet || ''}:${dayKey || ''}:${now}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const x = Math.abs(hash % 700) + 100;
  const raw = Math.floor(Number(commandEntry?.solve?.(x)) || 0);
  const code = String(raw).padStart(5, '0');
  return { x, code };
}
