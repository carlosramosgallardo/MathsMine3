'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useI18n } from '@/lib/i18n-context';
import supabase from '@/lib/supabaseClient';
import { formatMoney } from '@/lib/sell-offer';
import { clampRankLevel, getRankTier } from '@/lib/ranks';
import { colorFromAddress } from '@/lib/wallet-colors';
import { normalizeWalletDecorations, getEmojiTitle, TRADE_SLOT_ORDER } from '@/lib/wallet-decorations';
import { useCurrency } from '@/lib/currency-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import PageLoading from '@/components/PageLoading';

function getBlockHexFromCoords(row, col) {
  return '#' + ((Number(row) || 0) * 28 + (Number(col) || 0)).toString(16).toUpperCase().padStart(3, '0');
}

export default function Leaderboard({ itemsPerPage = 50 }) {
  const { t } = useI18n();
  const { currency: quoteCurrency } = useCurrency();
  const [leaderboard, setLeaderboard] = useState([]);
  const [onlineWallets, setOnlineWallets] = useState(() => new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading]     = useState(true);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'position', direction: 'asc' });
  const { account } = useActiveWallet();
  const activeWallet = account?.toLowerCase() || '';
  const abortRef = useRef(null);
  const refreshTimersRef = useRef([]);
  const loadedOnceRef = useRef(false);
  const CACHE_MS = 2_000;

  const fetchLeaderboard = useCallback(async ({ ignoreCache = false } = {}) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      if (!loadedOnceRef.current) setIsLoading(true);
      if (!ignoreCache) {
        const lastFetch = localStorage.getItem('lb_fetch_time');
        const dirtyAt = localStorage.getItem('lb_dirty_at');
        const cacheIsFresh = lastFetch && Date.now() - Number(lastFetch) < CACHE_MS;
        const cacheIsClean = !dirtyAt || Number(lastFetch) >= Number(dirtyAt);
        if (cacheIsFresh && cacheIsClean) {
          const cached = JSON.parse(localStorage.getItem('lb_data') || 'null');
          if (cached) {
            setLeaderboard(cached);
            loadedOnceRef.current = true;
            setIsLoading(false);
            return;
          }
        }
      }
      const [{ data: leaderboardRows, error }, progressResponse, marketResponse] = await Promise.all([
        supabase
          .from('leaderboard_data')
          .select('wallet, total_eth'),
        supabase
          .from('player_progress')
          .select('wallet, level, mm3_sold, cny_earned, eur_earned, usd_earned, wallet_emojis'),
        supabase
          .from('mm3_podcast_pixels')
          .select('pixel_key, claimed_by, emoji, grid_row, grid_col, claimed_at')
          .not('claimed_by', 'is', null)
          .order('claimed_at', { ascending: true }),
      ]);
      if (error) { console.error('Leaderboard fetch:', error); setLeaderboard([]); return; }
      let progressData = progressResponse?.data || [];
      if (progressResponse?.error) {
        console.error('Leaderboard progress fetch:', progressResponse.error);
        const fallback = await supabase
          .from('player_progress')
          .select('wallet, level, mm3_sold, cny_earned, eur_earned, usd_earned');
        progressData = fallback?.data || [];
      }

      const earnedByWallet = new Map(
        (progressData || []).map((entry) => [
          String(entry.wallet || '').toLowerCase(),
          {
            level: clampRankLevel(entry.level ?? 0),
            mm3Sold: Number(entry.mm3_sold) || 0,
            cny: Number(entry.cny_earned) || 0,
            eur: Number(entry.eur_earned) || 0,
            usd: Number(entry.usd_earned) || 0,
            walletEmojis: Array.isArray(entry.wallet_emojis) ? entry.wallet_emojis : [],
          },
        ])
      );

      const marketBlocksByWallet = new Map();
      for (const entry of marketResponse?.data || []) {
        const wallet = String(entry.claimed_by || '').toLowerCase();
        if (!wallet) continue;
        if (!marketBlocksByWallet.has(wallet)) marketBlocksByWallet.set(wallet, []);
        marketBlocksByWallet.get(wallet).push({
          pixel_key: entry.pixel_key,
          emoji: String(entry.emoji || ''),
          hex: getBlockHexFromCoords(entry.grid_row, entry.grid_col),
        });
      }

      const mergedData = (leaderboardRows || [])
        .map((entry) => {
          const normalizedWallet = String(entry.wallet || '').toLowerCase();
          const progress = earnedByWallet.get(normalizedWallet) || {
            level: 0,
            mm3Sold: 0,
            cny: 0,
            eur: 0,
            usd: 0,
            walletEmojis: [],
          };
          const totalMm3 = Number(entry.total_eth) || 0;
          const availableMm3 = totalMm3 - progress.mm3Sold;

          return {
            wallet: entry.wallet,
            total_eth: totalMm3,
            available_mm3: availableMm3,
            level: progress.level,
            money_balance_cny: progress.cny,
            money_balance_eur: progress.eur,
            money_balance_usd: progress.usd,
            wallet_emojis: progress.walletEmojis,
            market_blocks: marketBlocksByWallet.get(normalizedWallet) || [],
          };
        })
        .sort((a, b) => {
          if (b.level !== a.level) return b.level - a.level;
          if (b.available_mm3 !== a.available_mm3) return b.available_mm3 - a.available_mm3;
          return String(a.wallet).localeCompare(String(b.wallet));
        })
        .map((entry, index) => ({ ...entry, position: index + 1 }));

      localStorage.setItem('lb_data', JSON.stringify(mergedData));
      localStorage.setItem('lb_fetch_time', String(Date.now()));
      localStorage.removeItem('lb_dirty_at');
      setLeaderboard((current) => {
        const currentJson = JSON.stringify(current);
        const nextJson = JSON.stringify(mergedData);
        return currentJson === nextJson ? current : mergedData;
      });
      loadedOnceRef.current = true;
    } catch (e) {
      if (e?.name !== 'AbortError') console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  useEffect(() => {
    let mounted = true;

    const loadPresence = async () => {
      try {
        const since = new Date(Date.now() - 90_000).toISOString();
        const { data, error } = await supabase
          .from('mm3_wallet_presence')
          .select('wallet,last_seen')
          .gte('last_seen', since);
        if (error) throw error;
        if (!mounted) return;
        setOnlineWallets(new Set((data || []).map((entry) => String(entry.wallet || '').toLowerCase())));
      } catch {
        if (mounted) setOnlineWallets(new Set());
      }
    };

    loadPresence();
    const timer = setInterval(loadPresence, 10_000);
    window.addEventListener('focus', loadPresence);
    const channel = supabase
      .channel('mm3-leaderboard-presence-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_wallet_presence' }, loadPresence)
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener('focus', loadPresence);
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredLeaderboard = useMemo(() => {
    const selected = selectedWallet.trim().toLowerCase();
    const moneyKey =
      quoteCurrency === 'USD'
        ? 'money_balance_usd'
        : quoteCurrency === 'CNY'
          ? 'money_balance_cny'
          : 'money_balance_eur';
    const rows = selected
      ? leaderboard.filter((entry) => String(entry.wallet || '').toLowerCase() === selected)
      : leaderboard;

    const getValue = (entry) => {
      if (sortConfig.key === 'money') return Number(entry[moneyKey]) || 0;
      if (sortConfig.key === 'nftmoji') return normalizeWalletDecorations(entry.wallet_emojis).length;
      if (sortConfig.key === 'block') return Array.isArray(entry.market_blocks) ? entry.market_blocks.length : 0;
      if (sortConfig.key === 'status') return onlineWallets.has(String(entry.wallet || '').toLowerCase()) ? 1 : 0;
      if (sortConfig.key === 'rank') return getRankTier(clampRankLevel(entry.level)).label;
      if (sortConfig.key === 'wallet') return String(entry.wallet || '').toLowerCase();
      return entry[sortConfig.key];
    };

    return [...rows].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      let result = 0;
      if (typeof aValue === 'string' || typeof bValue === 'string') {
        result = String(aValue || '').localeCompare(String(bValue || ''));
      } else {
        result = (Number(aValue) || 0) - (Number(bValue) || 0);
      }
      if (result === 0) result = (a.position || 0) - (b.position || 0);
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [leaderboard, onlineWallets, quoteCurrency, selectedWallet, sortConfig]);

  useEffect(() => {
    const total = Math.max(1, Math.ceil(filteredLeaderboard.length / itemsPerPage));
    if (currentPage > total) setCurrentPage(1);
  }, [filteredLeaderboard.length, itemsPerPage, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedWallet, sortConfig]);

  useEffect(() => {
    const onToggleWallet = (event) => {
      const wallet = String(event.detail?.wallet || '').toLowerCase();
      if (!wallet) return;
      setSelectedWallet((current) => current === wallet ? '' : wallet);
    };

    window.addEventListener('mm3-leaderboard-toggle-wallet', onToggleWallet);
    return () => window.removeEventListener('mm3-leaderboard-toggle-wallet', onToggleWallet);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pendingWallet = String(localStorage.getItem('mm3_leaderboard_wallet') || '').toLowerCase();
    if (!pendingWallet) return;
    setSelectedWallet(pendingWallet);
    localStorage.removeItem('mm3_leaderboard_wallet');
  }, []);

  useEffect(() => {
    const clearRefreshTimers = () => {
      refreshTimersRef.current.forEach(clearTimeout);
      refreshTimersRef.current = [];
    };

    const refresh = () => {
      clearRefreshTimers();
      localStorage.removeItem('lb_data');
      localStorage.removeItem('lb_fetch_time');
      fetchLeaderboard({ ignoreCache: true });
      refreshTimersRef.current = [
        setTimeout(() => fetchLeaderboard({ ignoreCache: true }), 1200),
        setTimeout(() => fetchLeaderboard({ ignoreCache: true }), 3500),
      ];
    };

    const refreshWhenVisible = () => {
      if (!document.hidden) refresh();
    };

    window.addEventListener('mm3-db-updated', refresh);
    window.addEventListener('mm3-correct', refresh);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    const poll = setInterval(refreshWhenVisible, 5_000);
    const channel = supabase
      .channel('mm3-leaderboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_progress' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard_data' }, refresh)
      .subscribe();

    return () => {
      clearRefreshTimers();
      clearInterval(poll);
      supabase.removeChannel(channel);
      window.removeEventListener('mm3-db-updated', refresh);
      window.removeEventListener('mm3-correct', refresh);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchLeaderboard]);

  const start        = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredLeaderboard.slice(start, start + itemsPerPage);
  const totalPages   = Math.ceil(filteredLeaderboard.length / itemsPerPage);

  const toggleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key
          ? current.direction === 'asc' ? 'desc' : 'asc'
          : key === 'status'
            ? 'desc'
            : 'asc',
    }));
  };

  const sortLabel = (key) => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const toggleSelectedWallet = (wallet) => {
    const normalized = String(wallet || '').toLowerCase();
    if (!normalized) return;
    setSelectedWallet((current) => current === normalized ? '' : normalized);
  };

  const openMarketBlock = (pixelKey) => {
    if (!pixelKey || typeof window === 'undefined') return;
    window.location.href = `/market?pixel=${encodeURIComponent(pixelKey)}`;
  };

  const getPlacementDisplay = (position) => {
    if (position === 1) return { label: '1', title: '#1' };
    if (position === 2) return { label: '2', title: '#2' };
    if (position === 3) return { label: '3', title: '#3' };
    return { label: String(position || 0), title: `#${position || 0}` };
  };

  const SortButton = ({ sortKey, children, className = '' }) => (
    <button
      type="button"
      onClick={() => toggleSort(sortKey)}
      className={`inline-flex items-center gap-1 font-inherit text-inherit transition hover:text-emerald-300 ${className}`}
      title={`${children} ${sortConfig.key === sortKey ? t(sortConfig.direction === 'asc' ? 'leaderboard.sortAsc' : 'leaderboard.sortDesc') : ''}`.trim()}
    >
      <span>{children}</span>
      <span className="text-[0.65rem] text-emerald-300">{sortLabel(sortKey)}</span>
    </button>
  );

  return (
    <div className="w-full">
      {isLoading && leaderboard.length === 0 && (
        <PageLoading label={t('leaderboard.loadingMiners')} />
      )}

      <style>{`
        .lb-row { transition: all .25s ease; border: 1px solid rgba(34,211,238,.15); }
        .lb-row:hover { background: rgba(34,211,238,.05); border-color: rgba(34,211,238,.4); transform: translateX(2px); }
        .lb-row.wallet-active { background: linear-gradient(90deg, rgba(74,222,128,.11), rgba(34,211,238,.05)); border-color: rgba(74,222,128,.55); box-shadow: inset 0 0 18px rgba(74,222,128,.12); }
        .lb-row.wallet-selected { background: linear-gradient(90deg, rgba(34,211,238,.16), rgba(74,222,128,.08)); border-color: rgba(34,211,238,.75); box-shadow: inset 0 0 22px rgba(34,211,238,.16), 0 0 14px rgba(34,211,238,.12); }
        .lb-tbl { border-collapse: collapse; border: 2px solid rgba(34,211,238,.25); border-radius: 12px; overflow: hidden; }
        .lb-tbl thead { background: linear-gradient(135deg,#0b0f19,#050810); border-bottom: 2px solid rgba(34,211,238,.3); }
        .lb-tbl thead th { color:#22d3ee; font-weight:700; padding:.46rem .4rem; text-align:left; border-right:1px solid rgba(34,211,238,.15); font-size:.64rem; letter-spacing:.05em; }
        @media(min-width:640px){ .lb-tbl thead th { padding:.62rem .56rem; font-size:.72rem; } }
        .lb-tbl thead th:last-child { border-right:none; }
        .lb-tbl tbody tr:nth-child(odd) { background:rgba(34,211,238,.015); }
        .lb-tbl td { padding:.44rem .4rem; border-bottom:1px solid rgba(34,211,238,.1); font-size:.68rem; }
        @media(min-width:640px){ .lb-tbl td { padding:.56rem; font-size:.72rem; } }
        .lb-tbl tbody tr:last-child td { border-bottom:none; }
        .rank-badge { display:inline-flex; align-items:center; justify-content:center; min-width:1.4rem; font-weight:900; font-size:.96rem; border:none; background:none; box-shadow:none; flex-shrink:0; }
        .rank-badge.r1 { color:#facc15; text-shadow:0 0 10px rgba(250,204,21,.32); }
        .rank-badge.r2 { color:#67e8f9; text-shadow:0 0 10px rgba(103,232,249,.32); }
        .rank-badge.r3 { color:#f472b6; text-shadow:0 0 10px rgba(244,114,182,.32); }
        .lb-card { border:1px solid rgba(34,211,238,.18); background:linear-gradient(135deg, rgba(2,6,23,.94), rgba(0,0,0,.96)); box-shadow:0 0 18px rgba(34,211,238,.06); }
        .lb-card.wallet-active { border-color:rgba(74,222,128,.55); box-shadow:0 0 18px rgba(74,222,128,.14), inset 0 0 18px rgba(74,222,128,.08); }
        .lb-card.wallet-selected { border-color:rgba(34,211,238,.75); box-shadow:0 0 22px rgba(34,211,238,.16), inset 0 0 18px rgba(34,211,238,.1); }
        .lb-status-chip { display:inline-flex; align-items:center; justify-content:center; min-width:4.9rem; padding:.22rem .46rem; border:1px solid rgba(34,211,238,.18); background:rgba(0,0,0,.45); font-size:.56rem; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }
        .lb-status-chip.online { border-color:rgba(74,222,128,.34); color:#4ade80; box-shadow:0 0 12px rgba(74,222,128,.12) inset; }
        .lb-status-chip.offline { border-color:rgba(148,163,184,.2); color:#64748b; }
      `}</style>

      <div className="space-y-3 sm:hidden">
        {isLoading ? (
          <PageLoading label={t('leaderboard.loadingMiners')} fullScreen={false} />
        ) : currentItems.length > 0 ? currentItems.map((entry) => {
          const globalRank = entry.position || 0;
          const normalizedWallet = String(entry.wallet || '').toLowerCase();
          const isActiveWallet = activeWallet && normalizedWallet === activeWallet;
          const isSelectedWallet = selectedWallet && normalizedWallet === selectedWallet;
          const rankCls = globalRank === 1 ? 'r1' : globalRank === 2 ? 'r2' : globalRank === 3 ? 'r3' : '';
          const placement = getPlacementDisplay(globalRank);
          const walletColor = colorFromAddress(entry.wallet);
          const lvl = clampRankLevel(entry.level);
          const tier = getRankTier(lvl);
          const isOnline = onlineWallets.has(normalizedWallet);
          const sellValue =
            quoteCurrency === 'USD'
              ? entry.money_balance_usd
              : quoteCurrency === 'CNY'
                ? entry.money_balance_cny
                : entry.money_balance_eur;
          const ownedEmojis = normalizeWalletDecorations(entry.wallet_emojis);
          const marketBlocks = Array.isArray(entry.market_blocks) ? entry.market_blocks : [];

          return (
            <article key={entry.wallet} className={`lb-card rounded-xl p-2.5${isActiveWallet ? ' wallet-active' : ''}${isSelectedWallet ? ' wallet-selected' : ''}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className={`rank-badge ${rankCls}`} title={placement.title}>{placement.label}</span>
                <button
                  type="button"
                  onClick={() => toggleSelectedWallet(entry.wallet)}
                  className="min-w-0 flex-1 break-all text-left font-mono text-[0.72rem] font-semibold leading-relaxed transition hover:underline focus:outline-none"
                  style={{ color: walletColor }}
                  title={isSelectedWallet ? t('leaderboard.showAllWallets') : t('leaderboard.showOnlyWallet')}
                >
                  {entry.wallet}
                </button>
              </div>

              <div className="mb-2">
                <span className={`lb-status-chip ${isOnline ? 'online' : 'offline'}`}>
                  {isOnline ? t('leaderboard.online') : t('leaderboard.offline')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[0.62rem] uppercase tracking-[0.12em] text-cyan-700">
                <div className="rounded-lg border border-cyan-500/10 bg-black/60 p-2">
                  <div>{t('leaderboard.level')}</div>
                  <div className="mt-1 text-base font-black tracking-normal" style={{ color: tier.color, textShadow:`0 0 8px ${tier.color}66` }}>
                    {lvl}
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-500/10 bg-black/60 p-2">
                  <div>{t('leaderboard.rank')}</div>
                  <div className="mt-1 inline-flex items-center justify-center text-[0.92rem] font-bold tracking-normal" style={{ color: tier.color }} title={tier.label}>
                    <span>{tier.emoji}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-500/10 bg-black/60 p-2">
                  <div>{t('leaderboard.mm3Earned')}</div>
                  <div className="mt-1 font-mono text-[0.78rem] font-semibold tracking-normal text-cyan-300">
                    {Number(entry.available_mm3 || 0).toFixed(8).replace(/\.?0+$/, '') || '0'}
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-500/10 bg-black/60 p-2">
                  <div>{t('leaderboard.sellValue')}</div>
                  <div className="mt-1 font-mono text-[0.78rem] font-semibold tracking-normal text-emerald-300">
                    {formatMoney(sellValue, quoteCurrency)}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex min-h-7 items-center justify-center gap-1 rounded-lg border border-cyan-500/10 bg-black/50 px-2 py-1">
                {TRADE_SLOT_ORDER.map((slot) => {
                  const owned = ownedEmojis.includes(slot.emoji);
                  return (
                    <div
                      key={slot.key}
                      title={getEmojiTitle(slot.emoji)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border text-base"
                      style={{
                        borderColor: owned ? tier.glow : 'rgba(148,163,184,0.22)',
                        background: owned ? tier.bg : 'rgba(2,6,23,0.4)',
                        color: owned ? tier.color : 'rgba(100,116,139,0.35)',
                        boxShadow: owned ? `0 0 12px ${tier.color}22` : 'none',
                      }}
                    >
                      {owned ? slot.emoji : ''}
                    </div>
                  );
                })}
              </div>

              <div className="mt-2">
                <div className="mb-1 text-[0.58rem] uppercase tracking-[0.12em] text-cyan-700">{t('leaderboard.block')}</div>
                <div className="flex min-h-7 flex-wrap items-center gap-1 rounded-lg border border-cyan-500/10 bg-black/50 px-2 py-1">
                  {marketBlocks.length > 0 ? marketBlocks.map((block) => (
                    <button
                      key={block.pixel_key}
                      type="button"
                      onClick={() => openMarketBlock(block.pixel_key)}
                      title={`${block.emoji} ${block.hex}`}
                      className="relative flex h-8 w-8 items-center justify-center rounded-md border text-base transition hover:border-cyan-300 hover:text-cyan-100"
                      style={{
                        borderColor: 'rgba(250,204,21,0.3)',
                        background: 'rgba(2,6,23,0.68)',
                        color: '#fef08a',
                        boxShadow: '0 0 10px rgba(250,204,21,0.12)',
                      }}
                    >
                      <span>{block.emoji}</span>
                      <span className="absolute bottom-[1px] right-[2px] text-[0.26rem] font-black tracking-[0.08em] text-cyan-100/90">
                        {block.hex.replace('#', '')}
                      </span>
                    </button>
                  )) : (
                    <span className="text-[0.56rem] uppercase tracking-[0.12em] text-slate-600">{t('leaderboard.none')}</span>
                  )}
                </div>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-xl border border-cyan-500/20 bg-black/80 p-5 text-center text-xs text-gray-500">
            {t('leaderboard.noMiners')}
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="lb-tbl w-full">
          <thead>
            <tr>
              <th style={{ width:'6%', textAlign:'center' }}><SortButton sortKey="position" className="justify-center">{t('leaderboard.position')}</SortButton></th>
              <th style={{ width:'10%', textAlign:'center' }}><SortButton sortKey="status" className="justify-center">{t('leaderboard.status')}</SortButton></th>
              <th style={{ width:'32%' }}><SortButton sortKey="wallet">{t('leaderboard.minerWallet')}</SortButton></th>
              <th style={{ width:'14%', textAlign:'center' }} title="NFTmojis — probability artifacts that influence MM3 global value"><SortButton sortKey="nftmoji" className="justify-center">NFTmojis</SortButton></th>
              <th style={{ width:'12%', textAlign:'center' }}><SortButton sortKey="block" className="justify-center">{t('leaderboard.block')}</SortButton></th>
              <th style={{ width:'7%', textAlign:'center' }}><SortButton sortKey="level" className="justify-center">{t('leaderboard.level')}</SortButton></th>
              <th style={{ width:'9%', textAlign:'center' }}><SortButton sortKey="rank" className="justify-center">{t('leaderboard.rank')}</SortButton></th>
              <th style={{ width:'10%', textAlign:'right', paddingRight:'1rem' }}><SortButton sortKey="available_mm3" className="justify-end">{t('leaderboard.mm3Earned')}</SortButton></th>
              <th style={{ width:'10%', textAlign:'right', paddingRight:'1rem' }}><SortButton sortKey="money" className="justify-end">{t('leaderboard.sellValue')}</SortButton></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr className="lb-row">
                <td colSpan={9} style={{ textAlign:'center', padding: '2rem' }}>
                  <PageLoading label={t('leaderboard.loadingMiners')} fullScreen={false} />
                </td>
              </tr>
            ) : currentItems.length > 0 ? currentItems.map((entry) => {
              const globalRank = entry.position || 0;
              const normalizedWallet = String(entry.wallet || '').toLowerCase();
              const isActiveWallet = activeWallet && normalizedWallet === activeWallet;
              const isSelectedWallet = selectedWallet && normalizedWallet === selectedWallet;
              const rankCls = globalRank === 1 ? 'r1' : globalRank === 2 ? 'r2' : globalRank === 3 ? 'r3' : '';
              const placement = getPlacementDisplay(globalRank);
              const walletColor = colorFromAddress(entry.wallet);
              const lvl = clampRankLevel(entry.level);
              const tier = getRankTier(lvl);
              const isOnline = onlineWallets.has(normalizedWallet);
              const sellValue =
                quoteCurrency === 'USD'
                  ? entry.money_balance_usd
                  : quoteCurrency === 'CNY'
                    ? entry.money_balance_cny
                    : entry.money_balance_eur;
              const ownedEmojis = normalizeWalletDecorations(entry.wallet_emojis);
              const marketBlocks = Array.isArray(entry.market_blocks) ? entry.market_blocks : [];

              return (
                <tr key={entry.wallet} className={`lb-row${isActiveWallet ? ' wallet-active' : ''}${isSelectedWallet ? ' wallet-selected' : ''}`}>
                  <td style={{ textAlign:'center' }}>
                    <span className={`rank-badge ${rankCls}`} title={placement.title}>{placement.label}</span>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span className={`lb-status-chip ${isOnline ? 'online' : 'offline'}`}>
                      {isOnline ? t('leaderboard.online') : t('leaderboard.offline')}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleSelectedWallet(entry.wallet)}
                      className="break-all text-left font-mono font-semibold text-[0.72rem] transition hover:underline focus:outline-none"
                      style={{ color: walletColor }}
                      title={isSelectedWallet ? t('leaderboard.showAllWallets') : t('leaderboard.showOnlyWallet')}
                    >
                      {entry.wallet}
                    </button>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <div className="flex items-center justify-center gap-1">
                      {TRADE_SLOT_ORDER.map((slot) => {
                        const owned = ownedEmojis.includes(slot.emoji);
                        return (
                          <div
                            key={slot.key}
                            title={getEmojiTitle(slot.emoji)}
                            className="flex h-8 w-8 items-center justify-center rounded-md border text-base"
                            style={{
                              borderColor: owned ? tier.glow : 'rgba(148,163,184,0.22)',
                              background: owned ? tier.bg : 'rgba(2,6,23,0.4)',
                              color: owned ? tier.color : 'rgba(100,116,139,0.35)',
                              boxShadow: owned ? `0 0 12px ${tier.color}22` : 'none',
                            }}
                          >
                            {owned ? slot.emoji : ''}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {marketBlocks.length > 0 ? marketBlocks.map((block) => (
                        <button
                          key={block.pixel_key}
                          type="button"
                          onClick={() => openMarketBlock(block.pixel_key)}
                          title={`${block.emoji} ${block.hex}`}
                          className="relative flex h-8 w-8 items-center justify-center rounded-md border text-base transition hover:border-cyan-300 hover:text-cyan-100"
                          style={{
                            borderColor: 'rgba(250,204,21,0.3)',
                            background: 'rgba(2,6,23,0.68)',
                            color: '#fef08a',
                            boxShadow: '0 0 10px rgba(250,204,21,0.12)',
                          }}
                        >
                          <span>{block.emoji}</span>
                          <span className="absolute bottom-[1px] right-[2px] text-[0.26rem] font-black tracking-[0.08em] text-cyan-100/90">
                            {block.hex.replace('#', '')}
                          </span>
                        </button>
                      )) : (
                        <span className="text-[0.56rem] uppercase tracking-[0.12em] text-slate-600">{t('leaderboard.none')}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span className="font-mono font-black text-sm" style={{ color: tier.color, textShadow:`0 0 8px ${tier.color}66` }}>
                      {lvl}
                    </span>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span className="inline-flex items-center justify-center text-[.92rem] font-mono font-bold" style={{ color: tier.color }} title={tier.label}>
                      <span>{tier.emoji}</span>
                    </span>
                  </td>
                  <td style={{ textAlign:'right', paddingRight:'1rem' }}>
                    <span className="text-[#22d3ee] font-mono font-semibold text-[0.72rem]">
                      {Number(entry.available_mm3 || 0).toFixed(8).replace(/\.?0+$/, '') || '0'}
                    </span>
                  </td>
                  <td style={{ textAlign:'right', paddingRight:'1rem' }}>
                    <span className="font-mono font-semibold text-emerald-300 text-[0.72rem]">
                      {formatMoney(sellValue, quoteCurrency)}
                    </span>
                  </td>
                </tr>
              );
            }) : (
              <tr className="lb-row">
                <td colSpan={9} className="text-center py-8 text-gray-500">{t('leaderboard.noMiners')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-5 flex-wrap">
          <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border-2 border-[#22d3ee]/40 text-[#22d3ee] hover:border-[#22d3ee] transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-mono">
            {t('leaderboard.prev')}
          </button>
          <div className="flex gap-1 items-center">
            {[...Array(totalPages)].map((_, i) => {
              const p = i + 1, active = currentPage === p;
              const near = Math.abs(currentPage - p) <= 2;
              if (!near && p !== 1 && p !== totalPages) {
                if (p === Math.floor(totalPages/2)+1) return <span key={p} className="px-1 text-[#22d3ee]">…</span>;
                return null;
              }
              return (
                <button key={p} onClick={() => setCurrentPage(p)}
                        className={`w-9 h-9 rounded-lg border-2 font-mono font-bold text-sm transition ${active ? 'bg-[#22d3ee] text-black border-[#22d3ee]' : 'border-[#22d3ee]/30 text-[#22d3ee] hover:border-[#22d3ee]/70'}`}>
                  {p}
                </button>
              );
            })}
          </div>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg border-2 border-[#22d3ee]/40 text-[#22d3ee] hover:border-[#22d3ee] transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-mono">
            {t('leaderboard.next')}
          </button>
        </div>
      )}
    </div>
  );
}

