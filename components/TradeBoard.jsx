'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { BUY_RATE_PREMIUM, CNY_TO_EUR, CNY_TO_USD, getBuyQuote, getSellQuote, formatMoney, getRateByCurrency } from '@/lib/sell-offer';
import { useI18n } from '@/lib/i18n-context';
import { useCurrency } from '@/lib/currency-context';
import { normalizeMacroState } from '@/lib/mm3-macro';
import { getRankTier } from '@/lib/ranks';
import { TRADE_SLOT_ORDER, SQUEEZE_SLOT_ORDER, WALLET_DECORATIONS, TRADING_NFTJI, LIFE_NFTJI_ACCENT, lifeNftjiEmojiFilterStyle, getEmojiTitle, computeRelayLevel, getWalletTradeMultiplier, normalizeWalletDecorations, appendWalletDecoration } from '@/lib/wallet-decorations';
import { useDice } from '@/lib/dice-context';
import { getDiceState } from '@/lib/dice';
import { useSound } from '@/lib/sound-context';
import { apiFetch, ensureWalletSession } from '@/lib/wallet-session-client';
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

function getTradeSlotImpact(slot, nftjiLevel = 0) {
  if (slot.key === 'revive') return { label: 'FEE 0%', multiplier: slot.multiplier };
  const safeNftjiLevel = Math.max(0, Number(nftjiLevel) || 0);
  const multiplier = slot.multiplier * (1 + safeNftjiLevel * 0.05);
  const impactPct = (multiplier - 1) * 100;
  const precision = Math.abs(impactPct) < 10 ? 1 : 0;
  return { label: `OUT +${impactPct.toFixed(precision)}%`, multiplier };
}

function getTradeSlotTitle(slot, level, nftjiLevel, language) {
  const safeLevel = Math.max(0, Math.min(100, Number(level) || 0));
  const levelMultiplier = 1 + safeLevel * 0.001;
  const levelPct = (safeLevel * 0.1).toFixed(1);
  const impact = getTradeSlotImpact(slot, nftjiLevel);

  if (language === 'es') {
    return `${slot.emoji} salida x${impact.multiplier.toFixed(3)} | nivel NFTJI ${Math.max(0, Number(nftjiLevel) || 0)} | nivel wallet x${levelMultiplier.toFixed(3)} (+${levelPct}%)${slot.key === 'revive' ? ' | comisión 0%' : ''}`;
  }

  return `${slot.emoji} output x${impact.multiplier.toFixed(3)} | NFTJI level ${Math.max(0, Number(nftjiLevel) || 0)} | wallet level x${levelMultiplier.toFixed(3)} (+${levelPct}%)${slot.key === 'revive' ? ' | zero commission' : ''}`;
}

