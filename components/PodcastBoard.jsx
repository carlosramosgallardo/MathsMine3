'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabaseClient';
import { useI18n } from '@/lib/i18n-context';
import { useCurrency } from '@/lib/currency-context';
import { CNY_TO_EUR, CNY_TO_USD, formatMoney, getSellQuote, getSellRateCny } from '@/lib/sell-offer';
import { colorFromAddress } from '@/lib/wallet-colors';
import PageLoading from '@/components/PageLoading';
import {
  normalizeWalletDecorations,
  WALLET_DECORATIONS,
} from '@/lib/wallet-decorations';
import { useSound } from '@/lib/sound-context';
import { getMarketCommandForKey } from '@/lib/market-commands';

const GENESIS_BLOCK_KEY = 'mm3-023';
const GRID_ROWS = 28;
const GRID_COLS = 28;

// Emojis reserved for auto-spawned mystery blocks.
// Rules: must not appear in mining NTFJIs (🔮🍀🎰🧿❤️), Market catalog (🛰🌐🔭🧬💠⚡🌀🔴⭐💎),
// rank icons (🧪⛏️🧠🪄👑), or UI indicators (⚔️🌪️🎲📜🤖).
// Spawned blocks land in DB with title="Mystery Block" and is_active=true but no command data —
// they need manual completion in Supabase (emoji, title, command, answer_hash, min_level)
// before they become live purchasable NTFJIs. Add new emojis here when expanding the catalog.
const MYSTERY_EMOJIS = ['🌑', '🌊', '🧲', '🌿', '💧', '🌈', '🌙', '🦋', '🧩', '⚗️', '🌸', '🌺', '🧊', '🎪', '🪐', '🏔️', '🦠', '🌋', '🦎', '🫧'];

function notify(msg, type = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type } }));
  }
}

function openRankingWallet(wallet) {
  if (!wallet || typeof window === 'undefined') return;
  localStorage.setItem('mm3_leaderboard_wallet', String(wallet).toLowerCase());
  window.location.href = '/ranking';
}

function toCnyFromEur(value) {
  return Number(value || 0) / CNY_TO_EUR;
}

function toUsdFromEur(value) {
  return Number(value || 0) * (CNY_TO_USD / CNY_TO_EUR);
}

function clampDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function shortenWallet(value) {
  const wallet = String(value || '');
  if (wallet.length <= 14) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function getTokenBlockTone(row, col) {
  return {
    backgroundImage: 'url(/mm3-token.png)',
    backgroundSize: `${GRID_COLS * 100}% ${GRID_ROWS * 100}%`,
    backgroundPosition: `${(col / (GRID_COLS - 1)) * 100}% ${(row / (GRID_ROWS - 1)) * 100}%`,
    border: 'rgba(34,211,238,0.08)',
  };
}

function getBlockHex(row, col) {
  return '#' + (row * GRID_COLS + col).toString(16).toUpperCase().padStart(3, '0');
}

function normalizeShortUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  const shortsMatch = url.match(/youtube\.com\/shorts\/([^?&/]+)/i);
  if (shortsMatch?.[1]) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
  const watchMatch = url.match(/[?&]v=([^?&/]+)/i);
  if (watchMatch?.[1]) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  const shortId = url.match(/youtu\.be\/([^?&/]+)/i);
  if (shortId?.[1]) return `https://www.youtube.com/embed/${shortId[1]}`;
  return url;
}

function stepSelection(blocks, currentKey, direction) {
  const current = blocks.find((entry) => entry.block_key === currentKey) || blocks[0];
  if (!current) return currentKey;

  let best = current;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of blocks) {
    if (candidate.block_key === current.block_key) continue;
    const dx = candidate.grid_col - current.grid_col;
    const dy = candidate.grid_row - current.grid_row;
    const horizontalScore = Math.abs(dx) * 10 + Math.abs(dy);
    const verticalScore = Math.abs(dy) * 10 + Math.abs(dx);
    const valid =
      (direction === 'right' && dx > 0) ||
      (direction === 'left' && dx < 0) ||
      (direction === 'down' && dy > 0) ||
      (direction === 'up' && dy < 0);

    if (!valid) continue;
    const score = direction === 'left' || direction === 'right' ? horizontalScore : verticalScore;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best.block_key;
}

