'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

const ANSWER_HASH_GENESIS = '0ac59a6eff4c0d73984b7ec775d6a01864e80dbc5e5488c594ed1ae4748ff56d';
const GENESIS_PIXEL_KEY = 'mm3-023';
const GRID_ROWS = 28;
const GRID_COLS = 28;
const VIEWPORT_ROWS = 8;
const MOBILE_VIEWPORT_ROWS = 14;
const MOBILE_VIEWPORT_COLS = 13;

const PLACEHOLDER_EMOJIS = [
  '💎', '🪐', '📡', '🎧', '📼', '🏆', '💾', '🧷', '🧲', '🪫', '⭐', '💿', '🪩',
  '🧯', '🧬', '🌟', '☢', '⚗️', '🪙', '📟', '🕹', '🎛', '✨', '⚡', '📻',
  '🔭', '🗜', '🧰', '💫', '🔩', '⚙', '🗝', '⛓', '🪤', '🧱', '📎', '✂', '🔐',
  '🛠', '🔌', '🎇', '🕯', '📀', '🪪', '🧭', '🪞', '🪬', '🥇', '⚜️', '🪁'
];

const PLACEHOLDER_NAMES_EN = [
  'Null relay', 'Cipher cache', 'Retro shard', 'Hash prism', 'Tape daemon', 'Orbital latch',
  'Neon bus', 'Static forge', 'Ghost patch', 'Signal kiln', 'Pulse crate', 'Kernel spark',
  'Proxy rune', 'Noise latch', 'Arc shell', 'Mirror vault', 'Dust repeater', 'Copper void',
  'Cold socket', 'Wire relic', 'Miner tape', 'Byte lantern', 'Signal comb', 'Phase spool',
  'Echo clutch', 'Vacuum token', 'Grid cassette', 'Heat sink', 'Vector husk', 'Core fuse',
  'Plasma stub', 'Quartz node', 'Loop pin', 'Codec shard', 'Static idol', 'Rift spool',
  'Torch latch', 'Patch idol', 'Vault coil', 'Frame token', 'Noise engine', 'Delta shell',
  'Rust beacon', 'Spine cache', 'Split cassette', 'Mica relay', 'Circuit relic', 'Tape prism',
  'Cryo shell', 'Kernel husk', 'Zero uplink'
];

const PLACEHOLDER_NAMES_ES = [
  'Relay nulo', 'Cache cifrado', 'Shard retro', 'Prisma hash', 'Daemon cinta', 'Pestillo orbital',
  'Bus neón', 'Forja estática', 'Patch fantasma', 'Horno de señal', 'Caja de pulso', 'Chispa kernel',
  'Runa proxy', 'Pestillo ruido', 'Shell de arco', 'Bóveda espejo', 'Repetidor polvo', 'Vacío cobre',
  'Socket frío', 'Reliquia cable', 'Cinta minera', 'Linterna byte', 'Peine señal', 'Bobina fase',
  'Embrague eco', 'Token vacío', 'Cassette grid', 'Disipador calor', 'Cáscara vector', 'Fusible core',
  'Stub plasma', 'Nodo cuarzo', 'Pin loop', 'Shard codec', 'Ídolo estático', 'Bobina grieta',
  'Pestillo antorcha', 'Ídolo patch', 'Bobina bóveda', 'Token frame', 'Motor ruido', 'Shell delta',
  'Baliza óxido', 'Cache espina', 'Cassette partido', 'Relay mica', 'Reliquia circuito', 'Prisma cinta',
  'Shell cryo', 'Cáscara kernel', 'Uplink cero'
];

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

async function sha256(value) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getTokenPixelTone(row, col) {
  return {
    backgroundImage: 'url(/mm3-token.png)',
    backgroundSize: `${GRID_COLS * 100}% ${GRID_ROWS * 100}%`,
    backgroundPosition: `${(col / (GRID_COLS - 1)) * 100}% ${(row / (GRID_ROWS - 1)) * 100}%`,
    border: 'rgba(34,211,238,0.08)',
  };
}

