export const MARKET_COMMANDS = [
  {
    key: 'mm3-023',
    emoji: '🛰',
    payment: 'money',
    effect: 'money',
    command: '/wall [freakingAI@MM3] solve => (log10(100000)*(4000+x))+(12*(300+x))+((6000+3*x)/3) = ?',
    solve: (x) => (5 * (4000 + x)) + (12 * (300 + x)) + ((6000 + 3 * x) / 3),
  },
  {
    key: 'mm3-05c',
    emoji: '🌐',
    payment: 'money',
    effect: 'money',
    command: '/wall [freakingAI@MM3] solve => (7000+x)+(13*200)+(x*4) = ?',
    solve: (x) => (7000 + x) + (13 * 200) + (x * 4),
  },
  {
    key: 'mm3-0b9',
    emoji: '🔭',
    payment: 'money',
    effect: 'money',
    command: '/wall [freakingAI@MM3] solve => 9000+(8*x)+(3600/3) = ?',
    solve: (x) => 9000 + (8 * x) + (3600 / 3),
  },
  {
    key: 'mm3-11b',
    emoji: '🧬',
    payment: 'money',
    effect: 'money',
    command: '/wall [freakingAI@MM3] solve => 11000+(21*x)+(1440/2) = ?',
    solve: (x) => 11000 + (21 * x) + (1440 / 2),
  },
  {
    key: 'mm3-184',
    emoji: '💠',
    payment: 'money',
    effect: 'money',
    command: '/wall [freakingAI@MM3] solve => (12000+x*17)+(4096/4) = ?',
    solve: (x) => (12000 + x * 17) + (4096 / 4),
  },
  {
    key: 'mm3-1e7',
    emoji: '⚡',
    payment: 'money',
    effect: 'money',
    command: '/wall [freakingAI@MM3] solve => 15000+(x*23)+(2048/2) = ?',
    solve: (x) => 15000 + (x * 23) + (2048 / 2),
  },
  {
    key: 'mm3-244',
    emoji: '🌀',
    payment: 'money',
    effect: 'money',
    command: '/wall [freakingAI@MM3] solve => 18000+(x*31)+(7777%1000) = ?',
    solve: (x) => 18000 + (x * 31) + (7777 % 1000),
  },
  {
    key: 'mm3-26d',
    emoji: '🔴',
    payment: 'money',
    effect: 'money',
    command: '/wall [freakingAI@MM3] solve => 22000+(x*37)+(9999/3) = ?',
    solve: (x) => 22000 + (x * 37) + (9999 / 3),
  },
  {
    key: 'mm3-2ca',
    emoji: '⭐',
    payment: 'money',
    effect: 'money',
    command: '/wall [freakingAI@MM3] solve => 26000+(x*41)+(12345%678) = ?',
    solve: (x) => 26000 + (x * 41) + (12345 % 678),
  },
  {
    key: 'mm3-30e',
    emoji: '💎',
    payment: 'money',
    effect: 'money',
    command: '/wall [freakingAI@MM3] solve => 30000+(x*47)+(8192/4) = ?',
    solve: (x) => 30000 + (x * 47) + (8192 / 4),
  },
  {
    key: 'mm3-01d',
    emoji: '🛸',
    payment: 'mm3',
    effect: 'mm3',
    command: '/mm3 [freakingAI@MM3] siphon => 41000+(x*11)+(2048/4) = ?',
    solve: (x) => 41000 + (x * 11) + (2048 / 4),
  },
  {
    key: 'mm3-04a',
    emoji: '🗝️',
    payment: 'mm3',
    effect: 'mm3',
    command: '/mm3 [freakingAI@MM3] siphon => (43000+x)+(17*300)+(x*3) = ?',
    solve: (x) => (43000 + x) + (17 * 300) + (x * 3),
  },
  {
    key: 'mm3-091',
    emoji: '🛡️',
    payment: 'mm3',
    effect: 'mm3',
    command: '/mm3 [freakingAI@MM3] siphon => 47000+(19*x)+(4096/8) = ?',
    solve: (x) => 47000 + (19 * x) + (4096 / 8),
  },
  {
    key: 'mm3-0f8',
    emoji: '🧨',
    payment: 'mm3',
    effect: 'mm3',
    command: '/mm3 [freakingAI@MM3] siphon => 51000+(x*29)+(7776/6) = ?',
    solve: (x) => 51000 + (x * 29) + (7776 / 6),
  },
  {
    key: 'mm3-15c',
    emoji: '🪙',
    payment: 'mm3',
    effect: 'mm3',
    command: '/mm3 [freakingAI@MM3] siphon => (54000+x*31)+(10000/8) = ?',
    solve: (x) => (54000 + x * 31) + (10000 / 8),
  },
  {
    key: 'mm3-1a6',
    emoji: '🧰',
    payment: 'mm3',
    effect: 'mm3',
    command: '/mm3 [freakingAI@MM3] siphon => 58000+(x*37)+(8192/16) = ?',
    solve: (x) => 58000 + (x * 37) + (8192 / 16),
  },
  {
    key: 'mm3-20b',
    emoji: '🪬',
    payment: 'mm3',
    effect: 'mm3',
    command: '/mm3 [freakingAI@MM3] siphon => 62000+(x*43)+(12345%789) = ?',
    solve: (x) => 62000 + (x * 43) + (12345 % 789),
  },
  {
    key: 'mm3-29b',
    emoji: '🪞',
    payment: 'mm3',
    effect: 'mm3',
    command: '/mm3 [freakingAI@MM3] siphon => 68000+(x*38)+(9999/9) = ?',
    solve: (x) => 68000 + (x * 38) + (9999 / 9),
  },
  {
    key: 'mm3-2da',
    emoji: '🔋',
    payment: 'mm3',
    effect: 'mm3',
    command: '/mm3 [freakingAI@MM3] siphon => 73000+(x*32)+(16384/16) = ?',
    solve: (x) => 73000 + (x * 32) + (16384 / 16),
  },
  {
    key: 'mm3-2f9',
    emoji: '🎛️',
    payment: 'mm3',
    effect: 'mm3',
    command: '/mm3 [freakingAI@MM3] siphon => 79000+(x*25)+(22222%999) = ?',
    solve: (x) => 79000 + (x * 25) + (22222 % 999),
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

export function getFormulaFromMarketCommand(command) {
  const raw = String(command || '').trim();
  const parts = raw.split('=>');
  if (parts.length < 2) return raw;
  return parts[1].replace(/=\s*\?$/i, '').trim();
}

export function evaluateMarketFormula(command, x) {
  const formula = getFormulaFromMarketCommand(command)
    .replace(/\blog10\s*\(/gi, 'Math.log10(')
    .replace(/\bx\b/g, String(Number(x) || 0));
  if (!/^[\d\s+\-*/%().Mathlog10]+$/.test(formula)) return 0;
  try {
    // Formula text comes from admin-managed public Market metadata.
    // The whitelist above keeps the evaluator limited to arithmetic.
    return Function(`"use strict"; return (${formula});`)();
  } catch {
    return 0;
  }
}

export function getMarketCommandEffect(commandEntry) {
  if (commandEntry?.effect === 'mm3') return 'mm3';
  if (commandEntry?.payment === 'mm3') return 'mm3';

  const command = normalizeCommandText(commandEntry?.command).toLowerCase();
  if (command.startsWith('/mm3')) return 'mm3';

  return 'money';
}

export function isMm3MarketCommand(commandEntry) {
  return getMarketCommandEffect(commandEntry) === 'mm3';
}

export function isMoneyMarketCommand(commandEntry) {
  return getMarketCommandEffect(commandEntry) === 'money';
}

export function marketCommandFromBlock(block) {
  const command = normalizeCommandText(block?.market_command);
  if (!command) return null;

  const fallback = getMarketCommandForKey(block?.block_key);
  const effect = getMarketCommandEffect({
    command,
    effect: fallback?.effect,
    payment: fallback?.payment,
  });

  return {
    key: block.block_key,
    emoji: block.emoji || fallback?.emoji || '?',
    grid_row: block.grid_row,
    grid_col: block.grid_col,
    title_en: block.title_en,
    title_es: block.title_es,
    price_eur: block.price_eur,
    payment: effect === 'mm3' ? 'mm3' : 'money',
    effect,
    command,
    solve: (x) => evaluateMarketFormula(command, x),
  };
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
  const raw = Math.floor(Number(commandEntry?.solve?.(x) ?? evaluateMarketFormula(commandEntry?.command, x)) || 0);
  const code = String(raw).padStart(5, '0');
  return { x, code };
}