const CATALOG_BLOCKS = [
  { block_key: 'mm3-023', grid_row: 0,  grid_col: 22, emoji: WALLET_DECORATIONS.marketGenesis, title_en: 'Genesis Uplink',   title_es: 'Uplink Génesis',     price_eur: 1,   short_url: '', is_active: true },
  { block_key: 'mm3-05c', grid_row: 3,  grid_col: 8,  emoji: '🌐', title_en: 'Signal Nexus',    title_es: 'Nexo Señal',         price_eur: 3,   short_url: '', is_active: true },
  { block_key: 'mm3-0b9', grid_row: 6,  grid_col: 17, emoji: '🔭', title_en: 'Deep Relay',      title_es: 'Relay Profundo',     price_eur: 5,   short_url: '', is_active: true },
  { block_key: 'mm3-11b', grid_row: 10, grid_col: 3,  emoji: '🧬', title_en: 'Code Strand',     title_es: 'Cadena Código',      price_eur: 7,   short_url: '', is_active: true },
  { block_key: 'mm3-184', grid_row: 13, grid_col: 24, emoji: '💠', title_en: 'Fractal Core',    title_es: 'Núcleo Fractal',     price_eur: 10,  short_url: '', is_active: true },
  { block_key: 'mm3-1e7', grid_row: 17, grid_col: 11, emoji: '⚡', title_en: 'Arc Burst',       title_es: 'Destello Arco',      price_eur: 15,  short_url: '', is_active: true },
  { block_key: 'mm3-244', grid_row: 20, grid_col: 20, emoji: '🌀', title_en: 'Entropy Loop',    title_es: 'Bucle Entropía',     price_eur: 25,  short_url: '', is_active: true },
  { block_key: 'mm3-26d', grid_row: 22, grid_col: 5,  emoji: '🔴', title_en: 'Null Beacon',     title_es: 'Baliza Nula',        price_eur: 50,  short_url: '', is_active: true },
  { block_key: 'mm3-2ca', grid_row: 25, grid_col: 14, emoji: '⭐', title_en: 'Star Protocol',   title_es: 'Protocolo Estelar',  price_eur: 75,  short_url: '', is_active: true },
  { block_key: 'mm3-30e', grid_row: 27, grid_col: 26, emoji: '💎', title_en: 'Crystal Forge',   title_es: 'Forja Cristal',      price_eur: 100, short_url: '', is_active: true },
  { block_key: 'mm3-01d', grid_row: 1,  grid_col: 1,  emoji: '🛸', title_en: 'Orbit Siphon',    title_es: 'Sifón Orbital',      price_eur: 1,   short_url: '', is_active: true },
  { block_key: 'mm3-04a', grid_row: 2,  grid_col: 18, emoji: '🗝️', title_en: 'Key Vault',       title_es: 'Bóveda Llave',       price_eur: 3,   short_url: '', is_active: true },
  { block_key: 'mm3-091', grid_row: 5,  grid_col: 5,  emoji: '🛡️', title_en: 'Shield Fork',     title_es: 'Bifurcación Escudo', price_eur: 5,   short_url: '', is_active: true },
  { block_key: 'mm3-0f8', grid_row: 8,  grid_col: 24, emoji: '🧨', title_en: 'Fuse Packet',     title_es: 'Paquete Mecha',      price_eur: 7,   short_url: '', is_active: true },
  { block_key: 'mm3-15c', grid_row: 12, grid_col: 12, emoji: '🪙', title_en: 'Coin Kernel',     title_es: 'Kernel Moneda',      price_eur: 10,  short_url: '', is_active: true },
  { block_key: 'mm3-1a6', grid_row: 15, grid_col: 2,  emoji: '🧰', title_en: 'Toolchain Cache', title_es: 'Caché Toolchain',    price_eur: 15,  short_url: '', is_active: true },
  { block_key: 'mm3-20b', grid_row: 18, grid_col: 19, emoji: '🪬', title_en: 'Mirror Charm',    title_es: 'Amuleto Espejo',     price_eur: 25,  short_url: '', is_active: true },
  { block_key: 'mm3-29b', grid_row: 23, grid_col: 23, emoji: '🪞', title_en: 'Reflector Gate',  title_es: 'Puerta Reflector',   price_eur: 50,  short_url: '', is_active: true },
  { block_key: 'mm3-2da', grid_row: 26, grid_col: 2,  emoji: '🔋', title_en: 'Battery Node',    title_es: 'Nodo Batería',       price_eur: 75,  short_url: '', is_active: true },
  { block_key: 'mm3-2f9', grid_row: 27, grid_col: 5,  emoji: '🎛️', title_en: 'Mixer Console',   title_es: 'Consola Mixer',      price_eur: 100, short_url: '', is_active: true },
];

const CATALOG_KEY_SET = new Set(CATALOG_BLOCKS.map((b) => b.block_key));