const FALLBACK_BLOCK = {
  pixel_key: GENESIS_PIXEL_KEY,
  grid_row: 0,
  grid_col: 22,
  emoji: WALLET_DECORATIONS.marketGenesis,
  title_en: 'Genesis uplink',
  title_es: 'Uplink génesis',
  answer_hash: ANSWER_HASH_GENESIS,
  price_eur: 1,
  short_url: '',
  is_active: true,
  claimed_by: null,
  claimed_source: null,
  claimed_at: null,
  paid_eur: 0,
  paid_usd: 0,
  paid_cny: 0,
};


export default function PodcastBoard({ account, isVirtualWallet = false }) {
  const { t, language } = useI18n();
  const { currency } = useCurrency();
  const [blocks, setBlocks] = useState([FALLBACK_BLOCK]);
  const [selectedKey, setSelectedKey] = useState(GENESIS_PIXEL_KEY);
  const [viewportRow, setViewportRow] = useState(0);
  const [viewportCol, setViewportCol] = useState(0);
  const [activeCols, setActiveCols] = useState(GRID_COLS);
  const [activeRows, setActiveRows] = useState(VIEWPORT_ROWS);
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
      const nextBlocks = Array.isArray(data) && data.length ? data : [FALLBACK_BLOCK];
      setBlocks(
        nextBlocks.map((entry) => ({
          ...entry,
          price_eur: Number(entry.price_eur) || 0,
          paid_eur: Number(entry.paid_eur) || 0,
          paid_usd: Number(entry.paid_usd) || 0,
          paid_cny: Number(entry.paid_cny) || 0,
        }))
      );
      setDbReady(true);
    } catch (error) {
      console.error('market blocks load:', error);
      setBlocks([FALLBACK_BLOCK]);
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
    const pixelFromQuery = new URLSearchParams(window.location.search).get('pixel');
    if (pixelFromQuery) setSelectedKey(pixelFromQuery);
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

  useEffect(() => {
    const update = () => {
      const isMobile = window.innerWidth < 1024;
      setActiveCols(isMobile ? MOBILE_VIEWPORT_COLS : GRID_COLS);
      setActiveRows(isMobile ? MOBILE_VIEWPORT_ROWS : VIEWPORT_ROWS);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (activeCols === GRID_COLS) setViewportCol(0);
  }, [activeCols]);

  useEffect(() => {
    setViewportRow((r) => Math.min(r, Math.max(0, GRID_ROWS - activeRows)));
  }, [activeRows]);

  // Real blocks placed at DB grid_row/grid_col; all other positions get placeholders.
  const mergedBlocks = useMemo(() => {
    const posMap = new Map();
    for (const b of blocks) {
      if (b.grid_row !== null && b.grid_col !== null) {
        posMap.set(`${b.grid_row}-${b.grid_col}`, { ...b, isPlaceholder: false });
      }
    }
    const result = [];
    let phIdx = 0;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const key = `${row}-${col}`;
        if (posMap.has(key)) {
          result.push(posMap.get(key));
        } else {
          result.push({
            pixel_key: `ph-${row}-${col}`,
            grid_row: row, grid_col: col,
            emoji: PLACEHOLDER_EMOJIS[phIdx % PLACEHOLDER_EMOJIS.length] || '◈',
            title_en: PLACEHOLDER_NAMES_EN[phIdx % PLACEHOLDER_NAMES_EN.length] || `Template shell ${phIdx + 1}`,
            title_es: PLACEHOLDER_NAMES_ES[phIdx % PLACEHOLDER_NAMES_ES.length] || `Shell plantilla ${phIdx + 1}`,
            answer_hash: '', price_eur: 0, short_url: '', is_active: false,
            claimed_by: null, claimed_source: null, claimed_at: null,
            paid_eur: 0, paid_usd: 0, paid_cny: 0, isPlaceholder: true,
          });
          phIdx++;
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

  const currentIndex = mergedBlocks.findIndex((entry) => entry.pixel_key === selectedKey);

  const selectedFlatIndex = ((selectedBlock?.grid_row ?? 0) * GRID_COLS) + (selectedBlock?.grid_col ?? 0);
  const selectedBlockHex = '#' + selectedFlatIndex.toString(16).toUpperCase().padStart(3, '0');

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const target = event.target;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      event.preventDefault();
      const current = mergedBlocks[currentIndex >= 0 ? currentIndex : 0];
      if (!current) return;

      let best = current;
      let bestScore = Number.POSITIVE_INFINITY;
      for (const candidate of mergedBlocks) {
        if (candidate.pixel_key === current.pixel_key) continue;
        const dx = candidate.grid_col - current.grid_col;
        const dy = candidate.grid_row - current.grid_row;
        const horizontalScore = Math.abs(dx) * 10 + Math.abs(dy);
        const verticalScore = Math.abs(dy) * 10 + Math.abs(dx);

        const valid =
          (event.key === 'ArrowRight' && dx > 0) ||
          (event.key === 'ArrowLeft' && dx < 0) ||
          (event.key === 'ArrowDown' && dy > 0) ||
          (event.key === 'ArrowUp' && dy < 0);
        if (!valid) continue;
        const score = event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? horizontalScore : verticalScore;
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
      if (best.pixel_key !== current.pixel_key) setSelectedKey(best.pixel_key);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mergedBlocks, currentIndex]);

  useEffect(() => {
    const block = blockMap.get(selectedKey);
    if (!block || block.grid_row == null) return;
    setViewportRow((prev) => {
      const max = GRID_ROWS - activeRows;
      if (block.grid_row < prev) return Math.max(0, block.grid_row);
      if (block.grid_row >= prev + activeRows) return Math.min(max, block.grid_row - activeRows + 1);
      return prev;
    });
    setViewportCol((prev) => {
      const maxCol = Math.max(0, GRID_COLS - activeCols);
      if (block.grid_col < prev) return Math.max(0, block.grid_col);
      if (block.grid_col >= prev + activeCols) return Math.min(maxCol, block.grid_col - activeCols + 1);
      return prev;
    });
  }, [selectedKey, blockMap, activeCols, activeRows]);


  const handlePixelClick = (pixelKey) => {
    setSelectedKey(pixelKey);
    const block = blockMap.get(pixelKey);
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

  const fireRouteLoading = (label) =>
    window.dispatchEvent(new CustomEvent('mm3-route-loading', { detail: { href: '/market/full', label } }));

  return (
    <div className="w-full font-mono text-cyan-100">
      {loading && <PageLoading label={t('podcast.loading')} />}

      <div className="mb-2 flex justify-end">
        <Link
          href={`/market/full?pixel=${encodeURIComponent(selectedKey)}`}
          onClick={() => fireRouteLoading(t('podcast.openFullBoard'))}
          className="border border-cyan-500/20 bg-transparent px-2.5 py-1 text-[0.52rem] font-black uppercase tracking-[0.28em] text-cyan-400/50 transition hover:border-cyan-400/50 hover:text-cyan-300"
        >
          [ {t('podcast.openFullBoard')} ]
        </Link>
      </div>

      <div className="flex flex-row items-stretch gap-1.5 lg:grid lg:grid-cols-[260px_1fr] lg:items-stretch lg:gap-4">

        <section className="flex w-[38%] shrink-0 flex-col rounded-xl border border-cyan-500/20 bg-black/60 p-2 lg:w-auto lg:p-3">
          <div className="mb-2 flex flex-col gap-1 lg:mb-3 lg:flex-row lg:items-start lg:justify-between lg:gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <span className="shrink-0 text-sm leading-none">{selectedBlock?.emoji}</span>
              {(selectedBlock?.pixel_key === GENESIS_PIXEL_KEY || (!selectedBlock?.isPlaceholder && normalizeShortUrl(selectedBlock?.short_url))) ? (
                <Link
                  href={`/market-short/${selectedBlock.pixel_key}`}
                  className="truncate text-xs font-black text-cyan-100 transition hover:text-cyan-300 hover:underline lg:text-sm"
                >
                  {selectedTitle}
                </Link>
              ) : (
                <span className="truncate text-xs font-black text-cyan-100 lg:text-sm">{selectedTitle}</span>
              )}
            </div>
            <span
              className="self-start rounded border px-1 py-0.5 text-[0.42rem] font-black uppercase tracking-[0.12em] lg:px-1.5 lg:text-[0.48rem] lg:tracking-[0.15em]"
              style={{
                borderColor: selectedBlock?.claimed_by ? 'rgba(74,222,128,0.55)' : 'rgba(34,211,238,0.35)',
                color: selectedBlock?.claimed_by ? '#4ade80' : '#22d3ee',
              }}
            >
              {selectedBlock?.claimed_by ? t('podcast.sealed') : selectedBlock?.is_active ? t('podcast.live') : t('podcast.template')}
            </span>
          </div>

          {/* Price + answer — stacked on mobile, 2-col on desktop */}
          <div className="mb-2 grid grid-cols-1 gap-1.5 lg:grid-cols-2 lg:gap-2">
            <div className="rounded-lg border border-amber-400/20 bg-amber-950/10 px-2 py-1.5">
              <div className="text-[0.42rem] uppercase tracking-[0.14em] text-amber-300/70 lg:text-[0.48rem]">{t('podcast.price')}</div>
              <div className="mt-1 text-base font-black leading-none text-amber-300 lg:mt-2 lg:text-xl">{displayPrice}</div>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-black/60 px-2 py-1.5">
              <div className="mb-1 text-[0.42rem] uppercase tracking-[0.14em] text-cyan-400/70 lg:mb-1.5 lg:text-[0.48rem]">{t('podcast.answer')}</div>
              <input
                value={answer}
                inputMode="numeric"
                maxLength={10}
                onChange={(event) => setAnswer(clampDigits(event.target.value))}
                placeholder=""
                className="w-full rounded border px-1.5 py-1 text-xs text-cyan-100 outline-none transition lg:px-2 lg:py-1.5 lg:text-sm"
                style={{
                  borderColor: answerUnlocked ? 'rgba(34,211,238,0.55)' : 'rgba(100,116,139,0.28)',
                  background: answerUnlocked ? 'rgba(0,0,0,0.75)' : 'rgba(15,23,42,0.72)',
                  color: answerUnlocked ? '#cffafe' : 'rgba(148,163,184,0.38)',
                }}
                disabled={!answerUnlocked || processing}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleClaim}
            disabled={!canSubmit}
            className="mb-2 w-full rounded-xl border border-cyan-400/35 bg-black/70 px-2 py-1.5 text-[0.48rem] font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35 lg:mb-3 lg:px-4 lg:py-2 lg:text-[0.55rem]"
          >
            {processing ? '[ sync ]' : t('podcast.submit')}
          </button>

          {/* Owner — pushed to bottom on mobile */}
          <div className="mt-auto lg:flex lg:items-center lg:justify-between lg:gap-2">
            <div>
              <span className="text-[0.42rem] uppercase tracking-[0.12em] text-cyan-300/70 lg:text-[0.48rem] lg:tracking-[0.16em]">{t('podcast.owner')} </span>
              {selectedBlock?.claimed_by ? (
                <button
                  type="button"
                  onClick={() => openRankingWallet(selectedBlock.claimed_by)}
                  className="text-[0.65rem] transition hover:underline focus:outline-none lg:text-[0.72rem]"
                  style={{ color: ownerColor, textShadow: `0 0 10px ${ownerColor}33` }}
                  title={selectedBlock.claimed_by}
                >
                  {shortenWallet(selectedBlock.claimed_by)}
                </button>
              ) : (
                <span className="text-[0.65rem] lg:text-[0.72rem]" style={{ color: ownerColor, textShadow: `0 0 10px ${ownerColor}33` }}>
                  {t('podcast.noWinner')}
                </span>
              )}
            </div>
            <span className="text-[0.55rem] font-black text-cyan-400/70 lg:text-[0.6rem]">{selectedBlockHex}</span>
          </div>
        </section>

        {activeCols < GRID_COLS ? (
          <div className="relative flex-1 min-w-0 px-3.5 py-3.5">
            <button type="button" disabled={viewportCol === 0} onClick={() => setViewportCol((c) => Math.max(0, c - 1))}
              className="absolute left-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-400/20 bg-black/80 text-[0.58rem] text-cyan-300/65 transition hover:border-cyan-300/40 hover:text-cyan-200 disabled:opacity-35">◀</button>
            <button type="button" disabled={viewportCol >= GRID_COLS - activeCols} onClick={() => setViewportCol((c) => Math.min(GRID_COLS - activeCols, c + 1))}
              className="absolute right-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-400/20 bg-black/80 text-[0.58rem] text-cyan-300/65 transition hover:border-cyan-300/40 hover:text-cyan-200 disabled:opacity-35">▶</button>
            <button type="button" disabled={viewportRow === 0} onClick={() => setViewportRow((r) => Math.max(0, r - 1))}
              className="absolute left-1/2 top-0 z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-cyan-400/20 bg-black/80 text-[0.58rem] text-cyan-300/65 transition hover:border-cyan-300/40 hover:text-cyan-200 disabled:opacity-35">▲</button>
            <button type="button" disabled={viewportRow >= GRID_ROWS - activeRows} onClick={() => setViewportRow((r) => Math.min(GRID_ROWS - activeRows, r + 1))}
              className="absolute bottom-0 left-1/2 z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-cyan-400/20 bg-black/80 text-[0.58rem] text-cyan-300/65 transition hover:border-cyan-300/40 hover:text-cyan-200 disabled:opacity-35">▼</button>

            <div className="flex min-h-0 flex-col rounded-xl border border-cyan-500/20 bg-black/60 p-1.5">
              <button
                type="button"
                disabled={viewportRow === 0}
                onClick={() => setViewportRow((r) => Math.max(0, r - 1))}
                className="sr-only"
                aria-label="Pan up"
              >
                ▲
              </button>

              {/* Grid */}
              <div className="relative flex-1">
                <div
                  style={{
                    display: 'grid',
                    gridTemplate: `repeat(${activeRows}, 1fr) / repeat(${activeCols}, 1fr)`,
                    aspectRatio: `${activeCols} / ${activeRows}`,
                    gap: '1px',
                  }}
                >
                  {Array.from({ length: activeRows * activeCols }).map((_, flatIndex) => {
                    const viewRow = Math.floor(flatIndex / activeCols);
                    const viewCol = flatIndex % activeCols;
                    const row = viewportRow + viewRow;
                    const col = viewportCol + viewCol;
                    const block = mergedBlocks[row * GRID_COLS + col];
                    if (!block) return <div key={`e-${row}-${col}`} />;

                    const isSelected = block.pixel_key === selectedKey;
                    const isClaimed = Boolean(block.claimed_by);
                    const tone = getTokenPixelTone(row, col);
                    const cellHex = '#' + (row * GRID_COLS + col).toString(16).toUpperCase().padStart(3, '0');

                    return (
                      <button
                        key={`${row}-${col}`}
                        type="button"
                        onClick={() => handlePixelClick(block.pixel_key)}
                        className="flex items-center justify-center overflow-hidden transition duration-100 focus:outline-none"
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
                            ? '0 0 6px rgba(250,204,21,0.35)'
                            : isClaimed
                              ? 'inset 0 0 4px rgba(34,197,94,0.1)'
                              : 'none',
                        }}
                        title={`${block.emoji} ${language === 'es' ? block.title_es : block.title_en}`}
                      >
                        {isClaimed && (
                          <span style={{
                            fontSize: '0.26rem',
                            letterSpacing: '0.04em',
                            color: 'rgba(74,222,128,0.55)',
                            fontFamily: 'monospace',
                            lineHeight: 1,
                            userSelect: 'none',
                            pointerEvents: 'none',
                          }}>
                            {cellHex}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* selected block hex overlay */}
                <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/70 px-1 py-px font-mono text-[0.42rem] font-black tracking-wider text-cyan-300/70">
                  {selectedBlockHex}
                </div>
              </div>

              {/* bottom nav */}
              <div className="mt-1 flex items-center justify-between gap-1">
                <span className="text-[0.42rem] uppercase tracking-widest text-cyan-400/35">
                  {viewportRow + 1}–{Math.min(viewportRow + activeRows, GRID_ROWS)}/{GRID_ROWS}
                </span>
                <button
                  type="button"
                  disabled={viewportRow >= GRID_ROWS - activeRows}
                  onClick={() => setViewportRow((r) => Math.min(GRID_ROWS - activeRows, r + 1))}
                  className="sr-only"
                  aria-label="Pan down"
                >
                  ▼
                </button>
              </div>
            </div>
          </div>
        ) : (
          <section className="min-w-0 flex-1 rounded-xl border border-cyan-500/20 bg-black/60 p-2">
            {/* pan up */}
            <button
              type="button"
              disabled={viewportRow === 0}
              onClick={() => setViewportRow((r) => Math.max(0, r - 1))}
              className="mb-1 flex w-full items-center justify-center text-[0.55rem] uppercase tracking-widest text-cyan-400/50 transition hover:text-cyan-300 disabled:opacity-20"
            >
              ▲
            </button>

            {/* Grid — no emoji, no indicators; only sold (green) and selected (yellow) differ */}
            <div className="relative">
              <div
                style={{
                  display: 'grid',
                  gridTemplate: `repeat(${activeRows}, 1fr) / repeat(${activeCols}, 1fr)`,
                  aspectRatio: `${activeCols} / ${activeRows}`,
                  gap: '1px',
                }}
              >
                {Array.from({ length: activeRows * activeCols }).map((_, flatIndex) => {
                  const viewRow = Math.floor(flatIndex / activeCols);
                  const viewCol = flatIndex % activeCols;
                  const row = viewportRow + viewRow;
                  const col = viewportCol + viewCol;
                  const block = mergedBlocks[row * GRID_COLS + col];
                  if (!block) return <div key={`e-${row}-${col}`} />;

                  const isSelected = block.pixel_key === selectedKey;
                  const isClaimed = Boolean(block.claimed_by);
                  const tone = getTokenPixelTone(row, col);
                  const cellHex = '#' + (row * GRID_COLS + col).toString(16).toUpperCase().padStart(3, '0');

                  return (
                    <button
                      key={`${row}-${col}`}
                      type="button"
                      onClick={() => handlePixelClick(block.pixel_key)}
                      className="flex items-center justify-center overflow-hidden transition duration-100 focus:outline-none"
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
                          ? '0 0 6px rgba(250,204,21,0.35)'
                          : isClaimed
                            ? 'inset 0 0 4px rgba(34,197,94,0.1)'
                            : 'none',
                      }}
                      title={`${block.emoji} ${language === 'es' ? block.title_es : block.title_en}`}
                    >
                      {isClaimed && (
                        <span style={{
                          fontSize: '0.26rem',
                          letterSpacing: '0.04em',
                          color: 'rgba(74,222,128,0.55)',
                          fontFamily: 'monospace',
                          lineHeight: 1,
                          userSelect: 'none',
                          pointerEvents: 'none',
                        }}>
                          {cellHex}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* selected block hex overlay */}
              <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/70 px-1 py-px font-mono text-[0.42rem] font-black tracking-wider text-cyan-300/70">
                {selectedBlockHex}
              </div>
            </div>

            {/* bottom nav — 3 cols so ▼ stays centered under ▲ */}
            <div className="mt-1 grid grid-cols-3 items-center">
              <span className="text-[0.42rem] uppercase tracking-widest text-cyan-400/35">
                {viewportRow + 1}–{Math.min(viewportRow + activeRows, GRID_ROWS)}/{GRID_ROWS}
              </span>
              <button
                type="button"
                disabled={viewportRow >= GRID_ROWS - activeRows}
                onClick={() => setViewportRow((r) => Math.min(GRID_ROWS - activeRows, r + 1))}
                className="flex justify-center text-[0.55rem] uppercase tracking-widest text-cyan-400/50 transition hover:text-cyan-300 disabled:opacity-20"
              >▼</button>
              <div />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
