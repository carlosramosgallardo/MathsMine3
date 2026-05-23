'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { BUY_RATE_PREMIUM, CNY_TO_EUR, CNY_TO_USD, getBuyQuote, getSellQuote, formatMoney, getRateByCurrency } from '@/lib/sell-offer';
import { useI18n } from '@/lib/i18n-context';
import { useCurrency } from '@/lib/currency-context';
import { normalizeMacroState } from '@/lib/mm3-macro';
import { getRankTier } from '@/lib/ranks';
import { TRADE_SLOT_ORDER, normalizeWalletDecorations } from '@/lib/wallet-decorations';
import { useDice } from '@/lib/dice-context';
import { getDiceState } from '@/lib/dice';
import { useSound } from '@/lib/sound-context';
import PageLoading from '@/components/PageLoading';

const MIN_TRADE_MM3 = 0.00001;
const SLIDER_STEPS = 1000;
const DAILY_TX_LIMIT = 5;
const TX_PAGE_SIZE = 10;

function fmtMm3(value) {
  const safeValue = Number(value) || 0;
  const absValue = Math.abs(safeValue);
  if (absValue === 0) return '0.00000000';
  if (absValue < 0.0001) return safeValue.toFixed(8);
  return safeValue.toFixed(6);
}

function quoteField(prefix, currency) {
  return `${prefix}${currency[0]}${currency.slice(1).toLowerCase()}`;
}

function pushToast(msg, type = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type } }));
  }
}

function formatTxTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function txCurrencyAmount(tx, prefix, currency) {
  return Number(tx?.[quoteField(prefix, currency)] || 0);
}

function txRateByCurrency(tx, currency) {
  const storedRateCny = Number(tx?.rate_cny) || 0;
  if (storedRateCny > 0) {
    if (currency === 'USD') return storedRateCny * CNY_TO_USD;
    if (currency === 'CNY') return storedRateCny;
    return storedRateCny * CNY_TO_EUR;
  }

  const isBuy = Number(tx?.mm3_amount) < 0;
  const baseRate = getRateByCurrency(Number(tx?.level) || 0, currency);
  return isBuy ? baseRate * BUY_RATE_PREMIUM : baseRate;
}

function txMoneyBreakdown(tx, currency) {
  const tradedMm3 = Math.abs(Number(tx?.mm3_amount) || 0);
  const commissionMm3 = Math.abs(Number(tx?.mm3_commission) || 0);
  const rate = txRateByCurrency(tx, currency);
  const storedGross = Math.abs(txCurrencyAmount(tx, 'gross', currency));
  const storedNet = Math.abs(txCurrencyAmount(tx, 'net', currency));
  const storedCommission = Math.abs(txCurrencyAmount(tx, 'commission', currency));
  const computedGross = tradedMm3 * rate;
  const computedCommission = commissionMm3 * rate;
  const gross = storedGross > 0 ? storedGross : computedGross;
  const commission = storedCommission > 0 ? storedCommission : computedCommission;
  const net = storedNet > 0 ? storedNet : Math.max(0, gross - commission);

  return {
    gross,
    net,
    commission,
    rate: rate || (tradedMm3 > 0 ? gross / tradedMm3 : 0),
  };
}

function markLeaderboardDirty() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lb_dirty_at', String(Date.now()));
  }
}

function getUtcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return { start, end };
}

