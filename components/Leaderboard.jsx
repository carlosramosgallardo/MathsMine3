'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useI18n } from '@/lib/i18n-context';
import supabase from '@/lib/supabaseClient';
import { CNY_TO_EUR, CNY_TO_USD, formatMoney, formatCompactNum } from '@/lib/sell-offer';
import { clampRankLevel, getRankTier } from '@/lib/ranks';
import { colorFromAddress } from '@/lib/wallet-colors';
import { normalizeWalletDecorations, getEmojiTitle, TRADE_SLOT_ORDER } from '@/lib/wallet-decorations';
import { useCurrency } from '@/lib/currency-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import PageLoading from '@/components/PageLoading';

function getBlockHexFromCoords(row, col) {
  return '#' + ((Number(row) || 0) * 28 + (Number(col) || 0)).toString(16).toUpperCase().padStart(3, '0');
}

const CURRENCY_SYM = { EUR: '€', USD: '$', CNY: '¥' };

function formatCompactMoney(value, currency) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const sym = CURRENCY_SYM[currency] || '';
  if (abs >= 1_000_000_000) return `${sign}${sym}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `${sign}${sym}${(abs / 1_000).toFixed(1)}k`;
  return (n < 0 ? '-' : '') + formatMoney(abs, currency);
}

function toCnyFromEur(value) {
  return Number(value || 0) / CNY_TO_EUR;
}

function toUsdFromEur(value) {
  return Number(value || 0) * (CNY_TO_USD / CNY_TO_EUR);
}

function convertPenaltyEur(value, currency) {
  const eur = Number(value) || 0;
  if (currency === 'USD') return toUsdFromEur(eur);
  if (currency === 'CNY') return toCnyFromEur(eur);
  return eur;
}

function normalizeWallet(value) {
  return String(value || '').trim().toLowerCase();
}

function shortWallet(wallet) {
  const normalized = String(wallet || '').trim();
  if (!normalized) return '';
  return normalized.slice(-5).toUpperCase();
}

function avg(values) {
  const nums = values.map(Number).filter((value) => Number.isFinite(value));
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export default function Leaderboard({ itemsPerPage = 50 }) {
  const { t, language } = useI18n();
  const { currency: quoteCurrency } = useCurrency();
  const [leaderboard, setLeaderboard] = useState([]);
  const [onlineWallets, setOnlineWallets] = useState(() => new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading]     = useState(true);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'wallets';
    return localStorage.getItem('mm3_leaderboard_view_mode') || 'wallets';
  });
  const [contactBusy, setContactBusy] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'status', direction: 'desc' });
  const { account } = useActiveWallet();
  const activeWallet = account?.toLowerCase() || '';
  const abortRef = useRef(null);
  const refreshTimersRef = useRef([]);
  const loadedOnceRef = useRef(false);
  const CACHE_MS = 2_000;
  const labels = language === 'es'
    ? {
        pool: 'Pool',
        poolRanking: 'Ranking de pools',
        walletRanking: 'Ranking wallets',
        addContact: 'contacto',
        addContactTitle: 'Crear contacto / unir wallets en pool',
        members: 'wallets',
        wallets: 'Wallets',
        noPools: 'Sin pools todavía. Crea contactos desde el ranking de wallets.',
        poolCreated: 'Invitación enviada.',
        inviteSent: 'Invitación enviada.',
        inviteAccepted: 'Invitación aceptada.',
        poolLeft: 'Has salido del pool.',
        poolError: 'No se pudo crear el contacto.',
        poolConflict: 'Las dos wallets ya pertenecen a pools distintos.',
        poolFull: 'El pool ya tiene 5 wallets.',
        poolSame: 'Ya estáis en el mismo pool.',
        poolMissing: 'Instala sql/add_wallet_pools.sql en Supabase.',
        pendingInvites: 'Invitaciones pendientes',
        acceptInvite: 'Aceptar',
        invitedBy: 'Invitado por',
        leavePool: 'Salir del pool',
      }
    : {
        pool: 'Pool',
        poolRanking: 'Pool ranking',
        walletRanking: 'Wallet ranking',
        addContact: 'contact',
        addContactTitle: 'Create contact / join wallets into a pool',
        members: 'wallets',
        wallets: 'Wallets',
        noPools: 'No pools yet. Create contacts from the wallet ranking.',
        poolCreated: 'Invitation sent.',
        inviteSent: 'Invitation sent.',
        inviteAccepted: 'Invitation accepted.',
        poolLeft: 'You left the pool.',
        poolError: 'Could not create contact.',
        poolConflict: 'Both wallets already belong to different pools.',
        poolFull: 'The pool already has 5 wallets.',
        poolSame: 'Already in the same pool.',
        poolMissing: 'Install sql/add_wallet_pools.sql in Supabase.',
        pendingInvites: 'Pending invitations',
        acceptInvite: 'Accept',
        invitedBy: 'Invited by',
        leavePool: 'Leave pool',
      };

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
      const [{ data: leaderboardRows, error }, progressResponse, marketOwnersResponse, blocksResponse, txResponse, penaltiesResponse, poolMembersResponse] = await Promise.all([
        supabase
          .from('leaderboard_data')
          .select('wallet, total_eth'),
        supabase
          .from('player_progress')
          .select('wallet, level, mm3_sold, cny_earned, eur_earned, usd_earned, wallet_emojis'),
        supabase
          .from('player_progress')
          .select('wallet, market_nftji_key')
          .not('market_nftji_key', 'is', null),
        supabase
          .from('mm3_market_blocks')
          .select('block_key, emoji, grid_row, grid_col'),
        supabase
          .from('mm3_sell_transactions')
          .select('wallet'),
        supabase
          .from('mm3_command_penalties')
          .select('wallet, nftji_key, penalty_value, penalty_eur, penalty_effect, reset_at, created_at')
          .is('redeemed_at', null)
          .gt('reset_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('mm3_wallet_pool_members')
          .select('wallet, pool_code'),
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

      const blocksByKey = new Map();
      for (const p of blocksResponse?.data || []) {
        blocksByKey.set(p.block_key, { emoji: String(p.emoji || ''), hex: getBlockHexFromCoords(p.grid_row, p.grid_col) });
      }

      const marketBlocksByWallet = new Map();
      for (const entry of marketOwnersResponse?.data || []) {
        const wallet = String(entry.wallet || '').toLowerCase();
        const key = entry.market_nftji_key;
        if (!wallet || !key) continue;
        const blockInfo = blocksByKey.get(key);
        if (!blockInfo) continue;
        marketBlocksByWallet.set(wallet, [{ block_key: key, emoji: blockInfo.emoji, hex: blockInfo.hex }]);
      }

      const txCountByWallet = new Map();
      for (const entry of txResponse?.data || []) {
        const wallet = String(entry.wallet || '').toLowerCase();
        if (!wallet) continue;
        txCountByWallet.set(wallet, (txCountByWallet.get(wallet) || 0) + 1);
      }

      const penaltiesByWallet = new Map();
      for (const entry of penaltiesResponse?.data || []) {
        const wallet = String(entry.wallet || '').toLowerCase();
        if (!wallet) continue;
        const effect = entry.penalty_effect === 'mm3' || (entry.penalty_effect == null && Number(entry.penalty_eur) === 0 && Number(entry.penalty_value) > 0) ? 'mm3' : 'money';
        const existing = penaltiesByWallet.get(wallet) || { mm3: null, money: null };
        if (!existing[effect]) {
          existing[effect] = {
            nftji_key: entry.nftji_key,
            penalty_value: Number(entry.penalty_value) || 0,
            penalty_eur: Number(entry.penalty_eur) || 0,
            reset_at: entry.reset_at,
            block: blocksByKey.get(entry.nftji_key) || null,
          };
          penaltiesByWallet.set(wallet, existing);
        }
      }

      const poolByWallet = new Map();
      const poolMemberWallets = [];
      if (!poolMembersResponse?.error) {
        for (const entry of poolMembersResponse?.data || []) {
          const wallet = normalizeWallet(entry.wallet);
          const poolCode = String(entry.pool_code || '').toUpperCase();
          if (wallet && poolCode) {
            poolByWallet.set(wallet, poolCode);
            poolMemberWallets.push(wallet);
          }
        }
      } else if (poolMembersResponse.error?.code !== '42P01') {
        console.error('Leaderboard pool fetch:', poolMembersResponse.error);
      }

      // Union of leaderboard_data + player_progress + pool wallets so that wallets
      // only present in pool membership still appear in the leaderboard.
      const lbByWallet = new Map(
        (leaderboardRows || []).map((r) => [normalizeWallet(r.wallet), r])
      );
      const allWallets = new Set([
        ...lbByWallet.keys(),
        ...earnedByWallet.keys(),
        ...poolMemberWallets,
      ]);

      const mergedData = [...allWallets]
        .map((normalizedWallet) => {
          const lbRow   = lbByWallet.get(normalizedWallet);
          const progress = earnedByWallet.get(normalizedWallet) || {
            level: 0, mm3Sold: 0, cny: 0, eur: 0, usd: 0, walletEmojis: [],
          };
          const totalMm3    = Number(lbRow?.total_eth) || 0;
          const availableMm3 = totalMm3 - progress.mm3Sold;

          return {
            wallet: lbRow?.wallet || normalizedWallet,
            total_eth: totalMm3,
            available_mm3: availableMm3,
            level: progress.level,
            money_balance_cny: progress.cny,
            money_balance_eur: progress.eur,
            money_balance_usd: progress.usd,
            wallet_emojis: progress.walletEmojis,
            execs_count: txCountByWallet.get(normalizedWallet) || 0,
            market_blocks: marketBlocksByWallet.get(normalizedWallet) || [],
            active_penalty: penaltiesByWallet.get(normalizedWallet) || null,
            pool_code: poolByWallet.get(normalizedWallet) || '',
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
    window.addEventListener('mm3-presence-changed', loadPresence);
    const channel = supabase
      .channel('mm3-leaderboard-presence-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_wallet_presence' }, loadPresence)
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener('focus', loadPresence);
      window.removeEventListener('mm3-presence-changed', loadPresence);
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
      if (sortConfig.key === 'nftji') return normalizeWalletDecorations(entry.wallet_emojis).length;
      if (sortConfig.key === 'execs') return Number(entry.execs_count) || 0;
      if (sortConfig.key === 'block') return (Array.isArray(entry.market_blocks) ? entry.market_blocks.length : 0) + (entry.active_penalty?.mm3 || entry.active_penalty?.money ? 1 : 0);
      if (sortConfig.key === 'pool') return String(entry.pool_code || '').toLowerCase();
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

  const poolLeaderboard = useMemo(() => {
    const moneyKey =
      quoteCurrency === 'USD'
        ? 'money_balance_usd'
        : quoteCurrency === 'CNY'
          ? 'money_balance_cny'
          : 'money_balance_eur';
    const grouped = new Map();
    for (const entry of leaderboard) {
      const poolCode = String(entry.pool_code || '').toUpperCase();
      if (!poolCode) continue;
      const members = grouped.get(poolCode) || [];
      members.push(entry);
      grouped.set(poolCode, members);
    }

    const rows = [...grouped.entries()].map(([poolCode, members]) => {
      const avgLevel = avg(members.map((entry) => entry.level));
      const avgMm3 = avg(members.map((entry) => entry.available_mm3));
      const avgCny = avg(members.map((entry) => entry.money_balance_cny));
      const avgEur = avg(members.map((entry) => entry.money_balance_eur));
      const avgUsd = avg(members.map((entry) => entry.money_balance_usd));
      const avgNftjis = avg(members.map((entry) => Array.isArray(entry.market_blocks) ? entry.market_blocks.length : 0));
      const avgBlockPen = avg(members.map((entry) => {
        const blocks = Array.isArray(entry.market_blocks) ? entry.market_blocks.length : 0;
        return blocks + (entry.active_penalty?.mm3 || entry.active_penalty?.money ? 1 : 0);
      }));
      const marketBlocks = uniqueBy(
        members.flatMap((entry) => Array.isArray(entry.market_blocks) ? entry.market_blocks : []),
        (block) => block.block_key
      );
      const penalties = members.map((entry) => entry.active_penalty).filter(Boolean);
      const activePenalty = {
        mm3: penalties.find((penalty) => penalty?.mm3)?.mm3 || null,
        money: penalties.find((penalty) => penalty?.money)?.money || null,
      };
      const normalizedWallets = [...new Set(members
        .map((entry) => normalizeWallet(entry.wallet))
        .filter(Boolean)
        .slice(0, 5)
      )];
      return {
        is_pool: true,
        pool_code: poolCode,
        member_count: members.length,
        level: avgLevel,
        avg_nftjis: avgNftjis,
        avg_block_pen: avgBlockPen,
        available_mm3: avgMm3,
        money_balance_cny: avgCny,
        money_balance_eur: avgEur,
        money_balance_usd: avgUsd,
        wallet_emojis: [...new Set(members.flatMap((entry) => normalizeWalletDecorations(entry.wallet_emojis)))],
        market_blocks: marketBlocks,
        member_wallets: normalizedWallets,
        member_wallets_short: normalizedWallets.map(shortWallet),
        hidden_member_wallet_count: Math.max(0, new Set(members.map((entry) => normalizeWallet(entry.wallet)).filter(Boolean)).size - normalizedWallets.length),
        active_penalty: activePenalty.mm3 || activePenalty.money ? activePenalty : null,
      };
    });

    const getValue = (entry) => {
      if (sortConfig.key === 'money') return Number(entry[moneyKey]) || 0;
      if (sortConfig.key === 'nftji') return Number(entry.avg_nftjis) || 0;
      if (sortConfig.key === 'wallets') return String((entry.member_wallets || []).join(' ')).toLowerCase();
      if (sortConfig.key === 'block') return Number(entry.avg_block_pen) || 0;
      if (sortConfig.key === 'rank') return getRankTier(clampRankLevel(Math.round(entry.level))).label;
      if (sortConfig.key === 'pool') return String(entry.pool_code || '').toLowerCase();
      return entry[sortConfig.key];
    };

    return rows
      .sort((a, b) => {
        const aValue = getValue(a);
        const bValue = getValue(b);
        let result = 0;
        if (typeof aValue === 'string' || typeof bValue === 'string') {
          result = String(aValue || '').localeCompare(String(bValue || ''));
        } else {
          result = (Number(aValue) || 0) - (Number(bValue) || 0);
        }
        if (result === 0) result = String(a.pool_code).localeCompare(String(b.pool_code));
        return sortConfig.direction === 'asc' ? result : -result;
      })
      .map((entry, index) => ({ ...entry, position: index + 1 }));
  }, [leaderboard, quoteCurrency, sortConfig]);

  const activeLeaderboard = viewMode === 'pools' ? poolLeaderboard : filteredLeaderboard;
  const activeWalletPool = activeWallet
    ? leaderboard.find((entry) => String(entry.wallet || '').toLowerCase() === activeWallet)?.pool_code || ''
    : '';
  const [incomingInvites, setIncomingInvites] = useState([]);
  const [acceptBusy, setAcceptBusy] = useState('');
  const [leaveBusy, setLeaveBusy] = useState(false);

  const fetchInvites = useCallback(async () => {
    if (!activeWallet) { setIncomingInvites([]); return; }
    try {
      const response = await fetch(`/api/wallet-pools/invites?wallet=${encodeURIComponent(activeWallet)}`);
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.ok) {
        setIncomingInvites(Array.isArray(payload.invites) ? payload.invites : []);
      } else {
        setIncomingInvites([]);
      }
    } catch {
      setIncomingInvites([]);
    }
  }, [activeWallet]);

  const handleAcceptInvite = async (inviteId) => {
    if (!activeWallet || acceptBusy || !inviteId) return;
    setAcceptBusy(inviteId);
    try {
      const response = await fetch('/api/wallet-pools/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: activeWallet, inviteId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.poolError, type: 'error' } }));
        return;
      }
      localStorage.removeItem('lb_data');
      localStorage.removeItem('lb_fetch_time');
      window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { poolCode: payload.poolCode } }));
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.inviteAccepted, type: 'success' } }));
      await fetchLeaderboard({ ignoreCache: true });
      await fetchInvites();
    } catch (error) {
      console.error('accept invite:', error);
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.poolError, type: 'error' } }));
    } finally {
      setAcceptBusy('');
    }
  };

  const handleLeavePool = async () => {
    if (!activeWallet || leaveBusy || !activeWalletPool) return;
    setLeaveBusy(true);
    try {
      const response = await fetch('/api/wallet-pools/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: activeWallet }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.poolError, type: 'error' } }));
        return;
      }
      localStorage.removeItem('lb_data');
      localStorage.removeItem('lb_fetch_time');
      window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { poolCode: payload.poolCode } }));
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.poolLeft, type: 'success' } }));
      await fetchLeaderboard({ ignoreCache: true });
      await fetchInvites();
    } catch (error) {
      console.error('leave pool:', error);
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.poolError, type: 'error' } }));
    } finally {
      setLeaveBusy(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('mm3_leaderboard_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    fetchInvites();
  }, [activeWallet, fetchInvites]);

  useEffect(() => {
    const total = Math.max(1, Math.ceil(activeLeaderboard.length / itemsPerPage));
    if (currentPage > total) setCurrentPage(1);
  }, [activeLeaderboard.length, itemsPerPage, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedWallet, sortConfig, viewMode]);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_command_penalties' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_wallet_pools' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_wallet_pool_members' }, refresh)
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
  const currentItems = activeLeaderboard.slice(start, start + itemsPerPage);
  const totalPages   = Math.ceil(activeLeaderboard.length / itemsPerPage);

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
    setViewMode('wallets');
    setSelectedWallet((current) => current === normalized ? '' : normalized);
  };

  const showPoolRanking = () => {
    setSelectedWallet('');
    setViewMode('pools');
    setSortConfig({ key: 'level', direction: 'desc' });
  };

  const showWalletRanking = () => {
    setViewMode('wallets');
    setSortConfig({ key: 'status', direction: 'desc' });
  };

  const handleContactWallet = async (targetWallet) => {
    const normalizedTarget = String(targetWallet || '').toLowerCase();
    if (!activeWallet || !normalizedTarget || normalizedTarget === activeWallet || contactBusy) return;
    setContactBusy(normalizedTarget);
    try {
      const response = await fetch('/api/wallet-pools/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: activeWallet, targetWallet: normalizedTarget }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const msg = payload.error === 'both_wallets_already_pooled'
          ? labels.poolConflict
          : payload.error === 'wallet_pools_not_installed'
            ? labels.poolMissing
            : payload.error === 'pool_full'
              ? labels.poolFull
              : payload.error === 'already_in_same_pool'
                ? labels.poolSame
                : payload.error === 'invite_already_exists'
                  ? labels.poolCreated
                  : labels.poolError;
        window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type: 'error' } }));
        return;
      }
      localStorage.removeItem('lb_data');
      localStorage.removeItem('lb_fetch_time');
      window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { poolCode: payload.poolCode } }));
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.inviteSent, type: 'success' } }));
      await fetchLeaderboard({ ignoreCache: true });
    } catch (error) {
      console.error('contact wallet:', error);
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.poolError, type: 'error' } }));
    } finally {
      setContactBusy('');
    }
  };

  const openMarketBlock = (blockKey) => {
    if (!blockKey || typeof window === 'undefined') return;
    window.location.href = `/market?block=${encodeURIComponent(blockKey)}`;
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
      <span className="text-[0.88rem] text-emerald-300">{sortLabel(sortKey)}</span>
    </button>
  );

  return (
    <div className="w-full">
      <style>{`
        .lb-row { transition: all .25s ease; border: 1px solid rgba(34,211,238,.15); }
        .lb-row:hover { background: rgba(34,211,238,.05); border-color: rgba(34,211,238,.4); transform: translateX(2px); }
        .lb-row.wallet-active { background: linear-gradient(90deg, rgba(74,222,128,.11), rgba(34,211,238,.05)); border-color: rgba(74,222,128,.55); box-shadow: inset 0 0 18px rgba(74,222,128,.12); }
        .lb-row.wallet-selected { background: linear-gradient(90deg, rgba(34,211,238,.16), rgba(74,222,128,.08)); border-color: rgba(34,211,238,.75); box-shadow: inset 0 0 22px rgba(34,211,238,.16), 0 0 14px rgba(34,211,238,.12); }
        .lb-tbl { border-collapse: collapse; border: 2px solid rgba(34,211,238,.25); border-radius: 12px; overflow: hidden; }
        .lb-tbl thead { background: linear-gradient(135deg,#0b0f19,#050810); border-bottom: 2px solid rgba(34,211,238,.3); }
        .lb-tbl thead th { color:#22d3ee; font-weight:700; padding:.34rem .3rem; text-align:left; border-right:1px solid rgba(34,211,238,.15); font-size:.58rem; letter-spacing:.05em; }
        @media(min-width:640px){ .lb-tbl thead th { padding:.42rem .4rem; font-size:.64rem; } }
        .lb-tbl thead th:last-child { border-right:none; }
        .lb-tbl tbody tr:nth-child(odd) { background:rgba(34,211,238,.015); }
        .lb-tbl td { padding:.3rem .3rem; border-bottom:1px solid rgba(34,211,238,.1); font-size:.62rem; }
        @media(min-width:640px){ .lb-tbl td { padding:.38rem .4rem; font-size:.66rem; } }
        .lb-tbl tbody tr:last-child td { border-bottom:none; }
        .rank-badge { display:inline-flex; align-items:center; justify-content:center; min-width:1.1rem; font-weight:900; font-size:.82rem; border:none; background:none; box-shadow:none; flex-shrink:0; }
        .rank-badge.r1 { color:#facc15; text-shadow:0 0 10px rgba(250,204,21,.32); }
        .rank-badge.r2 { color:#67e8f9; text-shadow:0 0 10px rgba(103,232,249,.32); }
        .rank-badge.r3 { color:#f472b6; text-shadow:0 0 10px rgba(244,114,182,.32); }
        .lb-card { border:1px solid rgba(34,211,238,.18); background:linear-gradient(135deg, rgba(2,6,23,.94), rgba(0,0,0,.96)); box-shadow:0 0 18px rgba(34,211,238,.06); }
        .lb-card.wallet-active { border-color:rgba(74,222,128,.55); box-shadow:0 0 18px rgba(74,222,128,.14), inset 0 0 18px rgba(74,222,128,.08); }
        .lb-card.wallet-selected { border-color:rgba(34,211,238,.75); box-shadow:0 0 22px rgba(34,211,238,.16), inset 0 0 18px rgba(34,211,238,.1); }
        .lb-status-chip { display:inline-flex; align-items:center; justify-content:center; min-width:4.2rem; padding:.16rem .34rem; border:1px solid rgba(34,211,238,.18); background:rgba(0,0,0,.45); font-size:.5rem; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }
        .lb-status-chip.online { border-color:rgba(74,222,128,.34); color:#4ade80; box-shadow:0 0 12px rgba(74,222,128,.12) inset; }
        .lb-status-chip.offline { border-color:rgba(148,163,184,.2); color:#64748b; }
        .lb-slot-cell { width:1.95rem; height:1.95rem; }
        .lb-block-cell { width:2rem; height:2rem; }
        .lb-penalty-link {
          animation: lbPenaltyPulse 1.05s ease-in-out infinite alternate;
        }
        @keyframes lbPenaltyPulse {
          from { opacity:.72; text-shadow:0 0 6px rgba(244,63,94,.18); }
          to { opacity:1; text-shadow:0 0 14px rgba(244,63,94,.72); }
        }
      `}</style>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 font-mono">
        <div className="text-[0.72rem] uppercase tracking-[0.18em] text-cyan-700">
          {viewMode === 'pools' ? labels.poolRanking : labels.walletRanking}
        </div>
        <div className="flex items-center gap-2">
          {activeWallet && activeWalletPool ? (
            <button
              type="button"
              onClick={handleLeavePool}
              disabled={leaveBusy}
              className="rounded border border-rose-400/30 bg-rose-950/20 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-rose-300 transition hover:border-rose-300 hover:text-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {labels.leavePool} #{activeWalletPool}
            </button>
          ) : null}
          {viewMode === 'pools' ? (
            <button
              type="button"
              onClick={showWalletRanking}
              className="rounded border border-cyan-400/35 bg-black/70 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-50"
            >
              {labels.walletRanking}
            </button>
          ) : (
            <button
              type="button"
              onClick={showPoolRanking}
              className="rounded border border-emerald-400/30 bg-black/70 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!poolLeaderboard.length}
            >
              {labels.poolRanking}
            </button>
          )}
        </div>
      </div>

      {incomingInvites.length > 0 && (
        <div className="mb-3 rounded-xl border border-cyan-500/20 bg-slate-950/70 p-3 text-sm text-slate-200">
          <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-cyan-300">{labels.pendingInvites}</div>
          <div className="space-y-2">
            {incomingInvites.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-500/10 bg-black/60 p-2">
                <div className="min-w-0">
                  <div className="font-semibold text-cyan-100">{labels.invitedBy}: {shortWallet(invite.invited_by)}</div>
                  <div className="text-[0.72rem] text-slate-400">Pool #{invite.pool_code}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAcceptInvite(invite.id)}
                  disabled={acceptBusy === invite.id}
                  className="rounded border border-emerald-400/30 bg-emerald-950/15 px-3 py-1 text-[0.72rem] font-black uppercase tracking-[0.12em] text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {acceptBusy === invite.id ? '...' : labels.acceptInvite}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mb-3 flex-wrap sm:hidden">
          <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}
                  className="w-8 h-8 rounded border-2 border-[#22d3ee]/40 text-[#22d3ee] hover:border-[#22d3ee] transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-mono">
            ←
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
                        className={`w-8 h-8 rounded border-2 font-mono font-bold text-sm transition ${active ? 'bg-[#22d3ee] text-black border-[#22d3ee]' : 'border-[#22d3ee]/30 text-[#22d3ee] hover:border-[#22d3ee]/70'}`}>
                  {p}
                </button>
              );
            })}
          </div>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}
                  className="w-8 h-8 rounded border-2 border-[#22d3ee]/40 text-[#22d3ee] hover:border-[#22d3ee] transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-mono">
            →
          </button>
        </div>
      )}

      <div className="space-y-2 sm:hidden">
        {isLoading ? (
          <PageLoading label={t('leaderboard.loadingMiners')} fullScreen={false} />
        ) : currentItems.length > 0 ? viewMode === 'pools' ? currentItems.map((entry) => {
          const globalRank = entry.position || 0;
          const rankCls = globalRank === 1 ? 'r1' : globalRank === 2 ? 'r2' : globalRank === 3 ? 'r3' : '';
          const placement = getPlacementDisplay(globalRank);
          const lvl = Math.round(Number(entry.level) || 0);
          const tier = getRankTier(clampRankLevel(lvl));
          const sellValue =
            quoteCurrency === 'USD'
              ? entry.money_balance_usd
              : quoteCurrency === 'CNY'
                ? entry.money_balance_cny
                : entry.money_balance_eur;
          const ownedEmojis = normalizeWalletDecorations(entry.wallet_emojis);
          const marketBlocks = Array.isArray(entry.market_blocks) ? entry.market_blocks : [];
          const activePenalty = entry.active_penalty;

          return (
            <article key={entry.pool_code} className="lb-card p-2">
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`rank-badge ${rankCls} shrink-0`} title={placement.title}>{placement.label}</span>
                <button
                  type="button"
                  onClick={showWalletRanking}
                  className="min-w-0 flex-1 truncate text-left font-mono text-[0.92rem] font-black text-emerald-300 transition hover:underline focus:outline-none"
                  title={`${entry.member_count} ${labels.members}`}
                >
                  #{entry.pool_code}
                </button>
                <span className="lb-status-chip online shrink-0">{entry.member_count} {labels.members}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[0.78rem] uppercase tracking-[0.1em] text-cyan-700">
                <div className="rounded border border-cyan-500/10 bg-black/60 px-1.5 py-1">
                  <div>{t('leaderboard.level')}</div>
                  <div className="mt-0.5 text-sm font-black tracking-normal" style={{ color: tier.color }}>{lvl}</div>
                </div>
                <div className="rounded border border-cyan-500/10 bg-black/60 px-1.5 py-1">
                  <div>{t('leaderboard.rank')}</div>
                  <div className="mt-0.5 text-sm font-bold tracking-normal" style={{ color: tier.color }}>{tier.emoji}</div>
                </div>
                <div className="col-span-3 rounded border border-cyan-500/10 bg-black/60 px-1.5 py-1">
                  <div>{labels.wallets}</div>
                  <div className="mt-0.5 text-[0.72rem] font-mono font-semibold tracking-normal text-cyan-300">
                    {Array.isArray(entry.member_wallets) && entry.member_wallets.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {entry.member_wallets.map((wallet, index) => (
                          <button
                            key={`${wallet}-${index}`}
                            type="button"
                            onClick={() => toggleSelectedWallet(wallet)}
                            title={wallet}
                            className="rounded border border-cyan-500/20 bg-cyan-950/10 px-2 py-1 font-mono text-[0.72rem] font-semibold text-cyan-200 transition hover:border-cyan-300"
                          >
                            {shortWallet(wallet)}
                          </button>
                        ))}
                        {entry.hidden_member_wallet_count ? (
                          <span className="rounded border border-cyan-500/20 bg-cyan-950/10 px-2 py-1 font-mono text-[0.72rem] font-semibold text-cyan-200">
                            +{entry.hidden_member_wallet_count}
                          </span>
                        ) : null}
                      </div>
                    ) : t('leaderboard.none')}
                  </div>
                </div>
                <div className="rounded border border-cyan-500/10 bg-black/60 px-1.5 py-1">
                  <div>{t('leaderboard.mm3Earned')}</div>
                  <div className="mt-0.5 font-mono text-[0.86rem] font-semibold tracking-normal text-cyan-300">{formatCompactNum(entry.available_mm3 || 0)}</div>
                </div>
                <div className="col-span-2 rounded border border-cyan-500/10 bg-black/60 px-1.5 py-1">
                  <div>{t('leaderboard.sellValue')}</div>
                  <div className="mt-0.5 font-mono text-[0.7rem] font-semibold tracking-normal text-emerald-300">{formatCompactMoney(sellValue, quoteCurrency)}</div>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-0.5 shrink-0">
                  {TRADE_SLOT_ORDER.map((slot) => {
                    const owned = ownedEmojis.includes(slot.emoji);
                    return (
                      <div
                        key={slot.key}
                        title={getEmojiTitle(slot.emoji)}
                        className="flex h-6 w-6 items-center justify-center rounded border text-[0.90rem]"
                        style={{
                          borderColor: owned ? tier.glow : 'rgba(148,163,184,0.22)',
                          background: owned ? tier.bg : 'rgba(2,6,23,0.4)',
                          color: owned ? tier.color : 'rgba(100,116,139,0.35)',
                          boxShadow: owned ? `0 0 8px ${tier.color}22` : 'none',
                        }}
                      >
                        {owned ? slot.emoji : ''}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {marketBlocks.length > 0 ? marketBlocks.map((block) => (
                    <button
                      key={block.block_key}
                      type="button"
                      onClick={() => openMarketBlock(block.block_key)}
                      title={`${block.emoji} ${block.hex}`}
                      className="relative flex h-6 w-6 items-center justify-center rounded border text-[0.90rem] transition hover:border-cyan-300"
                      style={{
                        borderColor: 'rgba(250,204,21,0.3)',
                        background: 'rgba(2,6,23,0.68)',
                        color: '#fef08a',
                        boxShadow: '0 0 8px rgba(250,204,21,0.12)',
                      }}
                    >
                      <span>{block.emoji}</span>
                      <span className="absolute bottom-[0px] right-[1px] text-[0.38rem] font-black text-cyan-100/90">
                        {block.hex.replace('#', '')}
                      </span>
                    </button>
                  )) : null}
                  {activePenalty?.mm3 ? (
                    <button
                      type="button"
                      onClick={() => openMarketBlock(activePenalty.mm3.nftji_key)}
                      className="lb-penalty-link rounded border border-rose-400/30 bg-rose-950/20 px-1.5 py-0.5 font-mono text-[0.75rem] font-black text-rose-300"
                    >
                      -{Number(activePenalty.mm3.penalty_value || 0).toFixed(8).replace(/\.?0+$/, '') || '0'} MM3
                    </button>
                  ) : null}
                  {activePenalty?.money ? (
                    <button
                      type="button"
                      onClick={() => openMarketBlock(activePenalty.money.nftji_key)}
                      className="lb-penalty-link rounded border border-amber-400/30 bg-amber-950/20 px-1.5 py-0.5 font-mono text-[0.75rem] font-black text-amber-300"
                    >
                      -{convertPenaltyEur(activePenalty.money.penalty_eur || activePenalty.money.penalty_value || 0, quoteCurrency).toFixed(8).replace(/\.?0+$/, '') || '0'} {quoteCurrency}
                    </button>
                  ) : null}
                  {marketBlocks.length === 0 && !activePenalty?.mm3 && !activePenalty?.money ? (
                    <span className="text-[0.5rem] uppercase tracking-[0.1em] text-slate-700">{t('leaderboard.none')}</span>
                  ) : null}
                </div>
              </div>
            </article>
          );
        }) : currentItems.map((entry) => {
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
          const activePenalty = entry.active_penalty;

          return (
            <article key={entry.wallet} className={`lb-card p-2${isActiveWallet ? ' wallet-active' : ''}${isSelectedWallet ? ' wallet-selected' : ''}`}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`rank-badge ${rankCls} shrink-0`} title={placement.title}>{placement.label}</span>
                <button
                  type="button"
                  onClick={() => toggleSelectedWallet(entry.wallet)}
                  className="min-w-0 flex-1 truncate text-left font-mono text-[0.86rem] font-semibold transition hover:underline focus:outline-none"
                  style={{ color: walletColor }}
                  title={isSelectedWallet ? t('leaderboard.showAllWallets') : t('leaderboard.showOnlyWallet')}
                >
                  {entry.wallet}
                </button>
                {entry.pool_code ? (
                  <button
                    type="button"
                    onClick={showPoolRanking}
                    className="shrink-0 rounded border border-emerald-400/30 bg-emerald-950/20 px-1.5 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.12em] text-emerald-300"
                    title={`${labels.pool} ${entry.pool_code}`}
                  >
                    #{entry.pool_code}
                  </button>
                ) : null}
                {activeWallet && normalizedWallet !== activeWallet ? (
                  <button
                    type="button"
                    onClick={() => handleContactWallet(entry.wallet)}
                    disabled={contactBusy === normalizedWallet}
                    className="shrink-0 rounded border border-cyan-400/25 bg-cyan-950/10 px-1.5 py-0.5 text-[0.56rem] font-black uppercase tracking-[0.12em] text-cyan-300 disabled:opacity-40"
                    title={labels.addContactTitle}
                  >
                    +{labels.addContact}
                  </button>
                ) : null}
                <span className={`lb-status-chip ${isOnline ? 'online' : 'offline'} shrink-0`}>
                  {isOnline ? t('leaderboard.online') : t('leaderboard.offline')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 text-[0.78rem] uppercase tracking-[0.1em] text-cyan-700 mb-1.5">
                <div className="rounded border border-cyan-500/10 bg-black/60 px-1.5 py-1">
                  <div>{t('leaderboard.level')}</div>
                  <div className="mt-0.5 text-sm font-black tracking-normal" style={{ color: tier.color, textShadow:`0 0 6px ${tier.color}66` }}>{lvl}</div>
                </div>
                <div className="rounded border border-cyan-500/10 bg-black/60 px-1.5 py-1">
                  <div>{t('leaderboard.rank')}</div>
                  <div className="mt-0.5 text-sm font-bold tracking-normal" style={{ color: tier.color }} title={tier.label}>{tier.emoji}</div>
                </div>
                <div className="rounded border border-cyan-500/10 bg-black/60 px-1.5 py-1">
                  <div>{t('leaderboard.execs')}</div>
                  <div className="mt-0.5 font-mono text-[0.7rem] font-semibold tracking-normal text-cyan-300">{Number(entry.execs_count || 0)}</div>
                </div>
                <div className="rounded border border-cyan-500/10 bg-black/60 px-1.5 py-1">
                  <div>{t('leaderboard.mm3Earned')}</div>
                  <div className="mt-0.5 font-mono text-[0.86rem] font-semibold tracking-normal text-cyan-300">{formatCompactNum(entry.available_mm3 || 0)}</div>
                </div>
                <div className="col-span-2 rounded border border-cyan-500/10 bg-black/60 px-1.5 py-1">
                  <div>{t('leaderboard.sellValue')}</div>
                  <div className="mt-0.5 font-mono text-[0.7rem] font-semibold tracking-normal text-emerald-300">{formatCompactMoney(sellValue, quoteCurrency)}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-0.5 shrink-0">
                  {TRADE_SLOT_ORDER.map((slot) => {
                    const owned = ownedEmojis.includes(slot.emoji);
                    return (
                      <div
                        key={slot.key}
                        title={getEmojiTitle(slot.emoji)}
                        className="flex h-6 w-6 items-center justify-center rounded border text-[0.90rem]"
                        style={{
                          borderColor: owned ? tier.glow : 'rgba(148,163,184,0.22)',
                          background: owned ? tier.bg : 'rgba(2,6,23,0.4)',
                          color: owned ? tier.color : 'rgba(100,116,139,0.35)',
                          boxShadow: owned ? `0 0 8px ${tier.color}22` : 'none',
                        }}
                      >
                        {owned ? slot.emoji : ''}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {marketBlocks.length > 0 ? marketBlocks.map((block) => (
                    <button
                      key={block.block_key}
                      type="button"
                      onClick={() => openMarketBlock(block.block_key)}
                      title={`${block.emoji} ${block.hex}`}
                      className="relative flex h-6 w-6 items-center justify-center rounded border text-[0.90rem] transition hover:border-cyan-300"
                      style={{
                        borderColor: 'rgba(250,204,21,0.3)',
                        background: 'rgba(2,6,23,0.68)',
                        color: '#fef08a',
                        boxShadow: '0 0 8px rgba(250,204,21,0.12)',
                      }}
                    >
                      <span>{block.emoji}</span>
                      <span className="absolute bottom-[0px] right-[1px] text-[0.38rem] font-black text-cyan-100/90">
                        {block.hex.replace('#', '')}
                      </span>
                    </button>
                  )) : null}
                  {activePenalty?.mm3 ? (
                    <button
                      type="button"
                      onClick={() => openMarketBlock(activePenalty.mm3.nftji_key)}
                      className="lb-penalty-link rounded border border-rose-400/30 bg-rose-950/20 px-1.5 py-0.5 font-mono text-[0.75rem] font-black text-rose-300"
                      title={activePenalty.mm3.block ? `${activePenalty.mm3.block.emoji} ${activePenalty.mm3.block.hex}` : activePenalty.mm3.nftji_key}
                    >
                      -{Number(activePenalty.mm3.penalty_value || 0).toFixed(8).replace(/\.?0+$/, '') || '0'} MM3
                    </button>
                  ) : null}
                  {activePenalty?.money ? (
                    <button
                      type="button"
                      onClick={() => openMarketBlock(activePenalty.money.nftji_key)}
                      className="lb-penalty-link rounded border border-amber-400/30 bg-amber-950/20 px-1.5 py-0.5 font-mono text-[0.75rem] font-black text-amber-300"
                      title={activePenalty.money.block ? `${activePenalty.money.block.emoji} ${activePenalty.money.block.hex}` : activePenalty.money.nftji_key}
                    >
                      -{convertPenaltyEur(activePenalty.money.penalty_eur || activePenalty.money.penalty_value || 0, quoteCurrency).toFixed(8).replace(/\.?0+$/, '') || '0'} {quoteCurrency}
                    </button>
                  ) : null}
                  {marketBlocks.length === 0 && !activePenalty?.mm3 && !activePenalty?.money ? (
                    <span className="text-[0.5rem] uppercase tracking-[0.1em] text-slate-700">{t('leaderboard.none')}</span>
                  ) : null}
                </div>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-xl border border-cyan-500/20 bg-black/80 p-5 text-center text-xs text-gray-500">
            {viewMode === 'pools' ? labels.noPools : t('leaderboard.noMiners')}
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="lb-tbl w-full">
          <thead>
            {viewMode === 'pools' ? (
              <tr>
                <th style={{ width:'7%', textAlign:'center' }}><SortButton sortKey="position" className="justify-center">{t('leaderboard.position')}</SortButton></th>
                <th style={{ width:'18%' }}><SortButton sortKey="pool">{labels.pool}</SortButton></th>
                <th style={{ width:'20%' }}><SortButton sortKey="wallets">{labels.wallets}</SortButton></th>
                <th style={{ width:'15%', textAlign:'center' }} title="NFTJIs — pool union"><SortButton sortKey="nftji" className="justify-center">NTFJIs</SortButton></th>
                <th style={{ width:'13%', textAlign:'center' }}><SortButton sortKey="block" className="justify-center">{t('leaderboard.blockPenalty')}</SortButton></th>
                <th style={{ width:'8%', textAlign:'center' }}><SortButton sortKey="level" className="justify-center">{t('leaderboard.level')}</SortButton></th>
                <th style={{ width:'8%', textAlign:'center' }}><SortButton sortKey="rank" className="justify-center">{t('leaderboard.rank')}</SortButton></th>
                <th style={{ width:'11%', textAlign:'right', paddingRight:'1rem' }}><SortButton sortKey="available_mm3" className="justify-end">{t('leaderboard.mm3Earned')}</SortButton></th>
                <th style={{ width:'12%', textAlign:'right', paddingRight:'1rem' }}><SortButton sortKey="money" className="justify-end">{t('leaderboard.sellValue')}</SortButton></th>
              </tr>
            ) : (
              <tr>
                <th style={{ width:'5%', textAlign:'center' }}><SortButton sortKey="position" className="justify-center">{t('leaderboard.position')}</SortButton></th>
                <th style={{ width:'9%', textAlign:'center' }}><SortButton sortKey="status" className="justify-center">{t('leaderboard.status')}</SortButton></th>
                <th style={{ width:'23%' }}><SortButton sortKey="wallet">{t('leaderboard.minerWallet')}</SortButton></th>
                <th style={{ width:'8%', textAlign:'center' }}><SortButton sortKey="pool" className="justify-center">{labels.pool}</SortButton></th>
                <th style={{ width:'13%', textAlign:'center' }} title="NTFJIs — probability artifacts that influence MM3 global value"><SortButton sortKey="nftji" className="justify-center">NTFJIs</SortButton></th>
                <th style={{ width:'7%', textAlign:'center' }}><SortButton sortKey="execs" className="justify-center">{t('leaderboard.execs')}</SortButton></th>
                <th style={{ width:'11%', textAlign:'center' }}><SortButton sortKey="block" className="justify-center">{t('leaderboard.blockPenalty')}</SortButton></th>
                <th style={{ width:'6%', textAlign:'center' }}><SortButton sortKey="level" className="justify-center">{t('leaderboard.level')}</SortButton></th>
                <th style={{ width:'7%', textAlign:'center' }}><SortButton sortKey="rank" className="justify-center">{t('leaderboard.rank')}</SortButton></th>
                <th style={{ width:'9%', textAlign:'right', paddingRight:'1rem' }}><SortButton sortKey="available_mm3" className="justify-end">{t('leaderboard.mm3Earned')}</SortButton></th>
                <th style={{ width:'9%', textAlign:'right', paddingRight:'1rem' }}><SortButton sortKey="money" className="justify-end">{t('leaderboard.sellValue')}</SortButton></th>
              </tr>
            )}
          </thead>
          <tbody>
            {isLoading ? (
              <tr className="lb-row">
                <td colSpan={viewMode === 'pools' ? 9 : 11} style={{ textAlign:'center', padding: '2rem' }}>
                  <PageLoading label={t('leaderboard.loadingMiners')} fullScreen={false} />
                </td>
              </tr>
            ) : currentItems.length > 0 ? viewMode === 'pools' ? currentItems.map((entry) => {
              const globalRank = entry.position || 0;
              const rankCls = globalRank === 1 ? 'r1' : globalRank === 2 ? 'r2' : globalRank === 3 ? 'r3' : '';
              const placement = getPlacementDisplay(globalRank);
              const lvl = Math.round(Number(entry.level) || 0);
              const tier = getRankTier(clampRankLevel(lvl));
              const sellValue =
                quoteCurrency === 'USD'
                  ? entry.money_balance_usd
                  : quoteCurrency === 'CNY'
                    ? entry.money_balance_cny
                    : entry.money_balance_eur;
              const ownedEmojis = normalizeWalletDecorations(entry.wallet_emojis);
              const marketBlocks = Array.isArray(entry.market_blocks) ? entry.market_blocks : [];
              const activePenalty = entry.active_penalty;

              return (
                <tr key={entry.pool_code} className="lb-row">
                  <td style={{ textAlign:'center' }}>
                    <span className={`rank-badge ${rankCls}`} title={placement.title}>{placement.label}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={showWalletRanking}
                      className="font-mono font-black text-[0.95rem] text-emerald-300 transition hover:underline focus:outline-none"
                      title={`${entry.member_count} ${labels.members}`}
                    >
                      #{entry.pool_code}
                    </button>
                    <span className="ml-2 text-[0.62rem] uppercase tracking-[0.12em] text-slate-600">
                      {entry.member_count} {labels.members}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center justify-center gap-1 text-[0.8rem] uppercase tracking-[0.08em] text-cyan-300">
                      {(entry.member_wallets || []).map((wallet, index) => (
                        <button
                          key={`${wallet}-${index}`}
                          type="button"
                          onClick={() => toggleSelectedWallet(wallet)}
                          title={wallet}
                          className="rounded border border-cyan-500/20 bg-cyan-950/10 px-2 py-1 font-mono text-[0.72rem] font-semibold text-cyan-200 transition hover:border-cyan-300"
                        >
                          {shortWallet(wallet)}
                        </button>
                      ))}
                      {entry.hidden_member_wallet_count ? (
                        <span className="rounded border border-cyan-500/20 bg-cyan-950/10 px-2 py-1 font-mono text-[0.72rem] font-semibold text-cyan-200">
                          +{entry.hidden_member_wallet_count}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span className="font-mono font-semibold text-cyan-100">
                      {Number(entry.avg_nftjis || 0).toFixed(2)}
                    </span>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span className="font-mono font-semibold text-cyan-100">
                      {Number(entry.avg_nftjis || 0).toFixed(2)}
                    </span>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span className="font-mono font-semibold text-cyan-100">
                      {Number(entry.avg_block_pen || 0).toFixed(2)}
                    </span>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span className="font-mono font-black text-[1.05rem]" style={{ color: tier.color, textShadow:`0 0 8px ${tier.color}66` }}>
                      {lvl}
                    </span>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span className="inline-flex items-center justify-center text-[0.8rem] font-mono font-bold" style={{ color: tier.color }} title={tier.label}>
                      <span>{tier.emoji}</span>
                    </span>
                  </td>
                  <td style={{ textAlign:'right', paddingRight:'1rem' }}>
                    <span className="text-[#22d3ee] font-mono font-semibold text-[0.86rem]">
                      {formatCompactNum(entry.available_mm3 || 0)}
                    </span>
                  </td>
                  <td style={{ textAlign:'right', paddingRight:'1rem' }}>
                    <span className="whitespace-nowrap font-mono font-semibold text-emerald-300 text-[0.86rem]">
                      {formatCompactMoney(sellValue, quoteCurrency)}
                    </span>
                  </td>
                </tr>
              );
            }) : currentItems.map((entry) => {
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
              const activePenalty = entry.active_penalty;

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
                    <div className="flex min-w-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => toggleSelectedWallet(entry.wallet)}
                        className="break-all text-left font-mono font-semibold text-[0.95rem] transition hover:underline focus:outline-none"
                        style={{ color: walletColor }}
                        title={isSelectedWallet ? t('leaderboard.showAllWallets') : t('leaderboard.showOnlyWallet')}
                      >
                        {entry.wallet}
                      </button>
                      {activeWallet && !isActiveWallet ? (
                        <button
                          type="button"
                          onClick={() => handleContactWallet(entry.wallet)}
                          disabled={contactBusy === normalizedWallet}
                          className="w-fit rounded border border-cyan-400/25 bg-cyan-950/10 px-2 py-0.5 font-mono text-[0.58rem] font-black uppercase tracking-[0.14em] text-cyan-300 transition hover:border-cyan-300 disabled:cursor-wait disabled:opacity-50"
                        >
                          {contactBusy === normalizedWallet ? '...' : labels.addContact}
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    {entry.pool_code ? (
                      <button
                        type="button"
                        onClick={showPoolRanking}
                        className="rounded border border-emerald-400/25 bg-emerald-950/10 px-2 py-1 font-mono text-[0.72rem] font-black text-emerald-300 transition hover:border-emerald-300 hover:text-emerald-100"
                        title={labels.viewPoolRanking}
                      >
                        #{entry.pool_code}
                      </button>
                    ) : (
                      <span className="text-[0.7rem] uppercase tracking-[0.12em] text-slate-700">{t('leaderboard.none')}</span>
                    )}
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <div className="flex items-center justify-center gap-1">
                      {TRADE_SLOT_ORDER.map((slot) => {
                        const owned = ownedEmojis.includes(slot.emoji);
                        return (
                          <div
                            key={slot.key}
                            title={getEmojiTitle(slot.emoji)}
                            className="lb-slot-cell flex items-center justify-center rounded-md border text-[0.95rem]"
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
                    <span className="font-mono font-black text-[0.95rem] text-cyan-300">
                      {Number(entry.execs_count || 0)}
                    </span>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {marketBlocks.length > 0 ? marketBlocks.map((block) => (
                        <button
                          key={block.block_key}
                          type="button"
                          onClick={() => openMarketBlock(block.block_key)}
                          title={`${block.emoji} ${block.hex}`}
                          className="lb-block-cell relative flex items-center justify-center rounded-md border text-[0.95rem] transition hover:border-cyan-300 hover:text-cyan-100"
                          style={{
                            borderColor: 'rgba(250,204,21,0.3)',
                            background: 'rgba(2,6,23,0.68)',
                            color: '#fef08a',
                            boxShadow: '0 0 10px rgba(250,204,21,0.12)',
                          }}
                        >
                          <span>{block.emoji}</span>
                          <span className="absolute bottom-[1px] right-[2px] text-[0.44rem] font-black tracking-[0.08em] text-cyan-100/90">
                            {block.hex.replace('#', '')}
                          </span>
                        </button>
                      )) : null}
                      {activePenalty?.mm3 ? (
                        <button
                          type="button"
                          onClick={() => openMarketBlock(activePenalty.mm3.nftji_key)}
                          className="lb-penalty-link rounded border border-rose-400/30 bg-rose-950/20 px-1.5 py-1 font-mono text-[0.76rem] font-black text-rose-300"
                          title={activePenalty.mm3.block ? `${activePenalty.mm3.block.emoji} ${activePenalty.mm3.block.hex}` : activePenalty.mm3.nftji_key}
                        >
                          -{Number(activePenalty.mm3.penalty_value || 0).toFixed(8).replace(/\.?0+$/, '') || '0'} MM3
                        </button>
                      ) : null}
                      {activePenalty?.money ? (
                        <button
                          type="button"
                          onClick={() => openMarketBlock(activePenalty.money.nftji_key)}
                          className="lb-penalty-link rounded border border-amber-400/30 bg-amber-950/20 px-1.5 py-1 font-mono text-[0.76rem] font-black text-amber-300"
                          title={activePenalty.money.block ? `${activePenalty.money.block.emoji} ${activePenalty.money.block.hex}` : activePenalty.money.nftji_key}
                        >
                          -{convertPenaltyEur(activePenalty.money.penalty_eur || activePenalty.money.penalty_value || 0, quoteCurrency).toFixed(8).replace(/\.?0+$/, '') || '0'} {quoteCurrency}
                        </button>
                      ) : null}
                      {marketBlocks.length === 0 && !activePenalty?.mm3 && !activePenalty?.money ? (
                        <span className="text-[0.75rem] uppercase tracking-[0.12em] text-slate-600">{t('leaderboard.none')}</span>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span className="font-mono font-black text-[1.05rem]" style={{ color: tier.color, textShadow:`0 0 8px ${tier.color}66` }}>
                      {lvl}
                    </span>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span className="inline-flex items-center justify-center text-[0.8rem] font-mono font-bold" style={{ color: tier.color }} title={tier.label}>
                      <span>{tier.emoji}</span>
                    </span>
                  </td>
                  <td style={{ textAlign:'right', paddingRight:'1rem' }}>
                    <span className="text-[#22d3ee] font-mono font-semibold text-[0.86rem]">
                      {formatCompactNum(entry.available_mm3 || 0)}
                    </span>
                  </td>
                  <td style={{ textAlign:'right', paddingRight:'1rem' }}>
                    <span className="whitespace-nowrap font-mono font-semibold text-emerald-300 text-[0.86rem]">
                      {formatCompactMoney(sellValue, quoteCurrency)}
                    </span>
                  </td>
                </tr>
              );
            }) : (
              <tr className="lb-row">
                <td colSpan={viewMode === 'pools' ? 9 : 11} className="text-center py-8 text-gray-500">
                  {viewMode === 'pools' ? labels.noPools : t('leaderboard.noMiners')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-5 flex-wrap">
          <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}
                  className="w-9 h-9 rounded-lg border-2 border-[#22d3ee]/40 text-[#22d3ee] hover:border-[#22d3ee] transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-mono">
            ←
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
                  className="w-9 h-9 rounded-lg border-2 border-[#22d3ee]/40 text-[#22d3ee] hover:border-[#22d3ee] transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-mono">
            →
          </button>
        </div>
      )}
    </div>
  );
}
