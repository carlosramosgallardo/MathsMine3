'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabaseClient';
import { useI18n } from '@/lib/i18n-context';
import { useCurrency } from '@/lib/currency-context';
import { CNY_TO_EUR, CNY_TO_USD, formatMoney, getSellQuote } from '@/lib/sell-offer';
import { colorFromAddress } from '@/lib/wallet-colors';
import PageLoading from '@/components/PageLoading';
import {
  appendWalletDecoration,
  normalizeWalletDecorations,
  WALLET_DECORATIONS,
} from '@/lib/wallet-decorations';
import { useSound } from '@/lib/sound-context';

const ANSWER_HASH_GENESIS = '0ac59a6eff4c0d73984b7ec775d6a01864e80dbc5e5488c594ed1ae4748ff56d';
const GENESIS_BLOCK_KEY = 'mm3-023';
const GRID_ROWS = 28;
const GRID_COLS = 28;


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


async function sha256(value) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
  // #016 — Genesis Uplink — SEALED
  { pixel_key: 'mm3-023', grid_row: 0,  grid_col: 22, emoji: WALLET_DECORATIONS.marketGenesis, title_en: 'Genesis Uplink',   title_es: 'Uplink Génesis',     answer_hash: ANSWER_HASH_GENESIS, price_eur: 1,   short_url: '', is_active: true,  claimed_by: null, claimed_source: null, claimed_at: null, paid_eur: 0, paid_usd: 0, paid_cny: 0 },
  // #05C — Signal Nexus
  { pixel_key: 'mm3-05c', grid_row: 3,  grid_col: 8,  emoji: '🌐', title_en: 'Signal Nexus',    title_es: 'Nexo Señal',         answer_hash: '',                  price_eur: 3,   short_url: '', is_active: true,  claimed_by: null, claimed_source: null, claimed_at: null, paid_eur: 0, paid_usd: 0, paid_cny: 0 },
  // #0B9 — Deep Relay
  { pixel_key: 'mm3-0b9', grid_row: 6,  grid_col: 17, emoji: '🔭', title_en: 'Deep Relay',      title_es: 'Relay Profundo',     answer_hash: '',                  price_eur: 5,   short_url: '', is_active: true,  claimed_by: null, claimed_source: null, claimed_at: null, paid_eur: 0, paid_usd: 0, paid_cny: 0 },
  // #11B — Code Strand
  { pixel_key: 'mm3-11b', grid_row: 10, grid_col: 3,  emoji: '🧬', title_en: 'Code Strand',     title_es: 'Cadena Código',      answer_hash: '',                  price_eur: 7,   short_url: '', is_active: true,  claimed_by: null, claimed_source: null, claimed_at: null, paid_eur: 0, paid_usd: 0, paid_cny: 0 },
  // #184 — Fractal Core
  { pixel_key: 'mm3-184', grid_row: 13, grid_col: 24, emoji: '💠', title_en: 'Fractal Core',    title_es: 'Núcleo Fractal',     answer_hash: '',                  price_eur: 10,  short_url: '', is_active: true,  claimed_by: null, claimed_source: null, claimed_at: null, paid_eur: 0, paid_usd: 0, paid_cny: 0 },
  // #1E7 — Arc Burst
  { pixel_key: 'mm3-1e7', grid_row: 17, grid_col: 11, emoji: '⚡', title_en: 'Arc Burst',       title_es: 'Destello Arco',      answer_hash: '',                  price_eur: 15,  short_url: '', is_active: true,  claimed_by: null, claimed_source: null, claimed_at: null, paid_eur: 0, paid_usd: 0, paid_cny: 0 },
  // #244 — Entropy Loop
  { pixel_key: 'mm3-244', grid_row: 20, grid_col: 20, emoji: '🌀', title_en: 'Entropy Loop',    title_es: 'Bucle Entropía',     answer_hash: '',                  price_eur: 25,  short_url: '', is_active: true,  claimed_by: null, claimed_source: null, claimed_at: null, paid_eur: 0, paid_usd: 0, paid_cny: 0 },
  // #26D — Null Beacon
  { pixel_key: 'mm3-26d', grid_row: 22, grid_col: 5,  emoji: '🔴', title_en: 'Null Beacon',     title_es: 'Baliza Nula',        answer_hash: '',                  price_eur: 50,  short_url: '', is_active: true,  claimed_by: null, claimed_source: null, claimed_at: null, paid_eur: 0, paid_usd: 0, paid_cny: 0 },
  // #2CA — Star Protocol
  { pixel_key: 'mm3-2ca', grid_row: 25, grid_col: 14, emoji: '⭐', title_en: 'Star Protocol',   title_es: 'Protocolo Estelar',  answer_hash: '',                  price_eur: 75,  short_url: '', is_active: true,  claimed_by: null, claimed_source: null, claimed_at: null, paid_eur: 0, paid_usd: 0, paid_cny: 0 },
  // #30E — Crystal Forge
  { pixel_key: 'mm3-30e', grid_row: 27, grid_col: 26, emoji: '💎', title_en: 'Crystal Forge',   title_es: 'Forja Cristal',      answer_hash: '',                  price_eur: 100, short_url: '', is_active: true,  claimed_by: null, claimed_source: null, claimed_at: null, paid_eur: 0, paid_usd: 0, paid_cny: 0 },
];

