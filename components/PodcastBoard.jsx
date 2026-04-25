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

const GENESIS_PIXEL_KEY = 'mm3-023';
const GRID_ROWS = 28;
const GRID_COLS = 28;

const MYSTERY_EMOJIS = ['🌑', '🌊', '🧲', '🔥', '🌿', '💧', '🌈', '🌙', '🦋', '🎯', '🧩', '🔮', '🎲', '⚗️', '🌸', '🌺', '🧊', '🎪', '🪐', '🏔️'];

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

function shortenWallet(value) {
  const wallet = String(value || '');
  if (wallet.length <= 14) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function getTokenPixelTone(row, col) {
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
  const current = blocks.find((entry) => entry.pixel_key === currentKey) || blocks[0];
  if (!current) return currentKey;

  let best = current;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of blocks) {
    if (candidate.pixel_key === current.pixel_key) continue;
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

  return best.pixel_key;
}

const CATALOG_BLOCKS = [
  { pixel_key: 'mm3-023', grid_row: 0,  grid_col: 22, emoji: WALLET_DECORATIONS.marketGenesis, title_en: 'Genesis Uplink',   title_es: 'Uplink Génesis',     price_eur: 1,   short_url: '', is_active: true },
  { pixel_key: 'mm3-05c', grid_row: 3,  grid_col: 8,  emoji: '🌐', title_en: 'Signal Nexus',    title_es: 'Nexo Señal',         price_eur: 3,   short_url: '', is_active: true },
  { pixel_key: 'mm3-0b9', grid_row: 6,  grid_col: 17, emoji: '🔭', title_en: 'Deep Relay',      title_es: 'Relay Profundo',     price_eur: 5,   short_url: '', is_active: true },
  { pixel_key: 'mm3-11b', grid_row: 10, grid_col: 3,  emoji: '🧬', title_en: 'Code Strand',     title_es: 'Cadena Código',      price_eur: 7,   short_url: '', is_active: true },
  { pixel_key: 'mm3-184', grid_row: 13, grid_col: 24, emoji: '💠', title_en: 'Fractal Core',    title_es: 'Núcleo Fractal',     price_eur: 10,  short_url: '', is_active: true },
  { pixel_key: 'mm3-1e7', grid_row: 17, grid_col: 11, emoji: '⚡', title_en: 'Arc Burst',       title_es: 'Destello Arco',      price_eur: 15,  short_url: '', is_active: true },
  { pixel_key: 'mm3-244', grid_row: 20, grid_col: 20, emoji: '🌀', title_en: 'Entropy Loop',    title_es: 'Bucle Entropía',     price_eur: 25,  short_url: '', is_active: true },
  { pixel_key: 'mm3-26d', grid_row: 22, grid_col: 5,  emoji: '🔴', title_en: 'Null Beacon',     title_es: 'Baliza Nula',        price_eur: 50,  short_url: '', is_active: true },
  { pixel_key: 'mm3-2ca', grid_row: 25, grid_col: 14, emoji: '⭐', title_en: 'Star Protocol',   title_es: 'Protocolo Estelar',  price_eur: 75,  short_url: '', is_active: true },
  { pixel_key: 'mm3-30e', grid_row: 27, grid_col: 26, emoji: '💎', title_en: 'Crystal Forge',   title_es: 'Forja Cristal',      price_eur: 100, short_url: '', is_active: true },
];

const CATALOG_KEY_SET = new Set(CATALOG_BLOCKS.map((b) => b.pixel_key));


export default function PodcastBoard({ account, isVirtualWallet = false }) {
  const { t, language } = useI18n();
  const { currency } = useCurrency();
  const { playMarketClaim } = useSound();
  const [blocks, setBlocks] = useState(CATALOG_BLOCKS);
  const [selectedKey, setSelectedKey] = useState(GENESIS_PIXEL_KEY);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [dbReady, setDbReady] = useState(true);
  const [walletState, setWalletState] = useState({
    funds: { EUR: 0, USD: 0, CNY: 0 },
    level: 0,
    mm3Sold: 0,
    totalMm3: 0,
    emojis: [],
    marketNftmojiKey: null,
    marketNftmojiPrice: 0,
  });

  const loadBlocks = async () => {
    setLoading(true);
    try {
      const [{ data: pixelData, error }, { data: ownersData }] = await Promise.all([
        supabase
          .from('mm3_podcast_pixels')
          .select('pixel_key, grid_row, grid_col, emoji, title_en, title_es, price_eur, short_url, is_active, first_purchased_at')
          .order('pixel_key', { ascending: true }),
        supabase
          .from('player_progress')
          .select('wallet, market_nftmoji_key')
          .not('market_nftmoji_key', 'is', null),
      ]);

      if (error) throw error;

      const currentOwnerByKey = new Map();
      for (const entry of ownersData || []) {
        if (entry.market_nftmoji_key) currentOwnerByKey.set(entry.market_nftmoji_key, entry.wallet);
      }

      const dbBlocks = Array.isArray(pixelData) ? pixelData : [];
      const dbByKey = new Map(dbBlocks.map((b) => [b.pixel_key, b]));

      const norm = (b) => ({
        ...b,
        price_eur: Number(b.price_eur) || 0,
        current_owner: currentOwnerByKey.get(b.pixel_key) || null,
      });

      const catalogMerged = CATALOG_BLOCKS.map((cat) =>
        norm(dbByKey.has(cat.pixel_key) ? { ...cat, ...dbByKey.get(cat.pixel_key) } : cat)
      );

      // Include dynamically spawned blocks (DB-only rows)
      const extraBlocks = dbBlocks
        .filter((b) => !CATALOG_KEY_SET.has(b.pixel_key))
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
        marketNftmojiKey: null,
        marketNftmojiPrice: 0,
      });
      return;
    }

    try {
      const wallet = account.toLowerCase();
      const [{ data: progress }, { data: stats }] = await Promise.all([
        supabase
          .from('player_progress')
          .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, market_nftmoji_key, market_nftmoji_price')
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
        marketNftmojiKey: progress?.market_nftmoji_key || null,
        marketNftmojiPrice: Number(progress?.market_nftmoji_price) || 0,
      });
    } catch (err) {
      console.error('market wallet load:', err);
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
      await supabase.from('mm3_podcast_pixels').insert({
        pixel_key: pixelKey,
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
    const pixelFromQuery = new URLSearchParams(window.location.search).get('pixel');
    if (pixelFromQuery) {
      setSelectedKey(pixelFromQuery);
    } else {
      setSelectedKey(CATALOG_BLOCKS[Math.floor(Math.random() * CATALOG_BLOCKS.length)].pixel_key);
    }
  }, []);

  useEffect(() => {
    loadBlocks();
  }, []);

  useEffect(() => {
    loadWalletState();
  }, [account]);

  useEffect(() => {
    const refresh = async () => {
      await Promise.all([loadBlocks(), loadWalletState()]);
    };

    window.addEventListener('mm3-db-updated', refresh);
    window.addEventListener('focus', refresh);

    const channel = supabase
      .channel('mm3-podcast-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_podcast_pixels' }, refresh)
      .subscribe();

    return () => {
      window.removeEventListener('mm3-db-updated', refresh);
      window.removeEventListener('focus', refresh);
      supabase.removeChannel(channel);
    };
  }, [account]);

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
            pixel_key: `ph-${row}-${col}`,
            grid_row: row, grid_col: col,
            emoji: '', title_en: '', title_es: '',
            price_eur: 0, short_url: '', is_active: false,
            current_owner: null, isPlaceholder: true,
          });
        }
      }
    }
    return result;
  }, [blocks]);

  const blockMap = useMemo(
    () => new Map(mergedBlocks.map((entry) => [String(entry.pixel_key), entry])),
    [mergedBlocks]
  );

  useEffect(() => {
    if (!blockMap.has(selectedKey)) {
      setSelectedKey(GENESIS_PIXEL_KEY);
    }
  }, [blockMap, selectedKey]);

  const selectedBlock = blockMap.get(selectedKey) || mergedBlocks[0];
  const priceEur = Number(selectedBlock?.price_eur) || 0;
  const priceUsd = toUsdFromEur(priceEur);
  const priceCny = toCnyFromEur(priceEur);
  const displayPrice =
    currency === 'USD'
      ? formatMoney(priceUsd, 'USD')
      : currency === 'CNY'
        ? formatMoney(priceCny, 'CNY')
        : formatMoney(priceEur, 'EUR');

  const activeFunds = Number(walletState.funds[currency] || 0);
  const activePrice =
    currency === 'USD' ? priceUsd : currency === 'CNY' ? priceCny : priceEur;
  const enoughFunds = activeFunds >= activePrice;

  const ownsSelected = Boolean(account) && walletState.marketNftmojiKey === selectedBlock?.pixel_key;
  const hasOtherNftmoji = Boolean(account) && Boolean(walletState.marketNftmojiKey) && walletState.marketNftmojiKey !== selectedBlock?.pixel_key;

  const canBuy =
    Boolean(account) &&
    dbReady &&
    Boolean(selectedBlock?.is_active) &&
    !selectedBlock?.isPlaceholder &&
    enoughFunds &&
    !ownsSelected &&
    !processing;

  const canResell = Boolean(account) && dbReady && ownsSelected && !processing;

  const selectedTitle = language === 'es'
    ? (selectedBlock?.title_es || selectedBlock?.title_en || t('podcast.template'))
    : (selectedBlock?.title_en || selectedBlock?.title_es || t('podcast.template'));

  const currentOwner = selectedBlock?.current_owner || null;
  const ownerColor = currentOwner ? colorFromAddress(currentOwner) : '#cffafe';
  const selectedBlockHex = getBlockHex(selectedBlock?.grid_row ?? 0, selectedBlock?.grid_col ?? 0);

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

  const handlePixelClick = (pixelKey) => {
    setSelectedKey(pixelKey);
    const block = blockMap.get(pixelKey);
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
          .from('mm3_podcast_pixels')
          .select('pixel_key, emoji, price_eur, is_active, first_purchased_at')
          .eq('pixel_key', selectedBlock.pixel_key)
          .maybeSingle(),
        supabase
          .from('player_progress')
          .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, market_nftmoji_key, market_nftmoji_price')
          .eq('wallet', wallet)
          .maybeSingle(),
        supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
      ]);

      if (blockError || !blockRow) throw blockError || new Error(t('podcast.dbMissing'));
      if (!blockRow.is_active) { await loadBlocks(); notify(t('podcast.offline'), 'info'); return; }

      const priceE = Number(blockRow.price_eur) || 0;
      const priceU = toUsdFromEur(priceE);
      const priceC = toCnyFromEur(priceE);

      const fundsEur = Number(progressRow?.eur_earned) || 0;
      const fundsUsd = Number(progressRow?.usd_earned) || 0;
      const fundsCny = Number(progressRow?.cny_earned) || 0;
      const activePriceCheck = currency === 'USD' ? priceU : currency === 'CNY' ? priceC : priceE;
      const activeFundsCheck = currency === 'USD' ? fundsUsd : currency === 'CNY' ? fundsCny : fundsEur;
      if (activeFundsCheck < activePriceCheck) { notify(t('podcast.fundsLow'), 'error'); return; }

      const level = Math.max(0, Math.min(100, Number(progressRow?.level) || 0));
      const soldMm3 = Number(progressRow?.mm3_sold) || 0;
      const totalMm3 = Number(statsRow?.total_eth) || 0;
      const currentDecorations = normalizeWalletDecorations(progressRow?.wallet_emojis);

      let newFundsEur = fundsEur;
      let newFundsUsd = fundsUsd;
      let newFundsCny = fundsCny;
      const oldKey = progressRow?.market_nftmoji_key;
      const oldPrice = Number(progressRow?.market_nftmoji_price) || 0;
      let autoResoldEmoji = null;

      // Auto-resell existing NFTmoji: 50% back, 50% to pool
      if (oldKey && oldPrice > 0) {
        const returnEur = oldPrice * 0.5;
        newFundsEur += returnEur;
        newFundsUsd += toUsdFromEur(returnEur);
        newFundsCny += toCnyFromEur(returnEur);

        const oldBlock = blocks.find((b) => b.pixel_key === oldKey);
        autoResoldEmoji = oldBlock?.emoji || null;

        const rateCny = getSellRateCny(level);
        const resellDelta = returnEur / (rateCny * CNY_TO_EUR);
        await supabase.from('mm3_market_events').insert({
          wallet,
          event_type: 'market_resell',
          delta_mm3: resellDelta,
          emoji: autoResoldEmoji || oldKey,
        });
      }

      // Deduct buy price
      newFundsEur -= priceE;
      newFundsUsd -= priceU;
      newFundsCny -= priceC;

      const rateCny = getSellRateCny(level);
      const buyDelta = priceE / (rateCny * CNY_TO_EUR);
      const liveQuote = getSellQuote(level, Math.max(0, totalMm3 - soldMm3), currentDecorations);
      const now = new Date().toISOString();

      const { error: progressError } = await supabase
        .from('player_progress')
        .upsert({
          wallet,
          level,
          mm3_sold: soldMm3,
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
          market_nftmoji_key: selectedBlock.pixel_key,
          market_nftmoji_price: priceE,
          market_nftmoji_since: now,
          updated_at: now,
        }, { onConflict: 'wallet', ignoreDuplicates: false });
      if (progressError) throw progressError;

      await supabase.from('mm3_market_events').insert({
        wallet,
        event_type: 'market_buy',
        delta_mm3: buyDelta,
        emoji: String(blockRow.emoji || selectedBlock.pixel_key),
      });

      // First-ever purchase: mark block and spawn a mystery block
      if (!blockRow.first_purchased_at) {
        await supabase
          .from('mm3_podcast_pixels')
          .update({ first_purchased_at: now })
          .eq('pixel_key', selectedBlock.pixel_key);
        await spawnNewBlock(blocks);
      }

      playMarketClaim();
      const msg = autoResoldEmoji
        ? `${t('podcast.autoResold')} ${autoResoldEmoji} → ${t('podcast.buySuccess')} ${blockRow.emoji}`
        : `${t('podcast.buySuccess')} ${blockRow.emoji}`;
      notify(msg, 'success');

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
          .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, market_nftmoji_key, market_nftmoji_price')
          .eq('wallet', wallet)
          .maybeSingle(),
        supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
      ]);

      if (!progressRow?.market_nftmoji_key || progressRow.market_nftmoji_key !== selectedBlock.pixel_key) {
        await loadWalletState();
        notify(t('podcast.notOwned'), 'info');
        return;
      }

      const level = Math.max(0, Math.min(100, Number(progressRow?.level) || 0));
      const soldMm3 = Number(progressRow?.mm3_sold) || 0;
      const totalMm3 = Number(statsRow?.total_eth) || 0;
      const currentDecorations = normalizeWalletDecorations(progressRow?.wallet_emojis);

      const oldPrice = Number(progressRow.market_nftmoji_price) || 0;
      const returnEur = oldPrice * 0.5;
      const returnUsd = toUsdFromEur(returnEur);
      const returnCny = toCnyFromEur(returnEur);

      const fundsEur = Number(progressRow.eur_earned) || 0;
      const fundsUsd = Number(progressRow.usd_earned) || 0;
      const fundsCny = Number(progressRow.cny_earned) || 0;

      const rateCny = getSellRateCny(level);
      const resellDelta = returnEur / (rateCny * CNY_TO_EUR);
      const liveQuote = getSellQuote(level, Math.max(0, totalMm3 - soldMm3), currentDecorations);
      const now = new Date().toISOString();

      const { error: progressError } = await supabase
        .from('player_progress')
        .upsert({
          wallet,
          level,
          mm3_sold: soldMm3,
          eur_earned: fundsEur + returnEur,
          usd_earned: fundsUsd + returnUsd,
          cny_earned: fundsCny + returnCny,
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
          market_nftmoji_key: null,
          market_nftmoji_price: 0,
          market_nftmoji_since: null,
          updated_at: now,
        }, { onConflict: 'wallet', ignoreDuplicates: false });
      if (progressError) throw progressError;

      const resoldBlock = blocks.find((b) => b.pixel_key === progressRow.market_nftmoji_key);
      await supabase.from('mm3_market_events').insert({
        wallet,
        event_type: 'market_resell',
        delta_mm3: resellDelta,
        emoji: String(resoldBlock?.emoji || progressRow.market_nftmoji_key),
      });

      notify(`${t('podcast.resellSuccess')} ${formatMoney(returnEur, 'EUR')}`, 'success');

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

  const move = (direction) => setSelectedKey((current) => stepSelection(mergedBlocks, current, direction));

  return (
    <div className="w-full font-mono text-cyan-100">
      {loading && <PageLoading label={t('podcast.loading')} />}

      <div className="mm3-market-shell grid gap-1.5 lg:grid-cols-[360px_148px] lg:items-stretch lg:justify-center lg:gap-1">
        <section className="min-w-0">
          <div className="mm3-market-board-wrap mx-auto w-full max-w-[min(86vw,calc(100dvh-250px))] lg:mx-0 lg:max-w-[360px]">
            <div className="relative">
              <button
                type="button"
                onClick={() => move('up')}
                className="mm3-market-nav absolute left-1/2 top-0 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border border-cyan-500/20 bg-black/90 text-[0.62rem] text-cyan-200 transition hover:border-cyan-400/45 hover:text-cyan-100"
                aria-label={t('podcast.panUp')}
              >▲</button>
              <button
                type="button"
                onClick={() => move('left')}
                className="mm3-market-nav absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border border-cyan-500/20 bg-black/90 text-[0.62rem] text-cyan-200 transition hover:border-cyan-400/45 hover:text-cyan-100"
                aria-label={t('podcast.panLeft')}
              >◀</button>
              <button
                type="button"
                onClick={() => move('right')}
                className="mm3-market-nav absolute right-0 top-1/2 z-10 flex h-8 w-8 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border border-cyan-500/20 bg-black/90 text-[0.62rem] text-cyan-200 transition hover:border-cyan-400/45 hover:text-cyan-100"
                aria-label={t('podcast.panRight')}
              >▶</button>
              <button
                type="button"
                onClick={() => move('down')}
                className="mm3-market-nav absolute bottom-0 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded border border-cyan-500/20 bg-black/90 text-[0.62rem] text-cyan-200 transition hover:border-cyan-400/45 hover:text-cyan-100"
                aria-label={t('podcast.panDown')}
              >▼</button>

              <div className="mm3-market-board-frame overflow-hidden rounded border border-cyan-500/10 bg-black/35 p-2">
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
                    const isSelected = block.pixel_key === selectedKey;
                    const isOwned = Boolean(block.current_owner);
                    const tone = getTokenPixelTone(row, col);
                    const cellHex = getBlockHex(row, col);

                    return (
                      <button
                        key={block.pixel_key}
                        type="button"
                        onClick={() => handlePixelClick(block.pixel_key)}
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
                            <span className="pointer-events-none absolute bottom-[1px] right-[1px] text-[0.26rem] font-black tracking-[0.08em] text-cyan-100/90 sm:text-[0.3rem]">
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

        <aside className="mm3-market-detail flex flex-col gap-1.5 rounded border border-cyan-500/12 bg-black/40 p-2 lg:self-stretch lg:gap-1 lg:p-2">
          <div className="mm3-market-detail-head flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base leading-none">{selectedBlock?.emoji}</span>
                {!selectedBlock?.isPlaceholder ? (
                  <Link href={`/market-short/${selectedBlock?.pixel_key}`} className="text-[0.58rem] font-black uppercase tracking-[0.18em] text-cyan-100 hover:text-cyan-300 hover:underline lg:text-[0.62rem]">{selectedTitle}</Link>
                ) : (
                  <span className="text-[0.58rem] font-black uppercase tracking-[0.18em] text-cyan-100 lg:text-[0.62rem]">{selectedTitle}</span>
                )}
              </div>
              <div className="mt-0.5 text-[0.44rem] font-black uppercase tracking-[0.16em] text-cyan-400/55 lg:text-[0.48rem]">{selectedBlockHex}</div>
            </div>
            <span
              className="mm3-market-status-badge shrink-0 rounded border px-1 py-0.5 text-[0.38rem] font-black uppercase tracking-[0.12em] lg:px-1.5 lg:text-[0.42rem] lg:tracking-[0.14em]"
              style={{
                borderColor: currentOwner ? 'rgba(74,222,128,0.3)' : 'rgba(34,211,238,0.22)',
                color: currentOwner ? '#4ade80' : '#67e8f9',
              }}
            >
              {currentOwner ? t('podcast.sealed') : selectedBlock?.is_active ? t('podcast.live') : t('podcast.template')}
            </span>
          </div>

          <div className="mm3-market-detail-card rounded border border-amber-400/14 bg-amber-950/8 px-2 py-1.5 lg:px-2.5 lg:py-2">
            <div className="text-[0.38rem] uppercase tracking-[0.16em] text-amber-300/65 lg:text-[0.42rem] lg:tracking-[0.18em]">{t('podcast.price')}</div>
            <div className="mt-1 text-[1.15rem] font-black leading-none text-amber-300 lg:text-lg">{displayPrice}</div>
          </div>

          <div className="mm3-market-detail-card rounded border border-cyan-500/12 bg-black/45 px-2 py-1.5 lg:px-2.5 lg:py-2">
            <div className="text-[0.38rem] uppercase tracking-[0.16em] text-cyan-300/65 lg:text-[0.42rem] lg:tracking-[0.18em]">{t('podcast.owner')}</div>
            <div className="mt-1">
              {currentOwner ? (
                <button
                  type="button"
                  onClick={() => openRankingWallet(currentOwner)}
                  className="text-[0.66rem] transition hover:underline focus:outline-none lg:text-[0.72rem]"
                  style={{ color: ownerColor, textShadow: `0 0 10px ${ownerColor}33` }}
                  title={currentOwner}
                >
                  {shortenWallet(currentOwner)}
                </button>
              ) : (
                <span className="text-[0.66rem] lg:text-[0.72rem]" style={{ color: ownerColor, textShadow: `0 0 10px ${ownerColor}33` }}>
                  {t('podcast.noWinner')}
                </span>
              )}
            </div>
          </div>

          {/* Video / Short link */}
          {!selectedBlock?.isPlaceholder && (
            selectedBlock?.short_url ? (
              <div className="overflow-hidden rounded border border-cyan-500/10 bg-black/45">
                <iframe
                  src={normalizeShortUrl(selectedBlock.short_url)}
                  className="aspect-video w-full"
                  allowFullScreen
                  title={selectedTitle}
                />
              </div>
            ) : (
              <Link
                href={`/market-short/${selectedBlock?.pixel_key}`}
                className="flex items-center justify-center gap-1 rounded border border-cyan-500/10 bg-black/25 px-2 py-1.5 text-[0.42rem] uppercase tracking-[0.14em] text-cyan-800/70 transition hover:border-cyan-500/25 hover:text-cyan-500/80"
              >
                {t('podcast.videoSoon')}
              </Link>
            )
          )}

          {/* Auto-resell warning when wallet owns a different NFTmoji */}
          {hasOtherNftmoji && !ownsSelected && !selectedBlock?.isPlaceholder && (
            <div className="rounded border border-amber-400/20 bg-amber-950/10 px-2 py-1 text-[0.38rem] uppercase tracking-[0.12em] text-amber-400/65">
              {t('podcast.autoResoldHint')}
            </div>
          )}

          <div className="mt-auto flex flex-col gap-1 pt-0.5">
            {canResell ? (
              <button
                type="button"
                onClick={handleResell}
                disabled={processing}
                className="mm3-market-claim w-full rounded border border-green-400/35 bg-black/70 px-2.5 py-1.5 text-[0.46rem] font-black uppercase tracking-[0.18em] text-green-300 transition hover:border-green-300 hover:text-green-100 disabled:cursor-not-allowed disabled:opacity-35 lg:px-3 lg:py-2 lg:text-[0.52rem] lg:tracking-[0.22em]"
              >
                {processing ? '[ sync ]' : t('podcast.resell')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBuy}
                disabled={!canBuy}
                className="mm3-market-claim w-full rounded border border-cyan-400/28 bg-black/70 px-2.5 py-1.5 text-[0.46rem] font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35 lg:px-3 lg:py-2 lg:text-[0.52rem] lg:tracking-[0.22em]"
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