function formatCountdown(ms) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(safe / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
  const seconds = String(safe % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function getTxLogStorageKey(account) {
  return `mm3-trade-txlog:${String(account || '').toLowerCase()}`;
}

function getTradeSlotTitle(slot, level, language) {
  const safeLevel = Math.max(0, Math.min(100, Number(level) || 0));
  const levelMultiplier = 1 + safeLevel * 0.001;
  const levelPct = (safeLevel * 0.1).toFixed(1);
  const slotPct = ((slot.multiplier - 1) * 100).toFixed(1);
  const slotSign = slot.multiplier >= 1 ? '+' : '';

  if (language === 'es') {
    return `${slot.emoji} recibido x${slot.multiplier} | nftji ${slotSign}${slotPct}% | nivel x${levelMultiplier.toFixed(3)} (+${levelPct}% actual)`;
  }

  return `${slot.emoji} received x${slot.multiplier} | nftji ${slotSign}${slotPct}% | level x${levelMultiplier.toFixed(3)} (+${levelPct}% current)`;
}

function getTradeBoostBreakdown(value, level = 0) {
  const owned = new Set(normalizeWalletDecorations(value));
  const nftMultiplier = TRADE_SLOT_ORDER.reduce(
    (acc, slot) => (owned.has(slot.emoji) ? acc * slot.multiplier : acc),
    1
  );
  const safeLevel = Math.max(0, Math.min(100, Number(level) || 0));
  const levelMultiplier = 1 + safeLevel * 0.001;
  return {
    nftMultiplier,
    levelMultiplier,
    totalMultiplier: nftMultiplier * levelMultiplier,
  };
}

function getMinimumBuyFunds(level, currency, walletDecorations, macroState) {
  let low = 0;
  let high = Math.max(getRateByCurrency(level, currency) * MIN_TRADE_MM3 * 2, 0.00000001);

  for (let i = 0; i < 24; i += 1) {
    const quote = getBuyQuote(level, high, currency, walletDecorations, macroState);
    if (quote.netMm3 >= MIN_TRADE_MM3) break;
    high *= 2;
  }

  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    const quote = getBuyQuote(level, mid, currency, walletDecorations, macroState);
    if (quote.netMm3 >= MIN_TRADE_MM3) high = mid;
    else low = mid;
  }
  return high;
}

export default function TradeBoard({ account, isVirtualWallet = false }) {
  const { t, language } = useI18n();
  const { currency } = useCurrency();
  const diceState = useDice();
  const diceModifier = diceState?.active ? diceState.modifier : 0;
  const { playTrade } = useSound();
  const [level, setLevel] = useState(0);
  const [availableMm3, setAvailableMm3] = useState(0);
  const [funds, setFunds] = useState({ cny: 0, eur: 0, usd: 0 });
  const [mode, setMode] = useState('sell');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [walletDecorations, setWalletDecorations] = useState([]);
  const [nftjiLevels, setNftjiLevels] = useState({});
  const [marketNftjiEmoji, setMarketNftjiEmoji] = useState(null);
  const [macroState, setMacroState] = useState(() => normalizeMacroState());
  const [tradeRatio, setTradeRatio] = useState(100);
  const [showTransactions, setShowTransactions] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [dailyTxCount, setDailyTxCount] = useState(0);
  const [resetCountdown, setResetCountdown] = useState('');
  const ledgerRef = useRef(null);

  const loadDailyTxCount = async (wallet = account) => {
    if (!wallet) {
      setDailyTxCount(0);
      return 0;
    }
    const { start, end } = getUtcDayBounds();
    const { count, error } = await supabase
      .from('mm3_sell_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', String(wallet).toLowerCase())
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());
    if (error) throw error;
    const nextCount = Number(count) || 0;
    setDailyTxCount(nextCount);
    return nextCount;
  };

  const loadTransactions = async () => {
    if (!account) {
      setTransactions([]);
      setTransactionsTotal(0);
      setDailyTxCount(0);
      return;
    }
    setTransactionsLoading(true);
    try {
      const wallet = account.toLowerCase();
      const from = (transactionsPage - 1) * TX_PAGE_SIZE;
      const to = from + TX_PAGE_SIZE - 1;
      const [txResult] = await Promise.all([
        supabase
          .from('mm3_sell_transactions')
          .select('id, wallet, source, level, mm3_amount, mm3_commission, rate_cny, gross_cny, gross_eur, gross_usd, commission_rate, commission_cny, commission_eur, commission_usd, net_cny, net_eur, net_usd, created_at', { count: 'exact' })
          .eq('wallet', wallet)
          .order('created_at', { ascending: false })
          .range(from, to),
        loadDailyTxCount(wallet),
      ]);
      if (txResult.error) throw txResult.error;
      setTransactions(Array.isArray(txResult.data) ? txResult.data : []);
      setTransactionsTotal(Number(txResult.count) || 0);
    } catch (error) {
      console.error('trade transactions load:', error);
      pushToast(error?.message || t('tradeBoard.transactionsFailed'), 'error');
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    const loadMacro = async () => {
      try {
        const { data } = await supabase
          .from('mm3_macro_state')
          .select('war_percent, nature_percent')
          .eq('id', 1)
          .maybeSingle();
        setMacroState(normalizeMacroState(data));
      } catch {}
    };

    loadMacro();
    const timer = setInterval(loadMacro, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!account) {
      setLevel(0);
      setAvailableMm3(0);
      setFunds({ cny: 0, eur: 0, usd: 0 });
      setWalletDecorations([]);
      setTransactions([]);
      setShowTransactions(false);
      setTransactionsPage(1);
      setTransactionsTotal(0);
      setDailyTxCount(0);
      return;
    }

    setLevel(0);
    setAvailableMm3(0);
    setFunds({ cny: 0, eur: 0, usd: 0 });
    setWalletDecorations([]);
    setTransactions([]);
    setTransactionsPage(1);
    setTransactionsTotal(0);
    setDailyTxCount(0);
    setShowTransactions(() => {
      if (typeof window === 'undefined') return false;
      return localStorage.getItem(getTxLogStorageKey(account)) === '1';
    });

    const load = async () => {
      setLoading(true);
      try {
        const wallet = account.toLowerCase();
        const [{ data: progress }, { data: stats }, { data: marketBlockRows }] = await Promise.all([
          supabase
            .from('player_progress')
            .select('level, mm3_sold, cny_earned, eur_earned, usd_earned, wallet_emojis, mining_nftji_key, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level')
            .eq('wallet', wallet)
            .maybeSingle(),
          supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
          supabase.from('mm3_mining_blocks').select('block_key, emoji'),
        ]);
        setLevel(progress?.level ?? 0);
        const totalMm3 = Number(stats?.total_eth) || 0;
        const soldMm3 = Number(progress?.mm3_sold) || 0;
        setAvailableMm3(totalMm3 - soldMm3);
        setFunds({
          cny: Number(progress?.cny_earned) || 0,
          eur: Number(progress?.eur_earned) || 0,
          usd: Number(progress?.usd_earned) || 0,
        });
        setWalletDecorations(normalizeWalletDecorations(progress?.wallet_emojis));
        setNftjiLevels({
          lucky50: Number(progress?.lucky_50_level ?? -1),
          lucky100: Number(progress?.lucky_100_level ?? -1),
          lucky500: Number(progress?.lucky_500_level ?? -1),
          lucky1000: Number(progress?.lucky_1000_level ?? -1),
        });
        const blockEmojiMap = new Map((marketBlockRows || []).map(b => [b.block_key, b.emoji]));
        const nftjiKey = progress?.mining_nftji_key || null;
        setMarketNftjiEmoji(nftjiKey ? (blockEmojiMap.get(nftjiKey) || null) : null);
        await loadDailyTxCount(wallet);
      } catch (error) {
        console.error('trade board load:', error);
      } finally {
        setLoading(false);
      }
    };

    load();

    const refresh = () => load();
    window.addEventListener('mm3-db-updated', refresh);
    return () => window.removeEventListener('mm3-db-updated', refresh);
  }, [account]);

  useEffect(() => {
    if (!account) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem(getTxLogStorageKey(account), showTransactions ? '1' : '0');
    }
    if (showTransactions) {
      loadTransactions();
      setTimeout(() => {
        if (window.matchMedia?.('(max-width: 767px)').matches) return;
        ledgerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    }
  }, [showTransactions, account, transactionsPage]);

  useEffect(() => {
    const tick = () => {
      const { end } = getUtcDayBounds();
      setResetCountdown(formatCountdown(end.getTime() - Date.now()));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentFunds = funds[currency.toLowerCase()] || 0;
  const tier = getRankTier(level);
  const rateByCurrency = {
    EUR: getRateByCurrency(level, 'EUR'),
    USD: getRateByCurrency(level, 'USD'),
    CNY: getRateByCurrency(level, 'CNY'),
  };
  const maxSellMm3 = Math.max(0, availableMm3);
  const minSellMm3 = maxSellMm3 >= MIN_TRADE_MM3 ? MIN_TRADE_MM3 : 0;
  const maxBuyFunds = Math.max(0, currentFunds);
  const maxBuyQuote = useMemo(() => getBuyQuote(level, maxBuyFunds, currency, walletDecorations, macroState, diceModifier, nftjiLevels), [level, maxBuyFunds, currency, walletDecorations, macroState, diceModifier, nftjiLevels]);
  const minBuyFunds = useMemo(
    () => getMinimumBuyFunds(level, currency, walletDecorations, macroState),
    [level, currency, walletDecorations, macroState]
  );
  const canSell = maxSellMm3 >= MIN_TRADE_MM3;
  const canBuy = maxBuyFunds >= minBuyFunds && maxBuyQuote.netMm3 >= MIN_TRADE_MM3;
  const selectedSellMm3 = canSell
    ? minSellMm3 + (maxSellMm3 - minSellMm3) * (tradeRatio / SLIDER_STEPS)
    : 0;
  const selectedBuyFunds = canBuy
    ? minBuyFunds + (maxBuyFunds - minBuyFunds) * (tradeRatio / SLIDER_STEPS)
    : 0;
  const sellQuote = useMemo(() => getSellQuote(level, selectedSellMm3, walletDecorations, macroState, diceModifier, nftjiLevels), [level, selectedSellMm3, walletDecorations, macroState, diceModifier, nftjiLevels]);
  const buyQuote = useMemo(() => getBuyQuote(level, selectedBuyFunds, currency, walletDecorations, macroState, diceModifier, nftjiLevels), [level, selectedBuyFunds, currency, walletDecorations, macroState, diceModifier, nftjiLevels]);
  const activeQuote = mode === 'buy' ? buyQuote : sellQuote;
  const activeRate = mode === 'buy' ? activeQuote.rateCurrency : rateByCurrency[currency];
  const sliderDisabled = mode === 'buy' ? !canBuy : !canSell;
  const canTradeToday = dailyTxCount < DAILY_TX_LIMIT;
  const totalPages = Math.max(1, Math.ceil(transactionsTotal / TX_PAGE_SIZE));
  const visibleTxCount = Math.min(dailyTxCount, DAILY_TX_LIMIT);
  const boostBreakdown = useMemo(
    () => getTradeBoostBreakdown(walletDecorations, level),
    [walletDecorations, level]
  );
  const receiveAmount = mode === 'buy' ? activeQuote.netMm3 : Number(activeQuote[quoteField('net', currency)] || 0);
  const receiveBaseAmount = boostBreakdown.totalMultiplier > 0 ? receiveAmount / boostBreakdown.totalMultiplier : receiveAmount;
  const receiveBonusAmount = Math.max(0, receiveAmount - receiveBaseAmount);

  const handleTrade = async () => {
    if (!account) {
      pushToast(t('tradeBoard.connectWalletError'), 'error');
      return;
    }
    if (mode === 'sell' && !canSell) {
      pushToast(t('tradeBoard.insufficientMm3Error'), 'error');
      return;
    }
    if (mode === 'buy' && !canBuy) {
      pushToast(t('tradeBoard.insufficientFundsError'), 'error');
      return;
    }
    if (!canTradeToday) {
      pushToast(`${t('tradeBoard.dailyLimitReached')} ${t('tradeBoard.resetIn')} ${resetCountdown}`, 'error');
      return;
    }

    setProcessing(true);
    try {
      const wallet = account.toLowerCase();
      const liveDailyCount = await loadDailyTxCount(wallet);
      if (liveDailyCount >= DAILY_TX_LIMIT) {
        pushToast(`${t('tradeBoard.dailyLimitReached')} ${t('tradeBoard.resetIn')} ${resetCountdown}`, 'error');
        return;
      }
      const [{ data: progress }, { data: stats }, { data: market }, { data: macroRow }] = await Promise.all([
          supabase
            .from('player_progress')
            .select('level, mm3_sold, cny_earned, eur_earned, usd_earned, wallet_emojis, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level')
            .eq('wallet', wallet)
            .maybeSingle(),
        supabase
          .from('leaderboard_data')
          .select('total_eth')
          .eq('wallet', wallet)
          .maybeSingle(),
        supabase
          .from('mm3_mining_state')
          .select('id, commission_mm3, commission_cny, commission_eur, commission_usd')
          .eq('id', 1)
          .maybeSingle(),
        supabase
          .from('mm3_macro_state')
          .select('war_percent, nature_percent')
          .eq('id', 1)
          .maybeSingle(),
      ]);

      const liveLevel = Math.max(0, Math.min(100, Number(progress?.level) || level));
      const totalMm3 = Number(stats?.total_eth) || 0;
      const soldMm3 = Number(progress?.mm3_sold) || 0;
      const liveAvailableMm3 = totalMm3 - soldMm3;
      const liveFunds = {
        cny: Number(progress?.cny_earned) || 0,
        eur: Number(progress?.eur_earned) || 0,
        usd: Number(progress?.usd_earned) || 0,
      };
      const liveDecorations = normalizeWalletDecorations(progress?.wallet_emojis);
      const liveMacroState = normalizeMacroState(macroRow);
      const liveNftjiLevels = {
        lucky50: Number(progress?.lucky_50_level ?? -1),
        lucky100: Number(progress?.lucky_100_level ?? -1),
        lucky500: Number(progress?.lucky_500_level ?? -1),
        lucky1000: Number(progress?.lucky_1000_level ?? -1),
      };
      // Recompute dice at execution time (deterministic from current clock)
      const liveDice = getDiceState();
      const liveDiceModifier = liveDice.active ? liveDice.modifier : 0;
      const requestedAmount =
        mode === 'buy'
          ? Math.min(liveFunds[currency.toLowerCase()] || 0, selectedBuyFunds)
          : Math.min(liveAvailableMm3, selectedSellMm3);
      const liveTradeQuote =
        mode === 'buy'
          ? getBuyQuote(liveLevel, requestedAmount, currency, liveDecorations, liveMacroState, liveDiceModifier, liveNftjiLevels)
          : getSellQuote(liveLevel, requestedAmount, liveDecorations, liveMacroState, liveDiceModifier, liveNftjiLevels);

      if (mode === 'sell' && liveTradeQuote.totalMm3 < MIN_TRADE_MM3) {
        pushToast(t('tradeBoard.insufficientMm3Error'), 'error');
        return;
      }
      if (mode === 'buy' && liveTradeQuote.netMm3 < MIN_TRADE_MM3) {
        pushToast(t('tradeBoard.insufficientFundsError'), 'error');
        return;
      }

      const nextProgress =
        mode === 'buy'
          ? {
              wallet,
              level: liveLevel,
              mm3_sold: soldMm3 - liveTradeQuote.netMm3,
              cny_earned: Math.max(0, liveFunds.cny - liveTradeQuote.grossCny),
              eur_earned: Math.max(0, liveFunds.eur - liveTradeQuote.grossEur),
              usd_earned: Math.max(0, liveFunds.usd - liveTradeQuote.grossUsd),
              sell_rate_cny: getSellQuote(liveLevel, 0).rateCny,
              sell_quote_cny: 0,
              sell_quote_eur: 0,
              sell_quote_usd: 0,
              updated_at: new Date().toISOString(),
            }
          : {
              wallet,
              level: liveLevel,
              mm3_sold: soldMm3 + liveTradeQuote.totalMm3,
              cny_earned: liveFunds.cny + liveTradeQuote.netCny,
              eur_earned: liveFunds.eur + liveTradeQuote.netEur,
              usd_earned: liveFunds.usd + liveTradeQuote.netUsd,
              sell_rate_cny: getSellQuote(liveLevel, 0).rateCny,
              sell_quote_cny: 0,
              sell_quote_eur: 0,
              sell_quote_usd: 0,
              updated_at: new Date().toISOString(),
            };

      const { error: progressError } = await supabase
        .from('player_progress')
        .upsert(nextProgress, { onConflict: 'wallet', ignoreDuplicates: false });
      if (progressError) throw progressError;

      const { error: marketError } = await supabase
        .from('mm3_mining_state')
        .upsert(
          {
            id: 1,
            commission_mm3: (Number(market?.commission_mm3) || 0) + liveTradeQuote.commissionMm3,
            commission_cny: (Number(market?.commission_cny) || 0) + liveTradeQuote.commissionCny,
            commission_eur: (Number(market?.commission_eur) || 0) + liveTradeQuote.commissionEur,
            commission_usd: (Number(market?.commission_usd) || 0) + liveTradeQuote.commissionUsd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id', ignoreDuplicates: false }
        );
      if (marketError) throw marketError;

      const { error: txError } = await supabase.from('mm3_sell_transactions').insert({
        wallet,
        source: isVirtualWallet ? 'google' : 'wallet',
        level: liveLevel,
        mm3_amount: mode === 'buy' ? -liveTradeQuote.grossMm3 : liveTradeQuote.totalMm3,
        mm3_commission: liveTradeQuote.commissionMm3,
        rate_cny: liveTradeQuote.rateCny,
        gross_cny: mode === 'buy' ? -liveTradeQuote.grossCny : liveTradeQuote.grossCny,
        gross_eur: mode === 'buy' ? -liveTradeQuote.grossEur : liveTradeQuote.grossEur,
        gross_usd: mode === 'buy' ? -liveTradeQuote.grossUsd : liveTradeQuote.grossUsd,
        commission_rate: liveTradeQuote.commissionRate,
        commission_cny: liveTradeQuote.commissionCny,
        commission_eur: liveTradeQuote.commissionEur,
        commission_usd: liveTradeQuote.commissionUsd,
        net_cny: mode === 'buy' ? -liveTradeQuote.netCny : liveTradeQuote.netCny,
        net_eur: mode === 'buy' ? -liveTradeQuote.netEur : liveTradeQuote.netEur,
        net_usd: mode === 'buy' ? -liveTradeQuote.netUsd : liveTradeQuote.netUsd,
      });
      if (txError) throw txError;

      const tradeDelta = mode === 'buy'
        ? Number(liveTradeQuote.grossMm3 || 0)
        : -Number(liveTradeQuote.totalMm3 || 0);
      if (tradeDelta !== 0) {
        await supabase.from('mm3_mining_events').insert({
          wallet,
          event_type: mode === 'buy' ? 'mining_buy' : 'mining_resell',
          delta_mm3: tradeDelta,
          emoji: mode === 'buy' ? '📈' : '📉',
        }).catch(() => {});
      }

      pushToast(
        mode === 'buy'
          ? `${t('tradeBoard.buySuccess')} ${formatMoney(liveTradeQuote.grossEur, 'EUR')} / ${formatMoney(liveTradeQuote.grossUsd, 'USD')} / ${formatMoney(liveTradeQuote.grossCny, 'CNY')} -> ${fmtMm3(liveTradeQuote.netMm3)} MM3.`
          : `${t('tradeBoard.sellSuccess')} ${fmtMm3(liveTradeQuote.totalMm3)} MM3 -> ${formatMoney(liveTradeQuote.netEur, 'EUR')} / ${formatMoney(liveTradeQuote.netUsd, 'USD')} / ${formatMoney(liveTradeQuote.netCny, 'CNY')}.`,
        'success'
      );
      playTrade();

      // Nudge war/nature ±10% on every EXEC — written server-side to bypass RLS
      const nudge = (current) => {
        const delta = (Math.random() * 20) - 10;
        return Math.round(Math.max(0, Math.min(100, current + delta)) * 10) / 10;
      };
      const newWar = nudge(liveMacroState.war_percent);
      const newNature = nudge(liveMacroState.nature_percent);
      fetch('/api/nudge-macro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ war_percent: newWar, nature_percent: newNature }),
      }).then((r) => r.ok && setMacroState({ war_percent: newWar, nature_percent: newNature }))
        .catch(() => {});

      markLeaderboardDirty();
      await loadDailyTxCount(wallet);
      if (showTransactions) loadTransactions();
      window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet, trade: mode } }));
    } catch (error) {
      console.error('trade board transaction:', error);
      pushToast(error?.message || t('tradeBoard.tradeFailed'), 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className={`mm3-trade-board mx-auto w-full max-w-full md:max-w-4xl xl:max-w-6xl font-mono ${showTransactions ? 'mm3-trade-board-open' : 'mm3-trade-board-closed'}`}>
      {loading && <PageLoading label={t('tradeBoard.loading')} />}

      <div className="rounded-xl border border-cyan-500/10 bg-black/70 p-1">
          <style>{`
            .mm3-trade-board-closed .mm3-trade-toolbar {
              margin-bottom: 0.5rem;
            }
            .mm3-trade-board-closed .mm3-trade-stats,
            .mm3-trade-board-closed .mm3-trade-panel {
              margin-bottom: 0.5rem;
            }
            .mm3-trade-board-closed .mm3-trade-stat-card,
            .mm3-trade-board-closed .mm3-trade-slider,
            .mm3-trade-board-closed .mm3-trade-result-card {
              padding: 0.45rem;
            }
            .mm3-trade-board-closed .mm3-trade-value-primary {
              margin-top: 0.15rem;
              font-size: 1rem;
              line-height: 1.2;
            }
            .mm3-trade-board-closed .mm3-trade-value-secondary {
              margin-top: 0.15rem;
              font-size: 0.95rem;
              line-height: 1.2;
            }
            .mm3-trade-board-closed .mm3-trade-breakdown {
              margin-top: 0.35rem;
            }
          `}</style>
          <>
            <div className="mm3-trade-toolbar mb-3 flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="mm3-trade-mode-switch relative inline-grid grid-cols-2 rounded-full border bg-black/70 p-1"
                  style={{ borderColor: tier.glow }}
                >
                  <div
                    className="absolute top-1 bottom-1 w-[calc(50%-0.125rem)] rounded-full transition-transform duration-200"
                    style={{
                      background: tier.color,
                      transform: mode === 'buy' ? 'translateX(calc(100% + 0.25rem))' : 'translateX(0)',
                      opacity: 1,
                    }}
                  />
                  <button
                    onClick={() => setMode('sell')}
                    className="relative z-10 min-w-[76px] rounded-full px-3 py-1.5 text-[0.75rem] font-black uppercase tracking-[0.2em] transition"
                    style={{ color: mode === 'sell' ? '#050810' : canSell ? tier.color : `${tier.color}66` }}
                  >
                    {t('tradeBoard.sell')}
                  </button>
                  <button
                    onClick={() => setMode('buy')}
                    className="relative z-10 min-w-[76px] rounded-full px-3 py-1.5 text-[0.75rem] font-black uppercase tracking-[0.2em] transition"
                    style={{ color: mode === 'buy' ? '#050810' : canBuy ? tier.color : `${tier.color}66` }}
                  >
                    {t('tradeBoard.buy')}
                  </button>
                </div>
                <button
                  onClick={handleTrade}
                  disabled={loading || processing || !canTradeToday || (mode === 'buy' ? !canBuy : !canSell)}
                  className="mm3-trade-launch rounded-lg border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] transition disabled:opacity-50"
                  style={{ borderColor: tier.glow, color: tier.color }}
                  title={
                    loading
                      ? t('tradeBoard.loading')
                      : processing
                        ? (mode === 'buy' ? t('tradeBoard.buying') : t('tradeBoard.selling'))
                        : !canTradeToday
                          ? t('tradeBoard.dailyLimitButton')
                          : mode === 'buy'
                            ? canBuy
                              ? t('tradeBoard.launchBuy')
                              : t('tradeBoard.notEnoughFunds')
                            : canSell
                              ? t('tradeBoard.launchSell')
                              : t('tradeBoard.notEnoughMm3')
                  }
                >
                  {loading || processing ? '⟳ EXEC' : 'EXEC'}
                </button>
                <div className="flex items-center gap-2">
                  {TRADE_SLOT_ORDER.map((slot) => {
                    const owned = walletDecorations.includes(slot.emoji);
                    const isLife = slot.key === 'revive';
                    const slotLvl = Math.max(0, Number(nftjiLevels?.[slot.key] ?? 0) || 0);
                    const showLvl = owned && !isLife;
                    const borderColor = owned
                      ? (isLife ? 'rgba(251,113,133,0.6)' : tier.glow)
                      : (isLife ? 'rgba(251,113,133,0.22)' : 'rgba(148,163,184,0.22)');
                    return (
                      <div
                        key={slot.key}
                        title={`${getTradeSlotTitle(slot, level, language)}${showLvl ? ` | Lv.${slotLvl}` : ''}`}
                        className="mm3-trade-slot flex h-8 w-8 flex-col items-center justify-center rounded-md border"
                        style={{
                          borderColor,
                          background: owned ? tier.bg : 'rgba(2,6,23,0.4)',
                          color: owned ? tier.color : 'rgba(100,116,139,0.35)',
                          boxShadow: owned ? `0 0 12px ${tier.color}22` : 'none',
                        }}
                      >
                        <span style={{ fontSize: showLvl ? '0.82rem' : '1rem', lineHeight: 1 }}>{owned ? slot.emoji : ''}</span>
                        {showLvl && (
                          <span style={{
                            fontSize: '0.52rem',
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            lineHeight: 1,
                            color: tier.color,
                            textShadow: `0 0 3px ${tier.color}`,
                          }}>
                            {slotLvl}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <div
                    title={marketNftjiEmoji ? `Market NFTJI — ${marketNftjiEmoji}` : 'Market NFTJI — none'}
                    className="mm3-trade-slot flex h-8 w-8 items-center justify-center rounded-md border text-base"
                    style={{
                      borderColor: marketNftjiEmoji ? 'rgba(250,204,21,0.6)' : 'rgba(250,204,21,0.22)',
                      background: marketNftjiEmoji ? tier.bg : 'rgba(2,6,23,0.4)',
                      color: marketNftjiEmoji ? '#fef08a' : 'rgba(100,116,139,0.35)',
                      boxShadow: marketNftjiEmoji ? '0 0 12px rgba(250,204,21,0.25)' : 'none',
                    }}
                  >
                    {marketNftjiEmoji || ''}
                  </div>
                </div>
              </div>
              {account && (
                <div className="flex items-center gap-2">
                  <div
                    className="mm3-trade-limit rounded-lg border bg-black/70 px-3 py-2 text-[0.82rem] font-black uppercase tracking-[0.18em]"
                    style={{ borderColor: `${tier.glow}99`, color: canTradeToday ? tier.color : '#fca5a5' }}
                  >
                    #{visibleTxCount.toString(16).toUpperCase()}/#{DAILY_TX_LIMIT.toString(16).toUpperCase()}
                    {!canTradeToday ? (
                      <span className="ml-2 text-[0.76rem] text-amber-300">{t('tradeBoard.resetIn')} {resetCountdown}</span>
                    ) : null}
                  </div>
                  <button
                    onClick={() => {
                      setTransactionsPage(1);
                      setShowTransactions((open) => !open);
                    }}
                    className="mm3-trade-log-toggle rounded-lg border bg-black/70 px-4 py-2 text-[0.75rem] font-black uppercase tracking-[0.22em] transition"
                    style={{
                      borderColor: showTransactions ? tier.color : tier.glow,
                      color: showTransactions ? '#050810' : tier.color,
                      background: showTransactions ? tier.color : 'rgba(0,0,0,0.72)',
                      boxShadow: showTransactions ? `0 0 14px ${tier.color}33` : 'none',
                    }}
                  >
                    {t('tradeBoard.transactionsButton')}
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowStats((v) => !v)}
              className="mb-2 flex w-full items-center gap-2 rounded border bg-black/40 px-2.5 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.18em] transition hover:brightness-110"
              style={{ borderColor: `${tier.color}22`, color: `${tier.color}88` }}
            >
              <span className="font-black" style={{ color: tier.color }}>{fmtMm3(availableMm3)} MM3</span>
              <span style={{ color: `${tier.color}44` }}>·</span>
              <span>{formatMoney(currentFunds, currency)}</span>
              <span style={{ color: `${tier.color}44` }}>·</span>
              <span>{tier.emoji} {level}</span>
              <span className="ml-auto" style={{ color: `${tier.color}55` }}>{showStats ? '▲' : '▼'}</span>
            </button>
            {showStats && (
              <div className="mm3-trade-stats mb-3 grid gap-2 sm:grid-cols-4">
                {[
                { label: t('tradeBoard.mm3Balance'), value: fmtMm3(availableMm3) },
                { label: t('tradeBoard.availableFunds'), value: formatMoney(currentFunds, currency) },
                { label: t('tradeBoard.levelRank'), value: `${level} (${tier.emoji} ${tier.label})` },
                { label: t('tradeBoard.rate'), value: `${formatMoney(activeRate, currency)} / MM3` },
                ].map((item) => (
                  <div key={item.label} className="mm3-trade-stat-card rounded-lg border bg-black/70 p-2" style={{ borderColor: tier.glow }}>
                    <div className="mm3-trade-stat-label text-[0.76rem] uppercase tracking-[0.22em]" style={{ color: `${tier.color}99` }}>{item.label}</div>
                    <div className="mm3-trade-stat-value mt-0.5 text-sm font-black" style={{ color: tier.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mm3-trade-panel mb-3 rounded-lg border bg-black/65 p-3" style={{ borderColor: tier.glow }}>
              <div className="mm3-trade-slider mb-3 rounded-lg border border-cyan-500/20 bg-black/50 p-2.5">
                <div className="mm3-trade-slider-header mb-2 flex items-center justify-between gap-3 text-[0.82rem] uppercase tracking-[0.22em]" style={{ color: `${tier.color}AA` }}>
                  <span>{t('tradeBoard.tradeAmount')}</span>
                  <span style={{ color: tier.color }}>
                    {mode === 'buy' ? formatMoney(selectedBuyFunds, currency) : `${fmtMm3(selectedSellMm3)} MM3`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={SLIDER_STEPS}
                  step="1"
                  value={tradeRatio}
                  disabled={sliderDisabled}
                  onChange={(event) => setTradeRatio(Number(event.target.value))}
                  className="w-full accent-cyan-400 disabled:opacity-40"
                  aria-label={t('tradeBoard.tradeAmount')}
                />
                <div className="mm3-trade-slider-ends mt-2 flex items-center justify-between text-[0.75rem] text-slate-500">
                  <span>{mode === 'buy' ? formatMoney(minBuyFunds, currency) : `${fmtMm3(minSellMm3)} MM3`}</span>
                  <span>{mode === 'buy' ? formatMoney(maxBuyFunds, currency) : `${fmtMm3(maxSellMm3)} MM3`}</span>
                </div>
                {mode === 'buy' && !canBuy ? (
                  <div className="mm3-trade-minimum mt-2 text-[0.75rem] uppercase tracking-[0.18em] text-amber-300/80">
                    {t('tradeBoard.minimumNeeded')}: {formatMoney(minBuyFunds, currency)}
                  </div>
                ) : mode === 'sell' && !canSell ? (
                  <div className="mm3-trade-minimum mt-2 text-[0.75rem] uppercase tracking-[0.18em] text-amber-300/80">
                    {t('tradeBoard.minimumNeeded')}: {fmtMm3(MIN_TRADE_MM3)} MM3
                  </div>
                ) : null}
              </div>

              <div className="mm3-trade-results grid gap-2 sm:grid-cols-2">
                <div className="mm3-trade-result-card rounded-lg border p-2.5" style={{ borderColor: tier.glow, background: tier.bg }}>
              <div className="mm3-trade-result-label text-[0.82rem] uppercase tracking-[0.22em]" style={{ color: `${tier.color}AA` }}>{t('tradeBoard.youReceive')}</div>
                  <div className="mm3-trade-value-primary mt-1 text-xl font-black" style={{ color: tier.color }}>
                    {mode === 'buy' ? `${fmtMm3(activeQuote.netMm3)} MM3` : formatMoney(activeQuote[quoteField('net', currency)] || 0, currency)}
                  </div>
                  <div className="mm3-trade-breakdown mt-2 text-[0.82rem] leading-relaxed text-cyan-200/70">
                    {t('tradeBoard.receiveBase')}{' '}
                    <span className="text-cyan-200">
                      {mode === 'buy' ? `${fmtMm3(receiveBaseAmount)} MM3` : formatMoney(receiveBaseAmount, currency)}
                    </span>
                    {' | '}
                    {t('tradeBoard.receiveNft')}{' '}
                    <span className="text-cyan-200">x{boostBreakdown.nftMultiplier.toFixed(3)}</span>
                    {' | '}
                    {t('tradeBoard.receiveLevel')}{' '}
                    <span className="text-cyan-200">x{boostBreakdown.levelMultiplier.toFixed(3)}</span>
                    {' | '}
                    {t('tradeBoard.receiveBonus')}{' '}
                    <span className="text-cyan-200">
                      {mode === 'buy' ? `${fmtMm3(receiveBonusAmount)} MM3` : formatMoney(receiveBonusAmount, currency)}
                    </span>
                  </div>
                </div>
                <div className="mm3-trade-result-card rounded-lg border border-amber-300/20 bg-amber-500/5 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="mm3-trade-commission-label text-[0.82rem] uppercase tracking-[0.22em] text-amber-200/60">{t('tradeBoard.commission')}</div>
                    {diceState?.active && (
                      <div
                        className="flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[0.75rem] font-black"
                        style={{ borderColor: `${diceState.color}60`, color: diceState.color }}
                        title={
                          language === 'es'
                            ? `🎲 dado activo :: comision ${diceState.modifier >= 0 ? '+' : ''}${Math.round(diceState.modifier * 100)}%`
                            : `🎲 active die :: commission ${diceState.modifier >= 0 ? '+' : ''}${Math.round(diceState.modifier * 100)}%`
                        }
                      >
                        <span>🎲</span>
                        <span>{diceState.modifier >= 0 ? '+' : ''}{Math.round(diceState.modifier * 100)}%</span>
                      </div>
                    )}
                  </div>
                  <div className="mm3-trade-value-secondary mt-1 text-lg font-black text-amber-300">
                    {formatMoney(activeQuote[quoteField('commission', currency)] || 0, currency)}
                  </div>
                  <div className="mm3-trade-commission-subtext mt-1 text-xs text-amber-100/70">
                    {fmtMm3(activeQuote.commissionMm3)} MM3 ({(activeQuote.commissionRate * 100).toFixed(2)}%)
                  </div>
                </div>
              </div>
            </div>

            {account && showTransactions && (
              <div ref={ledgerRef} className="mm3-trade-log mt-4 rounded-lg border bg-black/70 p-4" style={{ borderColor: tier.glow }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[0.82rem] uppercase tracking-[0.28em]" style={{ color: `${tier.color}AA` }}>
                      {t('tradeBoard.transactionsTitle')}
                    </div>
                    <div className="mt-1 text-[0.75rem] text-slate-500">
                      {t('tradeBoard.transactionsSubtitle')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[0.82rem] uppercase tracking-[0.18em] text-slate-500">
                      {transactionsTotal > 0 ? `${transactionsPage}/${totalPages}` : `1/1`}
                    </div>
                    <button
                      onClick={loadTransactions}
                      disabled={transactionsLoading}
                      className="rounded-md border px-3 py-1.5 text-[0.82rem] font-black uppercase tracking-[0.18em] disabled:opacity-50"
                      style={{ borderColor: tier.glow, color: tier.color }}
                    >
                      {transactionsLoading ? t('tradeBoard.loading') : t('tradeBoard.refresh')}
                    </button>
                  </div>
                </div>

                {transactionsLoading && transactions.length === 0 ? (
                  <div className="rounded-lg border border-cyan-500/15 bg-slate-950/60 p-3 text-center text-xs text-cyan-200/70">
                    {t('tradeBoard.loading')}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="rounded-lg border border-cyan-500/15 bg-slate-950/60 p-3 text-center text-xs text-slate-500">
                    {t('tradeBoard.noTransactions')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => {
                      const isBuy = Number(tx.mm3_amount) < 0;
                      const txColor = isBuy ? '#22d3ee' : '#4ade80';
                      const tradedMm3 = Math.abs(Number(tx.mm3_amount) || 0);
                      const commissionMm3 = Math.abs(Number(tx.mm3_commission) || 0);
                      const netMm3 = isBuy ? Math.max(0, tradedMm3 - commissionMm3) : tradedMm3;
                      const money = txMoneyBreakdown(tx, currency);

                      return (
                        <div key={tx.id} className="rounded-lg border bg-slate-950/60 p-3" style={{ borderColor: `${txColor}45` }}>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded border px-2 py-1 text-[0.82rem] font-black uppercase tracking-[0.18em]" style={{ borderColor: txColor, color: txColor }}>
                                {isBuy ? t('tradeBoard.txBuy') : t('tradeBoard.txSell')}
                              </span>
                              <span className="text-[0.75rem] text-slate-500">{formatTxTime(tx.created_at)}</span>
                            </div>
                            <span className="text-[0.82rem] uppercase tracking-[0.16em] text-slate-500">
                              {t('tradeBoard.txLevel')} {tx.level} · {tx.source === 'google' ? 'G' : 'W'}
                            </span>
                          </div>
                          <div className="grid gap-2 text-[0.88rem] sm:grid-cols-4">
                            <div>
                              <div className="uppercase tracking-[0.18em] text-slate-600">{isBuy ? t('tradeBoard.txReceived') : t('tradeBoard.txSold')}</div>
                              <div className="font-black" style={{ color: txColor }}>{fmtMm3(isBuy ? netMm3 : tradedMm3)} MM3</div>
                            </div>
                            <div>
                              <div className="uppercase tracking-[0.18em] text-slate-600">{isBuy ? t('tradeBoard.txPaid') : t('tradeBoard.txReceived')}</div>
                              <div className="font-black text-cyan-200">{formatMoney(isBuy ? money.gross : money.net, currency)}</div>
                            </div>
                            <div>
                              <div className="uppercase tracking-[0.18em] text-slate-600">{t('tradeBoard.txCommission')}</div>
                              <div className="font-black text-amber-300">
                                {formatMoney(money.commission, currency)}
                              </div>
                              <div className="text-[0.82rem] text-amber-100/60">{fmtMm3(commissionMm3)} MM3 · {(Number(tx.commission_rate || 0) * 100).toFixed(2)}%</div>
                            </div>
                            <div>
                              <div className="uppercase tracking-[0.18em] text-slate-600">{t('tradeBoard.txRate')}</div>
                              <div className="font-black text-slate-300">{formatMoney(money.rate || activeRate, currency)} / MM3</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-500/15 bg-slate-950/60 p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTransactionsPage((page) => Math.max(1, page - 1))}
                          disabled={transactionsPage <= 1}
                          className="rounded-md border px-3 py-1.5 text-[0.82rem] font-black uppercase tracking-[0.18em] disabled:opacity-40"
                          style={{ borderColor: tier.glow, color: tier.color }}
                        >
                          {t('tradeBoard.prevPage')}
                        </button>
                        <button
                          onClick={() => setTransactionsPage((page) => Math.min(totalPages, page + 1))}
                          disabled={transactionsPage >= totalPages}
                          className="rounded-md border px-3 py-1.5 text-[0.82rem] font-black uppercase tracking-[0.18em] disabled:opacity-40"
                          style={{ borderColor: tier.glow, color: tier.color }}
                        >
                          {t('tradeBoard.nextPage')}
                        </button>
                      </div>
                      <button
                        onClick={() => setShowTransactions(false)}
                        className="rounded-md border px-3 py-1.5 text-[0.82rem] font-black uppercase tracking-[0.18em]"
                        style={{ borderColor: 'rgba(34,211,238,.35)', color: '#94a3b8' }}
                      >
                        {t('tradeBoard.closeLog')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
      </>
      </div>
    </div>
  );
}