const FALLBACK_BLOCK = CATALOG_BLOCKS[0];


export default function PodcastBoard({ account, isVirtualWallet = false }) {
  const { t, language } = useI18n();
  const { currency } = useCurrency();
  const { playMarketClaim } = useSound();
  const [blocks, setBlocks] = useState(CATALOG_BLOCKS);
  const [selectedKey, setSelectedKey] = useState(GENESIS_BLOCK_KEY);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [dbReady, setDbReady] = useState(true);
  const [walletState, setWalletState] = useState({
    funds: { EUR: 0, USD: 0, CNY: 0 },
    level: 0,
    mm3Sold: 0,
    totalMm3: 0,
    emojis: [],
  });

  const loadBlocks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mm3_podcast_pixels')
        .select('pixel_key, grid_row, grid_col, emoji, title_en, title_es, answer_hash, price_eur, short_url, is_active, claimed_by, claimed_source, claimed_at, paid_eur, paid_usd, paid_cny')
        .order('pixel_key', { ascending: true });

      if (error) throw error;
      const dbBlocks = Array.isArray(data) ? data : [];
      const dbByKey = new Map(dbBlocks.map((b) => [b.pixel_key, b]));
      const norm = (b) => ({ ...b, price_eur: Number(b.price_eur) || 0, paid_eur: Number(b.paid_eur) || 0, paid_usd: Number(b.paid_usd) || 0, paid_cny: Number(b.paid_cny) || 0 });
      const merged = CATALOG_BLOCKS.map((cat) =>
        norm(dbByKey.has(cat.pixel_key) ? { ...cat, ...dbByKey.get(cat.pixel_key) } : cat)
      );
      setBlocks(merged);
      setDbReady(true);
    } catch (error) {
      console.error('market blocks load:', error);
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
      });
      return;
    }

    try {
      const wallet = account.toLowerCase();
      const [{ data: progress }, { data: stats }] = await Promise.all([
        supabase
          .from('player_progress')
          .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis')
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
      });
    } catch (error) {
      console.error('market wallet load:', error);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = new URLSearchParams(window.location.search);
    const blockFromQuery = query.get('block') || query.get('pixel');
    if (blockFromQuery) {
      setSelectedKey(blockFromQuery);
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

  // Real blocks placed at DB grid_row/grid_col; all other positions get placeholders.
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
            answer_hash: '', price_eur: 0, short_url: '', is_active: false,
            claimed_by: null, claimed_source: null, claimed_at: null,
            paid_eur: 0, paid_usd: 0, paid_cny: 0, isPlaceholder: true,
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
      setSelectedKey(GENESIS_BLOCK_KEY);
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
    currency === 'USD'
      ? priceUsd
      : currency === 'CNY'
        ? priceCny
        : priceEur;
  const enoughFunds = activeFunds >= activePrice;
  const alreadyOwnedSelected = selectedBlock?.emoji
    ? walletState.emojis.includes(String(selectedBlock.emoji))
    : false;

  const answerUnlocked =
    enoughFunds &&
    Boolean(selectedBlock?.is_active) &&
    !selectedBlock?.claimed_by &&
    !alreadyOwnedSelected;
  const canSubmit =
    Boolean(account) &&
    dbReady &&
    answerUnlocked &&
    answer.trim().length > 0 &&
    !processing;

  const selectedTitle = language === 'es'
    ? (selectedBlock?.title_es || selectedBlock?.title_en || t('podcast.template'))
    : (selectedBlock?.title_en || selectedBlock?.title_es || t('podcast.template'));
  const ownerColor = selectedBlock?.claimed_by ? colorFromAddress(selectedBlock.claimed_by) : '#cffafe';

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

  const handleBlockClick = (blockKey) => {
    setSelectedKey(blockKey);
    const block = blockMap.get(blockKey);
    if (!block?.short_url) notify(block?.isPlaceholder ? t('podcast.offline') : t('podcast.unavailable'), 'info');
  };

  const handleClaim = async () => {
    if (!account) {
      notify(t('podcast.noWallet'), 'error');
      return;
    }
    if (!answer.trim()) {
      notify(t('podcast.inputNeeded'), 'error');
      return;
    }
    if (!enoughFunds) {
      notify(t('podcast.fundsLow'), 'error');
      return;
    }
    if (!dbReady) {
      notify(t('podcast.dbMissing'), 'error');
      return;
    }
    if (!selectedBlock?.is_active || selectedBlock?.isPlaceholder) {
      notify(t('podcast.offline'), 'info');
      return;
    }
    if (alreadyOwnedSelected) {
      notify(t('podcast.alreadyOwned'), 'info');
      return;
    }

    setProcessing(true);
    try {
      const wallet = account.toLowerCase();
      const { data: blockRow, error: blockError } = await supabase
        .from('mm3_podcast_pixels')
        .select('pixel_key, emoji, answer_hash, price_eur, claimed_by, is_active')
        .eq('pixel_key', selectedBlock.pixel_key)
        .maybeSingle();

      if (blockError || !blockRow) throw blockError || new Error(t('podcast.dbMissing'));
      if (!blockRow.is_active || blockRow.claimed_by) {
        await loadBlocks();
        notify(t('podcast.sealed'), 'info');
        return;
      }

      const typedHash = await sha256(clampDigits(answer));
      if (typedHash !== String(blockRow.answer_hash || '')) {
        notify(t('podcast.wrongAnswer'), 'error');
        return;
      }

      const [{ data: progressRow }, { data: statsRow }] = await Promise.all([
        supabase
          .from('player_progress')
          .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed')
          .eq('wallet', wallet)
          .maybeSingle(),
        supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
      ]);

      const fundsEur = Number(progressRow?.eur_earned) || 0;
      const fundsUsd = Number(progressRow?.usd_earned) || 0;
      const fundsCny = Number(progressRow?.cny_earned) || 0;
      const fundsByCurrency = { EUR: fundsEur, USD: fundsUsd, CNY: fundsCny };
      if ((Number(fundsByCurrency[currency]) || 0) < activePrice) {
        notify(t('podcast.fundsLow'), 'error');
        return;
      }

      const level = Math.max(0, Math.min(100, Number(progressRow?.level) || 0));
      const soldMm3 = Number(progressRow?.mm3_sold) || 0;
      const totalMm3 = Number(statsRow?.total_eth) || 0;
      const currentDecorations = normalizeWalletDecorations(progressRow?.wallet_emojis);
      const alreadyOwned = currentDecorations.includes(blockRow.emoji);
      if (alreadyOwned) {
        notify(t('podcast.alreadyOwned'), 'info');
        return;
      }

      const nextDecorations = appendWalletDecoration(currentDecorations, blockRow.emoji);
      const liveQuote = getSellQuote(level, Math.max(0, totalMm3 - soldMm3), nextDecorations);
      const claimedAt = new Date().toISOString();

      const progressPayload = {
        wallet,
        level,
        mm3_sold: soldMm3,
        cny_earned: currency === 'CNY' ? fundsCny - priceCny : fundsCny,
        eur_earned: currency === 'EUR' ? fundsEur - priceEur : fundsEur,
        usd_earned: currency === 'USD' ? fundsUsd - priceUsd : fundsUsd,
        wallet_emojis: nextDecorations,
        life_used: Boolean(progressRow?.life_used),
        lucky_50_claimed: Boolean(progressRow?.lucky_50_claimed),
        lucky_100_claimed: Boolean(progressRow?.lucky_100_claimed),
        lucky_500_claimed: Boolean(progressRow?.lucky_500_claimed),
        lucky_1000_claimed: Boolean(progressRow?.lucky_1000_claimed),
        sell_rate_cny: liveQuote.rateCny,
        sell_quote_cny: liveQuote.netCny,
        sell_quote_eur: liveQuote.netEur,
        sell_quote_usd: liveQuote.netUsd,
        updated_at: new Date().toISOString(),
      };

      const { error: progressError } = await supabase
        .from('player_progress')
        .upsert(progressPayload, { onConflict: 'wallet', ignoreDuplicates: false });
      if (progressError) throw progressError;

      const { data: claimedRows, error: claimError } = await supabase
        .from('mm3_podcast_pixels')
        .update({
          claimed_by: wallet,
          claimed_source: isVirtualWallet ? 'google' : 'wallet',
          claimed_at: claimedAt,
          paid_eur: priceEur,
          paid_usd: priceUsd,
          paid_cny: priceCny,
          updated_at: claimedAt,
        })
        .eq('pixel_key', selectedBlock.pixel_key)
        .is('claimed_by', null)
        .select('pixel_key');

      if (claimError) throw claimError;
      if (!claimedRows?.length) {
        await loadBlocks();
        notify(t('podcast.sealed'), 'info');
        return;
      }

      setAnswer('');
      playMarketClaim();
      notify(t('podcast.claimSuccess'), 'success');
      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_dirty_at', String(Date.now()));
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet, special: true, podcast: true } }));
      }
      await Promise.all([loadBlocks(), loadWalletState()]);
    } catch (error) {
      console.error('market claim:', error);
      notify(error?.message || t('podcast.claimFailed'), 'error');
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
                    const isClaimed = Boolean(block.claimed_by);
                    const tone = getTokenBlockTone(row, col);
                    const cellHex = getBlockHex(row, col);

                    return (
                      <button
                        key={block.pixel_key}
                        type="button"
                        onClick={() => handleBlockClick(block.pixel_key)}
                        className="relative flex items-center justify-center overflow-hidden transition duration-100 focus:outline-none"
                        style={{
                          background: isClaimed
                            ? 'rgba(2,8,4,0.97)'
                            : isSelected
                              ? 'linear-gradient(180deg,rgba(250,204,21,0.42),rgba(113,63,18,0.95))'
                              : undefined,
                          backgroundImage: !isClaimed && !isSelected ? tone.backgroundImage : undefined,
                          backgroundSize: !isClaimed && !isSelected ? tone.backgroundSize : undefined,
                          backgroundPosition: !isClaimed && !isSelected ? tone.backgroundPosition : undefined,
                          border: isSelected
                            ? '1px solid rgba(250,204,21,0.95)'
                            : isClaimed
                              ? '1px solid rgba(34,197,94,0.18)'
                              : `1px solid ${tone.border}`,
                          boxShadow: isSelected
                            ? '0 0 10px rgba(250,204,21,0.35)'
                            : isClaimed
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
                borderColor: selectedBlock?.claimed_by ? 'rgba(74,222,128,0.3)' : 'rgba(34,211,238,0.22)',
                color: selectedBlock?.claimed_by ? '#4ade80' : '#67e8f9',
              }}
            >
              {selectedBlock?.claimed_by ? t('podcast.sealed') : selectedBlock?.is_active ? t('podcast.live') : t('podcast.template')}
            </span>
          </div>

          <div className="mm3-market-detail-card rounded border border-amber-400/14 bg-amber-950/8 px-2 py-1.5 lg:px-2.5 lg:py-2">
            <div className="text-[0.38rem] uppercase tracking-[0.16em] text-amber-300/65 lg:text-[0.42rem] lg:tracking-[0.18em]">{t('podcast.price')}</div>
            <div className="mt-1 text-[1.15rem] font-black leading-none text-amber-300 lg:text-lg">{displayPrice}</div>
          </div>

          <div className="mm3-market-detail-card rounded border border-cyan-500/12 bg-black/55 px-2 py-1.5 lg:px-2.5 lg:py-2">
            <div className="mb-1 text-[0.38rem] uppercase tracking-[0.16em] text-cyan-400/65 lg:text-[0.42rem] lg:tracking-[0.18em]">{t('podcast.answer')}</div>
            <input
              value={answer}
              inputMode="numeric"
              maxLength={10}
              onChange={(event) => setAnswer(clampDigits(event.target.value))}
              placeholder=""
              className="mm3-market-answer-input w-full rounded border px-1.5 py-1.5 text-[0.72rem] text-cyan-100 outline-none transition lg:px-2 lg:text-[0.8rem]"
              style={{
                borderColor: answerUnlocked ? 'rgba(34,211,238,0.45)' : 'rgba(100,116,139,0.2)',
                background: answerUnlocked ? 'rgba(0,0,0,0.8)' : 'rgba(15,23,42,0.65)',
                color: answerUnlocked ? '#cffafe' : 'rgba(148,163,184,0.38)',
              }}
              disabled={!answerUnlocked || processing}
            />
          </div>

          <div className="mm3-market-detail-card rounded border border-cyan-500/12 bg-black/45 px-2 py-1.5 lg:px-2.5 lg:py-2">
            <div className="text-[0.38rem] uppercase tracking-[0.16em] text-cyan-300/65 lg:text-[0.42rem] lg:tracking-[0.18em]">{t('podcast.owner')}</div>
            <div className="mt-1">
              {selectedBlock?.claimed_by ? (
                <button
                  type="button"
                  onClick={() => openRankingWallet(selectedBlock.claimed_by)}
                  className="text-[0.66rem] transition hover:underline focus:outline-none lg:text-[0.72rem]"
                  style={{ color: ownerColor, textShadow: `0 0 10px ${ownerColor}33` }}
                  title={selectedBlock.claimed_by}
                >
                  {shortenWallet(selectedBlock.claimed_by)}
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

          <div className="mt-auto pt-0.5">
            <button
              type="button"
              onClick={handleClaim}
              disabled={!canSubmit}
              className="mm3-market-claim w-full rounded border border-cyan-400/28 bg-black/70 px-2.5 py-1.5 text-[0.46rem] font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35 lg:px-3 lg:py-2 lg:text-[0.52rem] lg:tracking-[0.22em]"
            >
              {processing ? '[ sync ]' : t('podcast.submit')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