function getTradeBoostBreakdown(value, level = 0, nftjiLevels = {}) {
  const safeLevel = Math.max(0, Math.min(100, Number(level) || 0));
  const levelMultiplier = 1 + safeLevel * 0.001;
  const totalMultiplier = getWalletTradeMultiplier(value, safeLevel, nftjiLevels);
  return {
    nftMultiplier: levelMultiplier > 0 ? totalMultiplier / levelMultiplier : 1,
    levelMultiplier,
    totalMultiplier,
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
  const { playTrade, playNftDrop } = useSound();
  const [level, setLevel] = useState(0);
  const [availableMm3, setAvailableMm3] = useState(0);
  const [funds, setFunds] = useState({ cny: 0, eur: 0, usd: 0 });
  const [mode, setMode] = useState('sell');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [walletDecorations, setWalletDecorations] = useState([]);
  const [nftjiLevels, setNftjiLevels] = useState({});
  const [marketNftji, setMarketNftji] = useState(null);
  const [squeezeNftji, setSqueezeNftji] = useState(null);
  const [relayExecCount, setRelayExecCount] = useState(0);
  const [zeroDayLevel, setZeroDayLevel] = useState(-1);
  // Pending Zero-Day 👾 drop after an EXEC — claimed like a training drop
  const [zeroDayOffer, setZeroDayOffer] = useState(false);
  const [claimingZeroDay, setClaimingZeroDay] = useState(false);
  const [macroState, setMacroState] = useState(() => normalizeMacroState());
  const [tradeRatio, setTradeRatio] = useState(100);
  const [showTransactions, setShowTransactions] = useState(false);
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
        const response = await fetch('/api/portal-status');
        const data = await response.json();
        setMacroState(normalizeMacroState(data?.macro));
      } catch {}
    };

    loadMacro();
    const timer = setInterval(() => { if (!document.hidden) loadMacro(); }, 120_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!account) {
      setLevel(0);
      setAvailableMm3(0);
      setFunds({ cny: 0, eur: 0, usd: 0 });
      setWalletDecorations([]);
      setNftjiLevels({});
      setMarketNftji(null);
      setSqueezeNftji(null);
      setRelayExecCount(0);
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
    setMarketNftji(null);
    setSqueezeNftji(null);
    setRelayExecCount(0);
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
        const [{ data: progress }, { data: stats }, { data: marketBlockRows }, { data: sqData }] = await Promise.all([
          supabase
            .from('player_progress')
            .select('level, mm3_sold, cny_earned, eur_earned, usd_earned, wallet_emojis, mining_nftji_key, mining_nftji_levels, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level, zero_day_level, relay_exec_count')
            .eq('wallet', wallet)
            .maybeSingle(),
          supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
          supabase.from('mm3_mining_blocks').select('block_key, emoji'),
          supabase.from('mm3_squeezing_nftji').select('equipped, attack_level, defense_level').eq('wallet', wallet).maybeSingle(),
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
        setMarketNftji(nftjiKey ? {
          key: nftjiKey,
          emoji: blockEmojiMap.get(nftjiKey) || '⬡',
          level: Math.max(0, Number(progress?.mining_nftji_levels?.[nftjiKey] ?? 0)),
        } : null);
        setSqueezeNftji(sqData || null);
        setRelayExecCount(Number(progress?.relay_exec_count) || 0);
        setZeroDayLevel(Number(progress?.zero_day_level ?? -1));
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
    }
  }, [showTransactions, account, transactionsPage]);

  // Bring TX.LOG into view (native WebView often ignores a single early scrollIntoView).
  useEffect(() => {
    if (!showTransactions || !ledgerRef.current) return undefined;
    const scrollLedgerIntoView = () => {
      const el = ledgerRef.current;
      if (!el || typeof window === 'undefined') return;
      try {
        el.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
      } catch {
        /* ignore */
      }
      try {
        const docTop = window.pageYOffset
          || document.documentElement.scrollTop
          || document.body.scrollTop
          || 0;
        const y = Math.max(0, el.getBoundingClientRect().top + docTop - 10);
        window.scrollTo(0, y);
        document.documentElement.scrollTop = y;
        document.body.scrollTop = y;
      } catch {
        /* ignore */
      }
    };
    const t0 = window.setTimeout(scrollLedgerIntoView, 40);
    const t1 = window.setTimeout(scrollLedgerIntoView, 220);
    const t2 = window.setTimeout(scrollLedgerIntoView, 600);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [showTransactions, transactionsLoading, transactions.length, transactionsPage]);

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
    () => getTradeBoostBreakdown(walletDecorations, level, nftjiLevels),
    [walletDecorations, level, nftjiLevels]
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
      try {
        await ensureWalletSession(wallet, { isVirtualWallet });
      } catch (err) {
        const code = err?.message || '';
        if (code === 'google_session_required') {
          pushToast('Sesión Google caducada — vuelve a entrar con Google y reintenta EXEC', 'error');
        } else if (code === 'nonce_failed' || code === 'session_failed') {
          pushToast('Session sign-in failed — try reconnecting the wallet', 'error');
        } else {
          pushToast('Sign the login message in your wallet to trade', 'error');
        }
        return;
      }
      const liveDailyCount = await loadDailyTxCount(wallet);
      if (liveDailyCount >= DAILY_TX_LIMIT) {
        pushToast(`${t('tradeBoard.dailyLimitReached')} ${t('tradeBoard.resetIn')} ${resetCountdown}`, 'error');
        return;
      }

      // The server re-derives the whole trade (level/funds/decorations/macro/
      // dice/commission) from its own DB reads using the same getBuyQuote /
      // getSellQuote math — we only tell it what we want to do. See 2026-07
      // security audit phase 3: this used to compute the trade client-side
      // and write player_progress/mm3_mining_state/mm3_sell_transactions
      // directly, which let a hand-crafted request set its own balance.
      const requestedAmount = mode === 'buy' ? selectedBuyFunds : selectedSellMm3;
      const execRes = await apiFetch('/api/trade/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          currency,
          amount: requestedAmount,
          source: isVirtualWallet ? 'google' : 'wallet',
        }),
      }, wallet);
      const execData = await execRes.json().catch(() => ({}));
      if (!execRes.ok || !execData.ok) {
        if (execData.error === 'unauthorized') {
          pushToast('Session expired — sign the wallet message (or reconnect) and retry EXEC', 'error');
          return;
        }
        if (execData.error === 'amount_too_small' || execData.error === 'insufficient_funds') {
          pushToast(mode === 'sell' ? t('tradeBoard.insufficientMm3Error') : t('tradeBoard.insufficientFundsError'), 'error');
          return;
        }
        throw new Error(execData.error || 'trade exec failed');
      }
      const liveTradeQuote = execData.quote;

      pushToast(
        mode === 'buy'
          ? `${t('tradeBoard.buySuccess')} ${formatMoney(liveTradeQuote.grossEur, 'EUR')} / ${formatMoney(liveTradeQuote.grossUsd, 'USD')} / ${formatMoney(liveTradeQuote.grossCny, 'CNY')} -> ${fmtMm3(liveTradeQuote.netMm3)} MM3.`
          : `${t('tradeBoard.sellSuccess')} ${fmtMm3(liveTradeQuote.totalMm3)} MM3 -> ${formatMoney(liveTradeQuote.netEur, 'EUR')} / ${formatMoney(liveTradeQuote.netUsd, 'USD')} / ${formatMoney(liveTradeQuote.netCny, 'CNY')}.`,
        'success'
      );
      playTrade();

      // Zero-Day 👾 — 5% drop per EXEC, claimed like a training drop.
      // Re-drops level it up, so the roll never stops firing once owned.
      if (Math.random() < TRADING_NFTJI.dropChance) {
        setZeroDayOffer(true);
        playNftDrop();
      }

      // Nudge war/nature ±10% on every EXEC. The server computes the actual
      // delta from its own current row (never trusts a client-sent value —
      // see 2026-07 security audit), so we just reflect back whatever it
      // decides.
      apiFetch('/api/nudge-macro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      }, wallet).then((r) => r.json().catch(() => null).then((data) => {
        if (r.ok && data?.ok) {
          setMacroState({ war_percent: data.war_percent, nature_percent: data.nature_percent });
        }
      })).catch(() => {});

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

  // Claim the pending Zero-Day 👾 drop — same persistence pattern as the
  // training drops: append to wallet_emojis + bump its level field.
  const claimZeroDay = async () => {
    if (!account || !zeroDayOffer || claimingZeroDay) return;
    setClaimingZeroDay(true);
    try {
      const wallet = account.toLowerCase();
      const res = await apiFetch('/api/trade/zero-day-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, wallet);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'zero_day_claim_failed');
      }
      const data = await res.json();
      const nextDecorations = data.wallet_emojis || appendWalletDecoration(walletDecorations, TRADING_NFTJI.emoji);
      const nextLevel = Number(data.zero_day_level ?? zeroDayLevel + 1);
      setWalletDecorations(nextDecorations);
      setZeroDayLevel(nextLevel);
      setZeroDayOffer(false);
      pushToast(`👾 ZERO-DAY Lv${nextLevel} — HACKING unlocked in Mining`, 'success');
      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_dirty_at', String(Date.now()));
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet, special: true } }));
      }
    } catch (error) {
      console.error('zero-day claim:', error);
      pushToast(error?.message || t('tradeBoard.tradeFailed'), 'error');
    } finally {
      setClaimingZeroDay(false);
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
            /* Compact NFTJI tiles: less chrome padding, same emoji / skill / Lv sizes */
            .mm3-trade-arsenal {
              padding: 0.35rem 0.4rem !important;
            }
            .mm3-trade-arsenal > div:first-child {
              margin-bottom: 0.35rem !important;
            }
            .mm3-trade-arsenal .mm3-trade-arsenal-grid,
            .mm3-trade-arsenal .grid {
              gap: 0.28rem !important;
              width: 100% !important;
              max-width: 100% !important;
              justify-content: center !important;
            }
            .mm3-trade-slot {
              width: 2.45rem !important;
              height: 46px !important;
              min-height: 46px !important;
              padding: 0 !important;
              gap: 0 !important;
              border-radius: 0.3rem !important;
            }
            .mm3-trade-slot .mm3-trade-slot-skill {
              padding-top: 1px !important;
              padding-bottom: 1px !important;
              font-size: 0.42rem !important;
              line-height: 1 !important;
            }
            .mm3-trade-slot .mm3-trade-slot-emoji {
              margin-top: 2px !important;
              font-size: 1.05rem !important;
              line-height: 1 !important;
            }
            .mm3-trade-slot .mm3-trade-slot-lvl {
              margin-top: 0 !important;
              font-size: 0.52rem !important;
              line-height: 1 !important;
            }
          `}</style>
          <>
            <div className="mm3-trade-toolbar mb-3 flex flex-col items-stretch gap-2.5">
              {/* Row 1 — mode + EXEC */}
              <div className="flex flex-wrap items-center justify-center gap-2">
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
              </div>

              {zeroDayOffer && (
                <div
                  className="mx-auto flex w-full max-w-md flex-col items-center gap-2 rounded-lg border p-3 text-center"
                  style={{ borderColor: '#a78bfaaa', background: 'rgba(24,10,38,0.85)', boxShadow: '0 0 16px rgba(167,139,250,0.25)' }}
                >
                  <div className="text-xs leading-relaxed text-slate-300">
                    {language === 'es'
                      ? '👾 ZERO-DAY detectado en el EXEC — NFTJI de trading · skill HACKING en Mining (10% por golpe → OFFLINE 5s)'
                      : '👾 ZERO-DAY detected on EXEC — trading NFTJI · Mining HACKING skill (10% per hit → OFFLINE 5s)'}
                  </div>
                  <button
                    onClick={claimZeroDay}
                    disabled={claimingZeroDay}
                    aria-label="Claim Zero-Day NFTJI"
                    className="min-w-14 rounded-lg border-2 px-4 py-2.5 font-mono text-2xl leading-none transition-all duration-200 disabled:opacity-40"
                    style={{ borderColor: '#a78bfaaa', color: '#a78bfa', background: 'transparent' }}
                  >
                    {claimingZeroDay ? '⟳' : '👾'}
                  </button>
                </div>
              )}

              {/* Row 2 — NFTJI arsenal (fixed grid, centered) */}
              <div
                className="mm3-trade-arsenal mx-auto w-full rounded-lg border bg-black/55 px-2 py-2"
                style={{ borderColor: `${tier.glow}55` }}
              >
                <div
                  className="mb-1.5 text-center text-[0.58rem] font-black uppercase tracking-[0.22em]"
                  style={{ color: `${tier.color}99` }}
                >
                  NFTJI
                </div>
                <div className="mm3-trade-arsenal-grid mx-auto grid w-full grid-cols-7 gap-1 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-11 justify-items-center">
                  {TRADE_SLOT_ORDER.map((slot) => {
                    const owned = walletDecorations.includes(slot.emoji);
                    const isLife = slot.key === 'revive';
                    const slotLvl = Math.max(0, Number(nftjiLevels?.[slot.key] ?? 0) || 0);
                    const showLvl = owned && !isLife;
                    const ability = getTradeSlotImpact(slot, slotLvl);
                    const borderColor = owned
                      ? (isLife ? 'rgba(56,189,248,0.6)' : tier.glow)
                      : (isLife ? 'rgba(56,189,248,0.22)' : 'rgba(148,163,184,0.22)');
                    return (
                      <div
                        key={slot.key}
                        title={getTradeSlotTitle(slot, level, slotLvl, language)}
                        className="mm3-trade-slot relative flex h-[46px] w-[2.45rem] flex-col items-center justify-center overflow-hidden rounded-md border"
                        style={{
                          borderColor,
                          background: owned ? (isLife ? '#100b18' : tier.bg) : 'rgba(2,6,23,0.4)',
                          color: owned ? tier.color : 'rgba(100,116,139,0.35)',
                          boxShadow: owned ? `0 0 12px ${tier.color}22` : 'none',
                        }}
                      >
                        {owned && (
                          <span
                            className="mm3-trade-slot-skill absolute inset-x-0 top-0 px-px py-px text-center text-[0.42rem] font-black leading-none tracking-tight text-[#02060b]"
                            style={{ background: isLife ? LIFE_NFTJI_ACCENT : tier.color }}
                          >
                            {ability.label}
                          </span>
                        )}
                        <span
                          className="mm3-trade-slot-emoji"
                          style={{
                          fontSize: '1.05rem',
                          lineHeight: 1,
                          marginTop: owned ? 2 : 0,
                          ...lifeNftjiEmojiFilterStyle(slot.emoji),
                        }}>{owned ? slot.emoji : ''}</span>
                        {owned && (
                          <span
                            className="mm3-trade-slot-lvl"
                            style={{
                            fontSize: '0.52rem',
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            lineHeight: 1,
                            color: tier.color,
                            textShadow: `0 0 3px ${tier.color}`,
                          }}>
                            {showLvl ? `Lv${slotLvl}` : `×${ability.multiplier.toFixed(2)}`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {/* Genesis Uplink 🛰 and Relay Link 🔁 — from wallet_emojis */}
                  {[WALLET_DECORATIONS.marketGenesis, WALLET_DECORATIONS.relay].map((emoji) => {
                    const owned = walletDecorations.includes(emoji);
                    const isRelay = emoji === WALLET_DECORATIONS.relay;
                    const relayLvl = isRelay && owned ? computeRelayLevel(relayExecCount, 0) : null;
                    return (
                      <div
                        key={emoji}
                        title={getEmojiTitle(emoji) + (relayLvl != null ? ` | Lv.${relayLvl}` : '')}
                        className="mm3-trade-slot flex h-[46px] w-[2.45rem] flex-col items-center justify-center rounded-md border"
                        style={{
                          borderColor: owned ? tier.glow : 'rgba(148,163,184,0.22)',
                          background: owned ? tier.bg : 'rgba(2,6,23,0.4)',
                          color: owned ? tier.color : 'rgba(100,116,139,0.35)',
                          boxShadow: owned ? `0 0 12px ${tier.color}22` : 'none',
                        }}
                      >
                        <span style={{ fontSize: relayLvl != null ? '1rem' : '1.05rem', lineHeight: 1 }}>{owned ? emoji : ''}</span>
                        {relayLvl != null && (
                          <span style={{ fontSize: '0.52rem', fontFamily: 'monospace', fontWeight: 800, lineHeight: 1, color: tier.color, textShadow: `0 0 3px ${tier.color}` }}>
                            Lv{relayLvl}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {/* Squeeze NFTJIs 🔰⚔️ — from mm3_squeezing_nftji */}
                  {SQUEEZE_SLOT_ORDER.map((slot) => {
                    const lvl = slot.key === 'sq-atk'
                      ? (squeezeNftji?.equipped === 'attack' ? Number(squeezeNftji?.attack_level ?? -1) : -1)
                      : (squeezeNftji?.equipped === 'defense' ? Number(squeezeNftji?.defense_level ?? -1) : -1);
                    const owned = lvl >= 0;
                    return (
                      <div
                        key={slot.key}
                        title={getEmojiTitle(slot.emoji) + (owned ? ` | Lv.${lvl}` : '')}
                        className="mm3-trade-slot flex h-[46px] w-[2.45rem] flex-col items-center justify-center rounded-md border"
                        style={{
                          borderColor: owned ? tier.glow : 'rgba(148,163,184,0.22)',
                          background: owned ? tier.bg : 'rgba(2,6,23,0.4)',
                          color: owned ? tier.color : 'rgba(100,116,139,0.35)',
                          boxShadow: owned ? `0 0 12px ${tier.color}22` : 'none',
                        }}
                      >
                        <span style={{ fontSize: '0.82rem', lineHeight: 1 }}>{owned ? slot.emoji : ''}</span>
                        {owned && (
                          <span style={{ fontSize: '0.52rem', fontFamily: 'monospace', fontWeight: 800, lineHeight: 1, color: tier.color, textShadow: `0 0 3px ${tier.color}` }}>
                            Lv{lvl}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {/* Trading NFTJI 👾 (Zero-Day) — between training and mining */}
                  {(() => {
                    const owned = walletDecorations.includes(TRADING_NFTJI.emoji);
                    const lvl = Math.max(0, zeroDayLevel);
                    return (
                      <div
                        title={getEmojiTitle(TRADING_NFTJI.emoji) + (owned ? ` | Lv.${lvl}` : ' — none')}
                        className="mm3-trade-slot flex h-[46px] w-[2.45rem] flex-col items-center justify-center rounded-md border"
                        style={{
                          borderColor: owned ? 'rgba(167,139,250,0.6)' : 'rgba(167,139,250,0.22)',
                          background: owned ? tier.bg : 'rgba(2,6,23,0.4)',
                          color: owned ? '#c4b5fd' : 'rgba(100,116,139,0.35)',
                          boxShadow: owned ? '0 0 12px rgba(167,139,250,0.25)' : 'none',
                        }}
                      >
                        <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{owned ? TRADING_NFTJI.emoji : ''}</span>
                        {owned && (
                          <span style={{ fontSize: '0.52rem', fontFamily: 'monospace', fontWeight: 800, lineHeight: 1, color: '#c4b5fd', textShadow: '0 0 3px #a78bfa' }}>
                            Lv{lvl}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {/* Mining NFTJI — block emoji */}
                  <div
                    title={marketNftji ? `Mining NFTJI — ${marketNftji.emoji} | ${marketNftji.key} | Lv.${marketNftji.level}` : 'Mining NFTJI — none'}
                    className="mm3-trade-slot flex h-[46px] w-[2.45rem] flex-col items-center justify-center rounded-md border"
                    style={{
                      borderColor: marketNftji ? 'rgba(250,204,21,0.6)' : 'rgba(250,204,21,0.22)',
                      background: marketNftji ? tier.bg : 'rgba(2,6,23,0.4)',
                      color: marketNftji ? '#fef08a' : 'rgba(100,116,139,0.35)',
                      boxShadow: marketNftji ? '0 0 12px rgba(250,204,21,0.25)' : 'none',
                    }}
                  >
                    <span className="text-[1.05rem] leading-none">{marketNftji?.emoji || ''}</span>
                    {marketNftji && <span className="mt-0.5 text-[0.52rem] font-black leading-none text-yellow-200">Lv{marketNftji.level}</span>}
                  </div>
                </div>
              </div>

              {/* Row 3 — daily rolls + TX.LOG + RATE (one bar) */}
              <div
                className="mm3-trade-meta mx-auto flex w-full max-w-lg flex-wrap items-stretch justify-center gap-2"
              >
                {account && (
                  <div
                    className="mm3-trade-limit flex min-w-[5.5rem] flex-1 items-center justify-center rounded-lg border bg-black/70 px-3 py-2 text-center text-[0.82rem] font-black uppercase tracking-[0.18em]"
                    style={{ borderColor: `${tier.glow}99`, color: canTradeToday ? tier.color : '#fca5a5' }}
                  >
                    <span>
                      #{visibleTxCount.toString(16).toUpperCase()}/#{DAILY_TX_LIMIT.toString(16).toUpperCase()}
                      {!canTradeToday ? (
                        <span className="mt-0.5 block text-[0.65rem] normal-case tracking-normal text-amber-300">
                          {t('tradeBoard.resetIn')} {resetCountdown}
                        </span>
                      ) : null}
                    </span>
                  </div>
                )}
                {account && (
                  <button
                    onClick={() => {
                      setTransactionsPage(1);
                      setShowTransactions((open) => !open);
                    }}
                    className="mm3-trade-log-toggle flex min-w-[5.5rem] flex-1 items-center justify-center rounded-lg border bg-black/70 px-3 py-2 text-[0.75rem] font-black uppercase tracking-[0.22em] transition"
                    style={{
                      borderColor: showTransactions ? tier.color : tier.glow,
                      color: showTransactions ? '#050810' : tier.color,
                      background: showTransactions ? tier.color : 'rgba(0,0,0,0.72)',
                      boxShadow: showTransactions ? `0 0 14px ${tier.color}33` : 'none',
                    }}
                  >
                    {t('tradeBoard.transactionsButton')}
                  </button>
                )}
                <div
                  className="mm3-trade-rate flex min-w-[8rem] flex-[1.4] flex-col items-center justify-center rounded-lg border bg-black/70 px-3 py-1.5"
                  style={{
                    borderColor: `${tier.color}55`,
                    boxShadow: `0 0 14px ${tier.color}12`,
                  }}
                >
                  <div
                    className="text-[0.55rem] font-mono uppercase tracking-[0.18em] leading-none"
                    style={{ color: `${tier.color}aa` }}
                  >
                    {t('tradeBoard.rate')}
                  </div>
                  <div
                    className="mt-0.5 text-[0.95rem] font-black font-mono leading-none"
                    style={{ color: tier.color }}
                  >
                    {formatMoney(activeRate, currency)} / MM3
                  </div>
                </div>
              </div>
            </div>

            {/* TX.LOG ledger — directly under toolbar so native/mobile can see it */}
            {account && showTransactions && (
              <div ref={ledgerRef} className="mm3-trade-log mt-2 max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain rounded-lg border bg-black/70 p-3" style={{ borderColor: tier.glow, WebkitOverflowScrolling: 'touch' }}>
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


      </>
      </div>
    </div>
  );
}
