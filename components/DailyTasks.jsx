'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import SectionFrame from '@/components/SectionFrame';
import supabase from '@/lib/supabaseClient';

function getUtcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dayKey = start.toISOString().slice(0, 10);
  return { startIso: start.toISOString(), endIso: end.toISOString(), dayKey };
}

const TASKS = [
  {
    key: 'mining',
    translationKey: 'mining',
    target: 25,
    rewardEur: 0.25,
  },
  {
    key: 'trading',
    translationKey: 'trading',
    target: 5,
    rewardEur: 0.5,
  },
  {
    key: 'market',
    translationKey: 'market',
    target: 1,
    rewardEur: 0.75,
  },
  {
    key: 'irc',
    translationKey: 'irc',
    target: 1,
    rewardEur: 1,
  },
  {
    key: 'ircHidden',
    translationKey: 'ircHidden',
    target: 1,
    rewardEur: 5,
  },
];

function toCount(value) {
  return Number(value) || 0;
}

export default function DailyTasks() {
  const { account } = useActiveWallet();
  const { t } = useI18n();
  const [counts, setCounts] = useState({});
  const [claimed, setClaimed] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [dayKey, setDayKey] = useState('');
  const [countdown, setCountdown] = useState('00:00:00');

  const translateOr = (key, fallback) => {
    const value = t(key);
    return typeof value === 'string' && value !== key ? value : fallback;
  };

  const formatResetTimer = (countdownValue) => {
    const raw = translateOr('dailyTasks.resetTimer', 'Reset in {countdown} UTC');
    return raw.replace('{countdown}', countdownValue);
  };

  useEffect(() => {
    if (!account) {
      setCounts({});
      setClaimed({});
      setDayKey('');
      return;
    }

    let cancelled = false;
    const wallet = account.toLowerCase();

    const loadProgress = async () => {
      setLoading(true);
      setMessage('');
      try {
        const { startIso, endIso, dayKey: currentDayKey } = getUtcDayBounds();
        const [miningRes, tradingRes, marketRes, ircRes, hiddenRes, claimsRes] = await Promise.all([
          supabase
            .from('games')
            .select('id', { count: 'exact', head: true })
            .eq('wallet', wallet)
            .eq('is_correct', true)
            .gte('created_at', startIso)
            .lt('created_at', endIso),
          supabase
            .from('mm3_sell_transactions')
            .select('id', { count: 'exact', head: true })
            .eq('wallet', wallet)
            .gte('created_at', startIso)
            .lt('created_at', endIso),
          supabase
            .from('mm3_market_events')
            .select('id', { count: 'exact', head: true })
            .eq('wallet', wallet)
            .in('event_type', ['market_buy', 'market_resell'])
            .gte('created_at', startIso)
            .lt('created_at', endIso),
          supabase
            .from('mm3_market_commands')
            .select('id', { count: 'exact', head: true })
            .eq('wallet', wallet)
            .gte('executed_at', startIso)
            .lt('executed_at', endIso),
          supabase
            .from('mm3_hidden_cmd_executions')
            .select('id', { count: 'exact', head: true })
            .eq('wallet', wallet)
            .gte('executed_at', startIso)
            .lt('executed_at', endIso),
          supabase
            .from('daily_task_claims')
            .select('task_key, reward_claimed, claimed_at')
            .eq('wallet', wallet)
            .eq('day', currentDayKey),
        ]);

        if (cancelled) return;

        setCounts({
          mining: toCount(miningRes.count),
          trading: toCount(tradingRes.count),
          market: toCount(marketRes.count),
          irc: toCount(ircRes.count),
          ircHidden: toCount(hiddenRes.count),
        });

        const claimMap = {};
        (claimsRes.data || []).forEach((row) => {
          if (row?.task_key) claimMap[row.task_key] = Boolean(row.reward_claimed);
        });
        setClaimed(claimMap);
        setDayKey(currentDayKey);
      } catch (error) {
        console.error('DailyTasks load error:', error);
        setMessage(t('dailyTasks.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProgress();
    const interval = window.setInterval(loadProgress, 30_000);
    return () => window.clearInterval(interval);
  }, [account, t]);

  useEffect(() => {
    const updateCountdown = () => {
      const { endIso } = getUtcDayBounds();
      const remaining = Math.max(0, new Date(endIso) - new Date());
      const seconds = Math.floor(remaining / 1000);
      const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
      const secs = String(seconds % 60).padStart(2, '0');
      setCountdown(`${hours}:${minutes}:${secs}`);
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleClaim = async (task) => {
    if (!account || loading) return;
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/daily-tasks/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: account.toLowerCase(), taskKey: task.key }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setMessage(payload.error || t('dailyTasks.claimError'));
      } else {
        setClaimed((prev) => ({ ...prev, [task.key]: true }));
        setMessage(t('dailyTasks.claimSuccess'));
      }
    } catch (error) {
      console.error('claim error:', error);
      setMessage(t('dailyTasks.claimError'));
    } finally {
      setLoading(false);
    }
  };

  const taskRows = TASKS.map((task) => {
    const value = counts[task.key] || 0;
    const filled = Math.min(100, Math.round((value / task.target) * 100));
    const complete = value >= task.target;
    return {
      ...task,
      value,
      filled,
      complete,
      claimed: Boolean(claimed[task.key]),
    };
  });

  const noticeText = translateOr('dailyTasks.notice', 'Unclaimed rewards disappear.');
  const resetText = formatResetTimer(countdown);

  return (
    <SectionFrame accent="#22d3ee" id="daily-tasks-section">
      <div className="mx-auto w-full max-w-[1120px] px-2 pb-6 pt-6 sm:px-6">
        {account ? (
          <div className="mb-5 border border-slate-700/60 bg-slate-950/90 p-5 text-sm leading-6 text-slate-200 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-semibold uppercase tracking-[0.28em] text-slate-100">
                {noticeText}
              </span>
              <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                {resetText}
              </span>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {taskRows.map((task) => (
            <div key={task.key} className="border border-slate-700/50 bg-slate-950/90 p-4 sm:p-5">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-fuchsia-300">{t(`dailyTasks.tasks.${task.translationKey}.name`)}</div>
                    <div className="mt-1 text-base font-semibold text-white">{t(`dailyTasks.tasks.${task.translationKey}.hint`)}</div>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <span className="text-sm text-slate-300">{t('dailyTasks.rewardLabel')} {task.rewardEur.toFixed(2)}€</span>
                    <button
                      type="button"
                      onClick={() => handleClaim(task)}
                      disabled={!task.complete || task.claimed || loading}
                      className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${task.claimed ? 'cursor-default border-emerald-500 bg-emerald-500/15 text-emerald-200' : task.complete ? 'border-cyan-400 bg-cyan-500/10 text-cyan-100 hover:border-cyan-300 hover:bg-cyan-500/20' : 'cursor-not-allowed border-slate-700 bg-slate-900 text-slate-500'}`}
                    >
                      {task.claimed ? t('dailyTasks.claimed') : t('dailyTasks.claimReward')}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[0.75rem] uppercase tracking-[0.2em] text-slate-500">
                    <span>{task.value} / {task.target}</span>
                    <span>{task.filled}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-none bg-slate-900">
                    <div className="h-full rounded-none bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-amber-300" style={{ width: `${task.filled}%` }} />
                  </div>
                </div>
              </div>
            ))}

            {message ? (
              <div className="rounded-3xl border border-slate-700/50 bg-slate-900/90 px-4 py-3 text-sm text-slate-100">
                {message}
              </div>
            ) : null}
          </div>
      </div>
    </SectionFrame>
  );
}