export default function PodcastBoard({ account, isVirtualWallet = false }) {
  const { t, language } = useI18n();
  const { currency } = useCurrency();
  const { playMarketClaim } = useSound();
  const [blocks, setBlocks] = useState(CATALOG_BLOCKS);
  const [selectedKey, setSelectedKey] = useState(GENESIS_BLOCK_KEY);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [dbReady, setDbReady] = useState(true);
  const [numericCode, setNumericCode] = useState('');
  const [activePenalty, setActivePenalty] = useState(null);
  const [activeBlockCommand, setActiveBlockCommand] = useState(null);
  const [walletState, setWalletState] = useState({
    funds: { EUR: 0, USD: 0, CNY: 0 },
    level: 0,
    mm3Sold: 0,
    totalMm3: 0,
    emojis: [],
    marketNFTJIKey: null,
    marketNFTJIPrice: 0,
  });

  const loadBlocks = async () => {
    setLoading(true);
    try {
      const [{ data: blockData, error }, { data: ownersData }, { data: eventData }] = await Promise.all([
        supabase
          .from('mm3_market_blocks')
          .select('block_key, grid_row, grid_col, emoji, title_en, title_es, price_eur, short_url, is_active, first_purchased_at')
          .order('block_key', { ascending: true }),
        supabase
          .from('player_progress')
          .select('wallet, market_nftji_key')
          .not('market_nftji_key', 'is', null),
        supabase
          .from('mm3_market_events')
          .select('emoji, event_type')
          .in('event_type', ['market_buy', 'market_resell']),
      ]);

      if (error) throw error;

      const currentOwnersByKey = new Map();
      for (const entry of ownersData || []) {
        const key = entry.market_nftji_key;
        const wallet = String(entry.wallet || '').toLowerCase();
        if (!key || !wallet) continue;
        if (!currentOwnersByKey.has(key)) currentOwnersByKey.set(key, []);
        currentOwnersByKey.get(key).push(wallet);
      }

      const buyCountByEmoji = new Map();
      const resellCountByEmoji = new Map();
      for (const ev of eventData || []) {
        const e = String(ev.emoji || '');
        if (ev.event_type === 'market_buy') buyCountByEmoji.set(e, (buyCountByEmoji.get(e) || 0) + 1);
        else if (ev.event_type === 'market_resell') resellCountByEmoji.set(e, (resellCountByEmoji.get(e) || 0) + 1);
      }

      const dbBlocks = Array.isArray(blockData) ? blockData : [];
      const dbByKey = new Map(dbBlocks.map((b) => [b.block_key, b]));

      const norm = (b) => ({
        ...b,
        price_eur: Number(b.price_eur) || 0,
        current_owners: currentOwnersByKey.get(b.block_key) || [],
        buy_count: buyCountByEmoji.get(String(b.emoji || '')) || 0,
        resell_count: resellCountByEmoji.get(String(b.emoji || '')) || 0,
      });

      const catalogMerged = CATALOG_BLOCKS.map((cat) =>
        norm(dbByKey.has(cat.block_key) ? { ...cat, ...dbByKey.get(cat.block_key) } : cat)
      );

      // Include dynamically spawned blocks (DB-only rows)
      const extraBlocks = dbBlocks
        .filter((b) => !CATALOG_KEY_SET.has(b.block_key))
        .map((b) => norm(b));

      setBlocks([...catalogMerged, ...extraBlocks]);
      setDbReady(true);
    } catch (err) {
      console.error('market blocks load:', err);
      setBlocks(CATALOG_BLOCKS);
      setDbReady(false);
    } finally {
      setLoading(false);
    }
  };

  const loadWalletState = async () => {
    if (!account) {
      setWalletState({
        funds: { EUR: 0, USD: 0, CNY: 0 },
        level: 0,
        mm3Sold: 0,
        totalMm3: 0,
        emojis: [],
        marketNFTJIKey: null,
        marketNFTJIPrice: 0,
      });
      return;
    }

    try {
      const wallet = account.toLowerCase();
      const [{ data: progress }, { data: stats }] = await Promise.all([
        supabase
          .from('player_progress')
          .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, market_nftji_key, market_nftji_price')
          .eq('wallet', wallet)
          .maybeSingle(),
        supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
      ]);

      setWalletState({
        funds: {
          EUR: Number(progress?.eur_earned) || 0,
          USD: Number(progress?.usd_earned) || 0,
          CNY: Number(progress?.cny_earned) || 0,
        },
        level: Math.max(0, Math.min(100, Number(progress?.level) || 0)),
        mm3Sold: Number(progress?.mm3_sold) || 0,
        totalMm3: Number(stats?.total_eth) || 0,
        emojis: normalizeWalletDecorations(progress?.wallet_emojis),
        marketNFTJIKey: progress?.market_nftji_key || null,
        marketNFTJIPrice: Number(progress?.market_nftji_price) || 0,
      });
    } catch (err) {
      console.error('market wallet load:', err);
    }
  };

  const loadActiveBlockCommand = async (blockKey = selectedKey) => {
    if (!blockKey || blockKey.startsWith('ph-')) { setActiveBlockCommand(null); return; }
    try {
      const { data } = await supabase
        .from('mm3_market_commands')
        .select('id, wallet, formula_x, reset_at')
        .eq('nftji_key', blockKey)
        .gt('reset_at', new Date().toISOString())
        .order('executed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveBlockCommand(data || null);
    } catch { setActiveBlockCommand(null); }
  };

  const loadActivePenalty = async (blockKey = selectedKey) => {
    if (!account || !blockKey || blockKey.startsWith('ph-')) {
      setActivePenalty(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('mm3_command_penalties')
        .select('id, nftji_key, penalty_code, penalty_value, penalty_eur, attempted_at, redeemed_at, reset_at, created_at')
        .eq('wallet', account.toLowerCase())
        .eq('nftji_key', blockKey)
        .is('redeemed_at', null)
        .gt('reset_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setActivePenalty(data || null);
    } catch (err) {
      console.error('market penalty load:', err);
      setActivePenalty(null);
    }
  };

  const spawnNewBlock = async (currentBlocks) => {
    const occupiedCells = new Set();
    for (const b of currentBlocks) {
      if (!b.isPlaceholder && b.grid_row !== null && b.grid_col !== null) {
        occupiedCells.add(`${b.grid_row}-${b.grid_col}`);
      }
    }

    const usedEmojis = new Set(currentBlocks.filter((b) => b.emoji).map((b) => b.emoji));
    const availableEmojis = MYSTERY_EMOJIS.filter((e) => !usedEmojis.has(e));
    if (!availableEmojis.length) return;

    const freeCells = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (!occupiedCells.has(`${row}-${col}`)) freeCells.push({ row, col });
      }
    }
    if (!freeCells.length) return;

    const cell = freeCells[Math.floor(Math.random() * freeCells.length)];
    const emoji = availableEmojis[Math.floor(Math.random() * availableEmojis.length)];
    const pixelKey = 'mm3-' + (cell.row * GRID_COLS + cell.col).toString(16).padStart(3, '0');
    const prices = [5, 10, 15, 25, 50];
    const price = prices[Math.floor(Math.random() * prices.length)];

    try {
      await supabase.from('mm3_market_blocks').insert({
        block_key: pixelKey,
        grid_row: cell.row,
        grid_col: cell.col,
        emoji,
        title_en: 'Mystery Block',
        title_es: 'Bloque Misterio',
        answer_hash: '',
        price_eur: price,
        is_active: true,
      });
      notify(`${t('podcast.newBlock')} ${emoji}`, 'info');
    } catch {
      // silent — spawn failure does not block the buy
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = new URLSearchParams(window.location.search);
    const blockFromQuery = query.get('block');
    if (blockFromQuery) {
      setSelectedKey(blockFromQuery);
    } else {
      setSelectedKey(CATALOG_BLOCKS[Math.floor(Math.random() * CATALOG_BLOCKS.length)].block_key);
    }
  }, []);

  useEffect(() => {
    loadBlocks();
  }, []);

  useEffect(() => {
    loadWalletState();
  }, [account]);

  useEffect(() => {
    setNumericCode('');
    loadActivePenalty(selectedKey);
    loadActiveBlockCommand(selectedKey);
  }, [account, selectedKey]);

  useEffect(() => {
    const refresh = async () => {
      await Promise.all([loadBlocks(), loadWalletState(), loadActivePenalty(selectedKey), loadActiveBlockCommand(selectedKey)]);
    };

    window.addEventListener('mm3-db-updated', refresh);
    window.addEventListener('focus', refresh);

    const channel = supabase
      .channel('mm3-podcast-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_market_blocks' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_command_penalties' }, refresh)
      .subscribe();

    return () => {
      window.removeEventListener('mm3-db-updated', refresh);
      window.removeEventListener('focus', refresh);
      supabase.removeChannel(channel);
    };
  }, [account, selectedKey]);

  const mergedBlocks = useMemo(() => {
    const posMap = new Map();
    for (const b of blocks) {
      if (b.grid_row !== null && b.grid_col !== null) {
        posMap.set(`${b.grid_row}-${b.grid_col}`, { ...b, isPlaceholder: false });
      }
    }
    const result = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const key = `${row}-${col}`;
        if (posMap.has(key)) {
          result.push(posMap.get(key));
        } else {
          result.push({
            block_key: `ph-${row}-${col}`,
            grid_row: row, grid_col: col,
            emoji: '', title_en: '', title_es: '',
            price_eur: 0, short_url: '', is_active: false,
            current_owners: [], isPlaceholder: true,
          });
        }
      }
    }
    return result;
  }, [blocks]);

  const blockMap = useMemo(
    () => new Map(mergedBlocks.map((entry) => [String(entry.block_key), entry])),
    [mergedBlocks]
  );

  useEffect(() => {
    if (!blockMap.has(selectedKey)) {
      setSelectedKey(GENESIS_BLOCK_KEY);
    }
  }, [blockMap, selectedKey]);

  const selectedBlock = blockMap.get(selectedKey) || mergedBlocks[0];
  const selectedMarketCommand = !selectedBlock?.isPlaceholder
    ? getMarketCommandForKey(selectedBlock?.block_key)
    : null;
  const isMm3MarketBlock = selectedMarketCommand?.payment === 'mm3';
  const priceEur = Number(selectedBlock?.price_eur) || 0;
  const priceUsd = toUsdFromEur(priceEur);
  const priceCny = toCnyFromEur(priceEur);
  const displayPrice = isMm3MarketBlock
    ? `${priceEur.toFixed(8).replace(/\.?0+$/, '') || '0'} MM3`
    : currency === 'USD'
      ? formatMoney(priceUsd, 'USD')
      : currency === 'CNY'
        ? formatMoney(priceCny, 'CNY')
        : formatMoney(priceEur, 'EUR');

  const activeFunds = Number(walletState.funds[currency] || 0);
  const availableMm3 = Math.max(0, Number(walletState.totalMm3 || 0) - Number(walletState.mm3Sold || 0));
  const activePrice =
    currency === 'USD' ? priceUsd : currency === 'CNY' ? priceCny : priceEur;
  const enoughFunds = isMm3MarketBlock ? availableMm3 >= priceEur : activeFunds >= activePrice;

  const ownsSelected = Boolean(account) && walletState.marketNFTJIKey === selectedBlock?.block_key;
  const hasOtherNFTJI = Boolean(account) && Boolean(walletState.marketNFTJIKey) && walletState.marketNFTJIKey !== selectedBlock?.block_key;

  const canBuy =
    Boolean(account) &&
    dbReady &&
    Boolean(selectedBlock?.is_active) &&
    !selectedBlock?.isPlaceholder &&
    enoughFunds &&
    !ownsSelected &&
    !hasOtherNFTJI &&
    !processing;

  const canResell = Boolean(account) && dbReady && ownsSelected && !processing;
  const canLaunchIrc = ownsSelected && !activeBlockCommand;

  const selectedTitle = language === 'es'
    ? (selectedBlock?.title_es || selectedBlock?.title_en || t('podcast.template'))
    : (selectedBlock?.title_en || selectedBlock?.title_es || t('podcast.template'));

  const currentOwners = Array.isArray(selectedBlock?.current_owners) ? selectedBlock.current_owners : [];
  const hasCurrentOwners = currentOwners.length > 0;
  const selectedBlockHex = getBlockHex(selectedBlock?.grid_row ?? 0, selectedBlock?.grid_col ?? 0);
  const activePenaltyValue = Number(activePenalty?.penalty_value) || 0;
  const canRedeemPenalty =
    Boolean(account) &&
    Boolean(activePenalty) &&
    !activePenalty?.attempted_at &&
    numericCode.trim().length > 0 &&
    !processing;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const target = event.target;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      event.preventDefault();
      const direction = event.key.replace('Arrow', '').toLowerCase();
      setSelectedKey((current) => stepSelection(mergedBlocks, current, direction));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mergedBlocks]);

  const handleBlockClick = (blockKey) => {
    setSelectedKey(blockKey);
    const block = blockMap.get(blockKey);
    if (!block?.short_url) notify(block?.isPlaceholder ? t('podcast.offline') : t('podcast.unavailable'), 'info');
  };

  const handleBuy = async () => {
    if (!account) { notify(t('podcast.noWallet'), 'error'); return; }
    if (!enoughFunds) { notify(t('podcast.fundsLow'), 'error'); return; }
    if (!dbReady) { notify(t('podcast.dbMissing'), 'error'); return; }
    if (!selectedBlock?.is_active || selectedBlock?.isPlaceholder) { notify(t('podcast.offline'), 'info'); return; }

    setProcessing(true);
    try {
      const wallet = account.toLowerCase();

      const [{ data: blockRow, error: blockError }, { data: progressRow }, { data: statsRow }] = await Promise.all([
        supabase
          .from('mm3_market_blocks')
          .select('block_key, emoji, price_eur, is_active, first_purchased_at')
          .eq('block_key', selectedBlock.block_key)
          .maybeSingle(),
        supabase
          .from('player_progress')
          .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, market_nftji_key, market_nftji_price')
          .eq('wallet', wallet)
          .maybeSingle(),
        supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
      ]);

      if (blockError || !blockRow) throw blockError || new Error(t('podcast.dbMissing'));
      if (!blockRow.is_active) { await loadBlocks(); notify(t('podcast.offline'), 'info'); return; }

      const priceE = Number(blockRow.price_eur) || 0;
      const priceU = toUsdFromEur(priceE);
      const priceC = toCnyFromEur(priceE);
      const paysWithMm3 = getMarketCommandForKey(selectedBlock.block_key)?.payment === 'mm3';

      const fundsEur = Number(progressRow?.eur_earned) || 0;
      const fundsUsd = Number(progressRow?.usd_earned) || 0;
      const fundsCny = Number(progressRow?.cny_earned) || 0;
      const activePriceCheck = currency === 'USD' ? priceU : currency === 'CNY' ? priceC : priceE;
      const activeFundsCheck = currency === 'USD' ? fundsUsd : currency === 'CNY' ? fundsCny : fundsEur;

      const level = Math.max(0, Math.min(100, Number(progressRow?.level) || 0));
      const soldMm3 = Number(progressRow?.mm3_sold) || 0;
      const totalMm3 = Number(statsRow?.total_eth) || 0;
      const availableMm3Live = Math.max(0, totalMm3 - soldMm3);
      if (paysWithMm3) {
        if (availableMm3Live < priceE) { notify(t('podcast.fundsLow'), 'error'); return; }
      } else if (activeFundsCheck < activePriceCheck) {
        notify(t('podcast.fundsLow'), 'error');
        return;
      }
      const currentDecorations = normalizeWalletDecorations(progressRow?.wallet_emojis);

      if (progressRow?.market_nftji_key && progressRow.market_nftji_key !== selectedBlock.block_key) {
        notify(t('podcast.alreadyOwnsOther'), 'error');
        return;
      }

      let newFundsEur = fundsEur;
      let newFundsUsd = fundsUsd;
      let newFundsCny = fundsCny;

      // Deduct buy price from the block's payment rail.
      if (!paysWithMm3) {
        newFundsEur -= priceE;
        newFundsUsd -= priceU;
        newFundsCny -= priceC;
      }

      const rateCny = getSellRateCny(level);
      const buyDelta = paysWithMm3 ? priceE : priceE / (rateCny * CNY_TO_EUR);
      const liveQuote = getSellQuote(level, Math.max(0, totalMm3 - soldMm3), currentDecorations);
      const now = new Date().toISOString();

      const { error: progressError } = await supabase
        .from('player_progress')
        .upsert({
          wallet,
          level,
          mm3_sold: paysWithMm3 ? soldMm3 + priceE : soldMm3,
          eur_earned: newFundsEur,
          usd_earned: newFundsUsd,
          cny_earned: newFundsCny,
          wallet_emojis: currentDecorations,
          life_used: Boolean(progressRow?.life_used),
          lucky_50_claimed: Boolean(progressRow?.lucky_50_claimed),
          lucky_100_claimed: Boolean(progressRow?.lucky_100_claimed),
          lucky_500_claimed: Boolean(progressRow?.lucky_500_claimed),
          lucky_1000_claimed: Boolean(progressRow?.lucky_1000_claimed),
          sell_rate_cny: liveQuote.rateCny,
          sell_quote_cny: liveQuote.netCny,
          sell_quote_eur: liveQuote.netEur,
          sell_quote_usd: liveQuote.netUsd,
          market_nftji_key: selectedBlock.block_key,
          market_nftji_price: priceE,
          market_nftji_since: now,
          updated_at: now,
        }, { onConflict: 'wallet', ignoreDuplicates: false });
      if (progressError) throw progressError;

      await supabase.from('mm3_market_events').insert({
        wallet,
        event_type: 'market_buy',
        delta_mm3: buyDelta,
        emoji: String(blockRow.emoji || selectedBlock.block_key),
      });

      // First-ever purchase: mark block and spawn a mystery block
      if (!blockRow.first_purchased_at) {
        await supabase
          .from('mm3_market_blocks')
          .update({ first_purchased_at: now })
          .eq('block_key', selectedBlock.block_key);
        await spawnNewBlock(blocks);
      }

      playMarketClaim();
      notify(`${t('podcast.buySuccess')} ${blockRow.emoji}`, 'success');

      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_dirty_at', String(Date.now()));
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet, special: true, podcast: true } }));
      }
      await Promise.all([loadBlocks(), loadWalletState()]);
    } catch (err) {
      console.error('market buy:', err);
      notify(err?.message || t('podcast.claimFailed'), 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleResell = async () => {
    if (!account) { notify(t('podcast.noWallet'), 'error'); return; }
    if (!dbReady) { notify(t('podcast.dbMissing'), 'error'); return; }

    setProcessing(true);
    try {
      const wallet = account.toLowerCase();

      const [{ data: progressRow }, { data: statsRow }] = await Promise.all([
        supabase
          .from('player_progress')
          .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, market_nftji_key, market_nftji_price')
          .eq('wallet', wallet)
          .maybeSingle(),
        supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
      ]);

      if (!progressRow?.market_nftji_key || progressRow.market_nftji_key !== selectedBlock.block_key) {
        await loadWalletState();
        notify(t('podcast.notOwned'), 'info');
        return;
      }

      const level = Math.max(0, Math.min(100, Number(progressRow?.level) || 0));
      const soldMm3 = Number(progressRow?.mm3_sold) || 0;
      const totalMm3 = Number(statsRow?.total_eth) || 0;
      const currentDecorations = normalizeWalletDecorations(progressRow?.wallet_emojis);

      const oldPrice = Number(progressRow.market_nftji_price) || 0;
      const returnEur = oldPrice * 0.5;
      const returnUsd = toUsdFromEur(returnEur);
      const returnCny = toCnyFromEur(returnEur);
      const paysWithMm3 = getMarketCommandForKey(progressRow.market_nftji_key)?.payment === 'mm3';

      const fundsEur = Number(progressRow.eur_earned) || 0;
      const fundsUsd = Number(progressRow.usd_earned) || 0;
      const fundsCny = Number(progressRow.cny_earned) || 0;

      const rateCny = getSellRateCny(level);
      const resellDelta = paysWithMm3 ? returnEur : returnEur / (rateCny * CNY_TO_EUR);
      const liveQuote = getSellQuote(level, Math.max(0, totalMm3 - soldMm3), currentDecorations);
      const now = new Date().toISOString();

      const { error: progressError } = await supabase
        .from('player_progress')
        .upsert({
          wallet,
          level,
          mm3_sold: paysWithMm3 ? Math.max(0, soldMm3 - returnEur) : soldMm3,
          eur_earned: paysWithMm3 ? fundsEur : fundsEur + returnEur,
          usd_earned: paysWithMm3 ? fundsUsd : fundsUsd + returnUsd,
          cny_earned: paysWithMm3 ? fundsCny : fundsCny + returnCny,
          wallet_emojis: currentDecorations,
          life_used: Boolean(progressRow.life_used),
          lucky_50_claimed: Boolean(progressRow.lucky_50_claimed),
          lucky_100_claimed: Boolean(progressRow.lucky_100_claimed),
          lucky_500_claimed: Boolean(progressRow.lucky_500_claimed),
          lucky_1000_claimed: Boolean(progressRow.lucky_1000_claimed),
          sell_rate_cny: liveQuote.rateCny,
          sell_quote_cny: liveQuote.netCny,
          sell_quote_eur: liveQuote.netEur,
          sell_quote_usd: liveQuote.netUsd,
          market_nftji_key: null,
          market_nftji_price: 0,
          market_nftji_since: null,
          updated_at: now,
        }, { onConflict: 'wallet', ignoreDuplicates: false });
      if (progressError) throw progressError;

      // Cancel active IRC command and its penalties when the owner resells
      const resoldKey = progressRow.market_nftji_key;
      await supabase
        .from('mm3_market_commands')
        .update({ reset_at: new Date(Date.now() - 1000).toISOString() })
        .eq('wallet', wallet)
        .eq('nftji_key', resoldKey)
        .gt('reset_at', now);
      await supabase
        .from('mm3_command_penalties')
        .update({ redeemed_at: now })
        .eq('nftji_key', resoldKey)
        .is('redeemed_at', null);

      const resoldBlock = blocks.find((b) => b.block_key === resoldKey);
      await supabase.from('mm3_market_events').insert({
        wallet,
        event_type: 'market_resell',
        delta_mm3: resellDelta,
        emoji: String(resoldBlock?.emoji || resoldKey),
      });

      notify(
        `${t('podcast.resellSuccess')} ${paysWithMm3 ? `${returnEur.toFixed(8).replace(/\.?0+$/, '') || '0'} MM3` : formatMoney(returnEur, 'EUR')}`,
        'success'
      );

      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_dirty_at', String(Date.now()));
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet, special: true, podcast: true } }));
      }
      await Promise.all([loadBlocks(), loadWalletState()]);
    } catch (err) {
      console.error('market resell:', err);
      notify(err?.message || t('podcast.claimFailed'), 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleRedeemPenalty = async () => {
    if (!activePenalty) {
      notify(t('podcast.noPenalty'), 'info');
      return;
    }
    if (activePenalty.attempted_at) {
      notify(t('podcast.numericUsed'), 'info');
      return;
    }

    setProcessing(true);
    try {
      const typed = clampDigits(numericCode);
      const now = new Date().toISOString();
      const isCorrect = typed === String(activePenalty.penalty_code || '');
      const payload = isCorrect
        ? { attempted_at: now, redeemed_at: now }
        : { attempted_at: now };

      const { error } = await supabase
        .from('mm3_command_penalties')
        .update(payload)
        .eq('id', activePenalty.id)
        .is('redeemed_at', null)
        .is('attempted_at', null);
      if (error) throw error;

      if (isCorrect && account) {
        const wallet = account.toLowerCase();
        const refundEur = Number(activePenalty.penalty_eur) || 0;
        const refundMm3 = Number(activePenalty.penalty_value) || 0;
        const refundUsd = toUsdFromEur(refundEur);
        const refundCny = toCnyFromEur(refundEur);
        const { data: progressRow } = await supabase
          .from('player_progress')
          .select('mm3_sold, eur_earned, usd_earned, cny_earned')
          .eq('wallet', wallet)
          .maybeSingle();
        const refundPayload = refundEur > 0
          ? {
              wallet,
              eur_earned: (Number(progressRow?.eur_earned) || 0) + refundEur,
              usd_earned: (Number(progressRow?.usd_earned) || 0) + refundUsd,
              cny_earned: (Number(progressRow?.cny_earned) || 0) + refundCny,
              updated_at: new Date().toISOString(),
            }
          : {
              wallet,
              mm3_sold: Math.max(0, (Number(progressRow?.mm3_sold) || 0) - refundMm3),
              updated_at: new Date().toISOString(),
            };
        await supabase
          .from('player_progress')
          .upsert(refundPayload, { onConflict: 'wallet', ignoreDuplicates: false });
      }

      notify(isCorrect ? t('podcast.numericSuccess') : t('podcast.numericWrong'), isCorrect ? 'success' : 'error');
      setNumericCode('');
      await loadActivePenalty(selectedBlock?.block_key);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_dirty_at', String(Date.now()));
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet: account?.toLowerCase(), penalty: true } }));
      }
    } catch (err) {
      console.error('market penalty redeem:', err);
      notify(err?.message || t('podcast.claimFailed'), 'error');
    } finally {
      setProcessing(false);
    }
  };

  const move = (direction) => setSelectedKey((current) => stepSelection(mergedBlocks, current, direction));

  return (
    <div className="w-full font-mono text-cyan-100">
      {loading && <PageLoading label={t('podcast.loading')} />}

      <div className="mm3-market-shell mx-auto grid w-full max-w-[1080px] gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:items-start lg:gap-3 lg:px-2">
        <section className="min-w-0 rounded border border-cyan-500/15 bg-black/20 p-2 shadow-[0_0_18px_rgba(34,211,238,0.04)]">
          <div className="mm3-market-board-wrap mx-auto w-full max-w-[min(85vw,calc(100dvh-200px),520px)] lg:max-w-[min(100%,calc(100dvh-180px),500px)]">
            <div className="relative">
              <button
                type="button"
                onClick={() => move('up')}
                className="mm3-market-nav absolute left-1/2 top-0 z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border border-cyan-500/20 bg-black/90 text-[0.82rem] text-cyan-200 transition hover:border-cyan-400/45 hover:text-cyan-100"
                aria-label={t('podcast.panUp')}
              >▲</button>
              <button
                type="button"
                onClick={() => move('left')}
                className="mm3-market-nav absolute left-0 top-1/2 z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border border-cyan-500/20 bg-black/90 text-[0.82rem] text-cyan-200 transition hover:border-cyan-400/45 hover:text-cyan-100"
                aria-label={t('podcast.panLeft')}
              >◀</button>
              <button
                type="button"
                onClick={() => move('right')}
                className="mm3-market-nav absolute right-0 top-1/2 z-10 flex h-7 w-7 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border border-cyan-500/20 bg-black/90 text-[0.82rem] text-cyan-200 transition hover:border-cyan-400/45 hover:text-cyan-100"
                aria-label={t('podcast.panRight')}
              >▶</button>
              <button
                type="button"
                onClick={() => move('down')}
                className="mm3-market-nav absolute bottom-0 left-1/2 z-10 flex h-7 w-7 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded border border-cyan-500/20 bg-black/90 text-[0.82rem] text-cyan-200 transition hover:border-cyan-400/45 hover:text-cyan-100"
                aria-label={t('podcast.panDown')}
              >▼</button>

              <div className="mm3-market-board-frame overflow-hidden rounded border border-cyan-500/18 bg-black/40 p-1.5 shadow-[inset_0_0_24px_rgba(0,0,0,0.6),0_0_12px_rgba(34,211,238,0.06)]">
                <div
                  className="relative grid w-full"
                  style={{
                    gridTemplate: `repeat(${GRID_ROWS}, 1fr) / repeat(${GRID_COLS}, 1fr)`,
                    aspectRatio: '1 / 1',
                    gap: '1px',
                  }}
                >
                  {mergedBlocks.map((block) => {
                    const row = block.grid_row ?? 0;
                    const col = block.grid_col ?? 0;
                    const isSelected = block.block_key === selectedKey;
                    const isOwned = Array.isArray(block.current_owners) && block.current_owners.length > 0;
                    const tone = getTokenBlockTone(row, col);
                    const cellHex = getBlockHex(row, col);

                    return (
                      <button
                        key={block.block_key}
                        type="button"
                        onClick={() => handleBlockClick(block.block_key)}
                        className="relative flex items-center justify-center overflow-hidden transition duration-100 focus:outline-none"
                        style={{
                          background: isOwned
                            ? 'rgba(2,8,4,0.97)'
                            : isSelected
                              ? 'linear-gradient(180deg,rgba(250,204,21,0.42),rgba(113,63,18,0.95))'
                              : undefined,
                          backgroundImage: !isOwned && !isSelected ? tone.backgroundImage : undefined,
                          backgroundSize: !isOwned && !isSelected ? tone.backgroundSize : undefined,
                          backgroundPosition: !isOwned && !isSelected ? tone.backgroundPosition : undefined,
                          border: isSelected
                            ? '1px solid rgba(250,204,21,0.95)'
                            : isOwned
                              ? '1px solid rgba(34,197,94,0.18)'
                              : `1px solid ${tone.border}`,
                          boxShadow: isSelected
                            ? '0 0 10px rgba(250,204,21,0.35)'
                            : isOwned
                              ? 'inset 0 0 4px rgba(34,197,94,0.1)'
                              : 'none',
                        }}
                        title={`${block.emoji} ${language === 'es' ? block.title_es : block.title_en}`}
                      >
                        {isSelected && (
                          <>
                            <span className="pointer-events-none text-[min(2.4vw,0.92rem)] leading-none drop-shadow-[0_0_8px_rgba(250,204,21,0.35)] sm:text-[min(1.6vw,1rem)]">
                              {block.emoji}
                            </span>
                            <span className="pointer-events-none absolute bottom-[1px] right-[1px] text-[0.44rem] font-black tracking-[0.08em] text-cyan-100/90 sm:text-[0.3rem]">
                              {cellHex}
                            </span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="mm3-market-detail grid grid-cols-1 gap-1.5 rounded border border-cyan-500/12 bg-black/40 p-2 lg:grid-cols-2 lg:gap-1 lg:p-2 lg:self-stretch">

          {/* ── Header: emoji + title + hex + status badge ── */}
          <div className="mm3-market-detail-head col-span-1 flex items-start justify-between gap-2 lg:col-span-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base leading-none">{selectedBlock?.emoji}</span>
                {!selectedBlock?.isPlaceholder ? (
                  <Link href={`/market-short/${selectedBlock?.block_key}`} className="text-[0.82rem] font-black uppercase tracking-[0.18em] text-cyan-100 hover:text-cyan-300 hover:underline lg:text-[0.75rem]">{selectedTitle}</Link>
                ) : (
                  <span className="text-[0.82rem] font-black uppercase tracking-[0.18em] text-cyan-100 lg:text-[0.75rem]">{selectedTitle}</span>
                )}
              </div>
              <div className="mt-0.5 text-[0.82rem] font-black uppercase tracking-[0.16em] text-cyan-400/55 lg:text-[0.6rem]">{selectedBlockHex}</div>
            </div>
            <span
              className="mm3-market-status-badge shrink-0 rounded border px-1 py-0.5 text-[0.78rem] font-black uppercase tracking-[0.12em] lg:px-1.5 lg:text-[0.80rem] lg:tracking-[0.14em]"
              style={{
                borderColor: hasCurrentOwners ? 'rgba(74,222,128,0.3)' : 'rgba(34,211,238,0.22)',
                color: hasCurrentOwners ? '#4ade80' : '#67e8f9',
              }}
            >
              {hasCurrentOwners ? t('podcast.sealed') : selectedBlock?.is_active ? t('podcast.live') : t('podcast.template')}
            </span>
          </div>

          {/* ── Price ── */}
          <div className="mm3-market-detail-card rounded border border-amber-400/14 bg-amber-950/8 px-2 py-1.5 lg:px-2.5 lg:py-2">
            <div className="text-[0.78rem] uppercase tracking-[0.16em] text-amber-300/65 lg:text-[0.80rem] lg:tracking-[0.18em]">{t('podcast.price')}</div>
            <div className="mt-1 text-[1.15rem] font-black leading-none text-amber-300 lg:text-lg">{displayPrice}</div>
          </div>

          {/* ── Owner shell ── */}
          <div className="mm3-market-detail-card rounded border border-cyan-500/12 bg-black/45 px-2 py-1.5 lg:px-2.5 lg:py-2">
            <div className="text-[0.78rem] uppercase tracking-[0.16em] text-cyan-300/65 lg:text-[0.80rem] lg:tracking-[0.18em]">{t('podcast.owner')}</div>
            <div className="mt-1 flex max-h-20 flex-col gap-1 overflow-y-auto pr-1">
              {hasCurrentOwners ? (
                currentOwners.map((owner) => {
                  const ownerColor = colorFromAddress(owner);
                  return (
                    <button
                      key={owner}
                      type="button"
                      onClick={() => openRankingWallet(owner)}
                      className="block text-left text-[0.88rem] transition hover:underline focus:outline-none lg:text-[0.95rem]"
                      style={{ color: ownerColor, textShadow: `0 0 10px ${ownerColor}33` }}
                      title={owner}
                    >
                      {shortenWallet(owner)}
                    </button>
                  );
                })
              ) : (
                <span className="text-[0.88rem] lg:text-[0.95rem]" style={{ color: '#cffafe', textShadow: '0 0 10px #cffafe33' }}>
                  {t('podcast.noWinner')}
                </span>
              )}
            </div>
          </div>

          {/* ── Video / Short ── */}
          {!selectedBlock?.isPlaceholder && (
            selectedBlock?.short_url ? (
              <div className="overflow-hidden rounded border border-cyan-500/10 bg-black/45 lg:col-span-2">
                <iframe
                  src={normalizeShortUrl(selectedBlock.short_url)}
                  className="aspect-video w-full"
                  allowFullScreen
                  title={selectedTitle}
                />
              </div>
            ) : (
              <Link
                href={`/market-short/${selectedBlock?.block_key}`}
                className="flex items-center justify-center gap-1 rounded border border-cyan-500/10 bg-black/25 px-2 py-1.5 text-[0.80rem] uppercase tracking-[0.14em] text-cyan-800/70 transition hover:border-cyan-500/25 hover:text-cyan-500/80 lg:col-span-2"
              >
                {t('podcast.videoSoon')}
              </Link>
            )
          )}

          {/* ── IRC Command — full width ── */}
          {selectedMarketCommand && (
            <div className="mm3-market-detail-card col-span-1 rounded border border-cyan-500/14 bg-black/45 px-2 py-1.5 lg:col-span-2 lg:px-2.5 lg:py-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="text-[0.78rem] uppercase tracking-[0.16em] text-cyan-300/65 lg:text-[0.80rem] lg:tracking-[0.18em]">{t('podcast.ircCommand')}</div>
                {activeBlockCommand && (
                  <div className="flex items-center gap-1 rounded border border-amber-400/30 bg-amber-950/20 px-1.5 py-0.5">
                    <span className="text-[0.5rem] uppercase tracking-[0.1em] text-amber-400/70">x =</span>
                    <span className="text-[0.75rem] font-black leading-none text-amber-300">{activeBlockCommand.formula_x}</span>
                  </div>
                )}
              </div>
              <div className="break-words text-[0.82rem] leading-relaxed text-cyan-100/70 lg:text-[0.6rem]">
                {selectedMarketCommand.command}
              </div>
              {activeBlockCommand && (
                <div className="mt-1 text-[0.5rem] uppercase tracking-[0.08em] text-amber-400/50">
                  {language === 'es'
                    ? `// sustituye x = ${activeBlockCommand.formula_x} → resultado entero = código numérico`
                    : `// plug x = ${activeBlockCommand.formula_x} into formula → integer result = numeric code`}
                </div>
              )}
              {canLaunchIrc ? (
                <Link
                  href={`/irc?command=${encodeURIComponent(selectedMarketCommand.command)}`}
                  className="mt-1.5 flex items-center justify-center rounded border border-cyan-500/28 bg-black/30 px-2 py-1 text-[0.76rem] font-black uppercase tracking-[0.14em] text-cyan-400/90 transition hover:border-cyan-400/55 hover:text-cyan-200"
                >
                  {t('podcast.launchIrcCommand')}
                </Link>
              ) : (
                <div className="mt-1.5 flex items-center justify-center rounded border border-slate-700/30 bg-black/20 px-2 py-1 text-[0.76rem] font-black uppercase tracking-[0.14em] text-slate-700 cursor-not-allowed select-none">
                  {t('podcast.ircLocked')}
                </div>
              )}
            </div>
          )}

          {/* ── Numeric code / Penalty redemption — full width ── */}
          <div className="mm3-market-detail-card col-span-1 rounded border border-fuchsia-400/12 bg-black/45 px-2 py-1.5 lg:col-span-2 lg:px-2.5 lg:py-2">
            <div className="mb-1 text-[0.78rem] uppercase tracking-[0.16em] text-fuchsia-300/65 lg:text-[0.80rem] lg:tracking-[0.18em]">
              {activePenalty ? t('podcast.numericPrompt') : t('podcast.numericLocked')}
            </div>
            {activePenalty ? (
              <div className="space-y-1.5">
                {/* Formula context repeated here so user can solve without scrolling */}
                {selectedMarketCommand && activeBlockCommand && (
                  <div className="rounded border border-fuchsia-400/10 bg-fuchsia-950/12 px-1.5 py-1">
                    <div className="break-words text-[0.78rem] leading-relaxed text-fuchsia-100/45">
                      {selectedMarketCommand.command}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-[0.5rem] uppercase tracking-[0.1em] text-fuchsia-400/60">x =</span>
                      <span className="text-[0.5rem] font-black text-fuchsia-200">{activeBlockCommand.formula_x}</span>
                      <span className="text-[0.5rem] uppercase tracking-[0.08em] text-fuchsia-400/45">
                        {language === 'es' ? '// resultado → código 5 dígitos' : '// result → 5-digit code'}
                      </span>
                    </div>
                  </div>
                )}
                <div className="text-[0.80rem] uppercase tracking-[0.12em] text-fuchsia-200/75">
                  -{activePenaltyValue.toFixed(8).replace(/\.?0+$/, '') || '0'} MM3
                </div>
                <div className="flex gap-1">
                  <input
                    value={numericCode}
                    onChange={(event) => setNumericCode(clampDigits(event.target.value).slice(0, 5))}
                    disabled={Boolean(activePenalty.attempted_at) || processing}
                    inputMode="numeric"
                    maxLength={5}
                    placeholder={t('podcast.numericCodeHint')}
                    className="mm3-market-answer-input min-w-0 flex-1 rounded border border-fuchsia-400/18 bg-black/70 px-1.5 py-1 text-[0.82rem] text-fuchsia-100 outline-none placeholder:text-fuchsia-800/60 disabled:opacity-35"
                  />
                  <button
                    type="button"
                    onClick={handleRedeemPenalty}
                    disabled={!canRedeemPenalty}
                    className="rounded border border-fuchsia-400/24 bg-black/60 px-2 py-1 text-[0.76rem] font-black uppercase tracking-[0.14em] text-fuchsia-200 transition hover:border-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    ok
                  </button>
                </div>
                {activePenalty.attempted_at && (
                  <div className="text-[0.78rem] uppercase tracking-[0.12em] text-fuchsia-500/70">{t('podcast.numericUsed')}</div>
                )}
              </div>
            ) : (
              <div className="text-[0.80rem] uppercase tracking-[0.12em] text-slate-600">{t('podcast.noPenalty')}</div>
            )}
          </div>

          {/* ── Stats: purchases / resells — compact inline row ── */}
          {!selectedBlock?.isPlaceholder && (
            <div className="col-span-1 flex items-center gap-3 px-0.5 lg:col-span-2">
              <div className="flex items-center gap-1">
                <span className="text-[0.55rem] uppercase tracking-[0.12em] text-slate-600">{t('podcast.statBuys')}</span>
                <span className="text-[0.82rem] font-black text-cyan-400/60">{selectedBlock?.buy_count ?? 0}</span>
              </div>
              <span className="text-[0.78rem] text-slate-700">//</span>
              <div className="flex items-center gap-1">
                <span className="text-[0.55rem] uppercase tracking-[0.12em] text-slate-600">{t('podcast.statResells')}</span>
                <span className="text-[0.82rem] font-black text-fuchsia-400/60">{selectedBlock?.resell_count ?? 0}</span>
              </div>
            </div>
          )}

          {/* ── Auto-resell warning ── */}
          {hasOtherNFTJI && !ownsSelected && !selectedBlock?.isPlaceholder && (
            <div className="rounded border border-red-400/25 bg-red-950/10 px-2 py-1 text-[0.78rem] uppercase tracking-[0.12em] text-red-400/70 lg:col-span-2">
              {t('podcast.autoResoldHint')}
            </div>
          )}

          {/* ── Buy / Resell ── */}
          <div className="mt-auto flex flex-col gap-1 pt-0.5 lg:col-span-2">
            {canResell ? (
              <button
                type="button"
                onClick={handleResell}
                disabled={processing}
                className="mm3-market-claim w-full rounded border border-green-400/35 bg-black/70 px-2.5 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.18em] text-green-300 transition hover:border-green-300 hover:text-green-100 disabled:cursor-not-allowed disabled:opacity-35 lg:px-3 lg:py-2 lg:text-[0.75rem] lg:tracking-[0.22em]"
              >
                {processing ? '[ sync ]' : t('podcast.resell')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBuy}
                disabled={!canBuy}
                className="mm3-market-claim w-full rounded border border-cyan-400/28 bg-black/70 px-2.5 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35 lg:px-3 lg:py-2 lg:text-[0.75rem] lg:tracking-[0.22em]"
              >
                {processing ? '[ sync ]' : t('podcast.buy')}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
