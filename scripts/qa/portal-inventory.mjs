/** Portal routes + expected chrome for browser QA phases */

export const CHROME_ROUTES = [
  { path: '/', name: 'home', chrome: true },
  { path: '/training', name: 'training', chrome: true },
  { path: '/mining', name: 'mining', chrome: true, slow: true },
  { path: '/trading', name: 'trading', chrome: true },
  { path: '/ranking', name: 'ranking', chrome: true },
  { path: '/squeezing', name: 'squeezing', chrome: true },
  { path: '/relaying', name: 'relaying', chrome: true },
  { path: '/daily-tasks', name: 'dailyTasks', chrome: true },
  { path: '/mm3-value', name: 'chart', chrome: true },
  { path: '/manifesto', name: 'manifesto', chrome: true },
  { path: '/ai-team', name: 'aiTeam', chrome: true },
  { path: '/api', name: 'apiDocs', chrome: true },
  { path: '/security', name: 'security', chrome: true },
  { path: '/privacy', name: 'privacy', chrome: true },
  { path: '/terms', name: 'terms', chrome: true },
]

/** Bare shells — no portal Header/Footer */
export const BARE_ROUTES = [
  { path: '/embed/header', name: 'embedHeader', chrome: false },
  { path: '/embed/mining', name: 'embedMining', chrome: false, slow: true },
  { path: '/embed/training', name: 'embedTraining', chrome: false },
  { path: '/embed/trading', name: 'embedTrading', chrome: false },
  { path: '/embed/squeezing', name: 'embedSqueezing', chrome: false },
  { path: '/embed/wallet-auth', name: 'embedWalletAuth', chrome: false },
  { path: '/embed/home-arena', name: 'embedHomeArena', chrome: false, slow: true },
  { path: '/embed/home-minimap', name: 'embedHomeMinimap', chrome: false },
]

export const HOME_PORTAL_HREFS = [
  '/mining',
  '/training',
  '/trading',
  '/squeezing',
  '/relaying',
  '/daily-tasks',
  '/mm3-value',
  '/ranking',
  '/ai-team',
  '/manifesto',
]

/**
 * Distinctive body copy (case-insensitive match).
 * Drawn from live UI — CSS may uppercase some board strings.
 */
export const PAGE_LANG_MARKERS = {
  '/training': {
    // Board chrome is immediate; start CTA waits on problem fetch (flaky in CI).
    enPositive: ['DRILL SLOTS', 'Click to start', 'CLICK TO START', 'NO DRILL SLOTS'],
    esPositive: ['SONDEOS', 'Pulsa para empezar', 'PULSA PARA EMPEZAR', 'SIN SONDEOS'],
  },
  '/trading': {
    enPositive: ['Sell', 'Buy', 'SELL', 'BUY'],
    esPositive: ['Vender', 'Comprar', 'VENDER', 'COMPRAR'],
  },
  '/ranking': {
    enPositive: ['Miner Wallet'],
    esPositive: ['Billetera del Minero'],
  },
  '/squeezing': {
    // PoolSqueezeList only renders with pools; CI uses placeholder Supabase so
    // assert DisputesPanel chrome (empty / error / loading) or the pools header.
    enPositive: [
      'No Squeeze battles',
      'Error loading squeezes',
      'Loading squeezes',
      'Active pools',
    ],
    esPositive: [
      'Sin combates registrados',
      'Error cargando squeezes',
      'Cargando squeezes',
      'Pools activos',
    ],
  },
  '/relaying': {
    enPositive: ['Connect a wallet', 'CONECTA', 'relay', 'RELAY'],
    esPositive: ['Conecta una wallet', 'CONECTA UNA WALLET', 'SOLO LECTURA'],
  },
  '/daily-tasks': {
    enPositive: ['Solve 25', 'Unclaimed', 'REWARD', 'Reward'],
    esPositive: ['Resuelve 25', 'RECOMPENSA', 'Las recompensas'],
  },
  '/mm3-value': {
    enPositive: ['NFTJI', '24H', 'ALL'],
    esPositive: ['NFTJI', 'EVENTOS', '24H', 'ALL'],
  },
  '/manifesto': {
    enPositive: ['How to Play', 'Manifesto', 'Index'],
    esPositive: ['Cómo Jugar', 'Manifiesto', 'Índice'],
  },
  '/ai-team': {
    enPositive: ['AUTONOMOUS', 'Four autonomous', 'wallets'],
    esPositive: ['Cuatro wallets autónomas', 'AUTONOMOUS'],
  },
}

/** Pages where fiat currency UI should keep selected code after nav.
 * Skip /training — Board mounts heavy client work that can stall CI after nav. */
export const CURRENCY_SURFACES = [
  { path: '/trading' },
  { path: '/ranking' },
  { path: '/daily-tasks' },
  { path: '/squeezing' },
]

export const FOOTER_LINKS = [
  { path: '/api', label: 'API' },
  { path: '/security', label: 'SEC' },
  { path: '/privacy', en: 'Privacy', es: 'Privacidad' },
  { path: '/terms', en: 'Terms', es: 'Términos' },
]
