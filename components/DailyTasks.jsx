'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { useSound } from '@/lib/sound-context';
import { DAILY_TASKS, getUtcDayBounds, loadDailyTaskProgress } from '@/lib/daily-tasks';
import SectionFrame from '@/components/SectionFrame';
import supabase from '@/lib/supabaseClient';

export default function DailyTasks({ framed = true }) {
  const { account } = useActiveWallet();
  const { t } = useI18n();
  const [counts, setCounts] = useState({});
  const [claimed, setClaimed] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [dayKey, setDayKey] = useState('');
  const [countdown, setCountdown] = useState('00:00:00');
  const [notifiedComplete, setNotifiedComplete] = useState({});
  const firstLoadRef = useRef(true);

  const { playSuccess, playMarketClaim } = useSound();

  const translateOr = (key, fallback) => {
    const value = t(key);
    return typeof value === 'string' && value !== key ? value : fallback;
  };

  const formatResetTimer = (countdownValue) => {
    const raw = translateOr('dailyTasks.resetTimer', 'Reset in {countdown} UTC');
    return raw.replace('{countdown}', countdownValue);
  };

  const pushToast = (msg, type = 'info') => {
    window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type } }));
  };

  useEffect(() => {
    if (!account) {
      setCounts({});
      setClaimed({});
      setDayKey('');
      setNotifiedComplete({});
      firstLoadRef.current = true;
      return;
    }

    let cancelled = false;
    const wallet = account.toLowerCase();

    const loadProgress = async () => {
      setLoading(true);
      setMessage('');
      try {
        const { counts: nextCounts, claimed: claimMap, dayKey: currentDayKey } = await loadDailyTaskProgress(supabase, wallet);

        if (cancelled) return;

        setCounts(nextCounts);
        setClaimed(claimMap);
        setDayKey(currentDayKey);
        if (firstLoadRef.current) {
          const completedOnLoad = {};
          DAILY_TASKS.forEach((task) => {
            if ((nextCounts[task.key] || 0) >= task.target) completedOnLoad[task.key] = true;
          });
          setNotifiedComplete(completedOnLoad);
        }
        firstLoadRef.current = false;
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

  useEffect(() => {
    if (!account || firstLoadRef.current) return;
    taskRows.forEach((task) => {
      if (!task.complete || task.claimed || notifiedComplete[task.key]) return;
      setNotifiedComplete((prev) => ({ ...prev, [task.key]: true }));
      playSuccess();
      pushToast(`${t(`dailyTasks.tasks.${task.translationKey}.name`)} :: ${t('dailyTasks.complete')}`, 'success');
    });
  }, [account, counts, claimed, notifiedComplete, playSuccess, t]);

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
        playMarketClaim();
        pushToast(t('dailyTasks.claimSuccess'), 'success');
        window.dispatchEvent(new CustomEvent('mm3-db-updated', {
          detail: {
            wallet: account.toLowerCase(),
            dailyTask: task.key,
            reward: {
              EUR: Number(payload.rewardEur) || 0,
              USD: Number(payload.rewardUsd) || 0,
              CNY: Number(payload.rewardCny) || 0,
            },
          },
        }));
      }
    } catch (error) {
      console.error('claim error:', error);
      setMessage(t('dailyTasks.claimError'));
    } finally {
      setLoading(false);
    }
  };

  const taskRows = DAILY_TASKS.map((task) => {
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

  const content = (
      <div className="mx-auto w-full max-w-lg px-2 pb-6 pt-4 sm:px-2">
        {account ? (
          <div className="mb-3 rounded-md border border-cyan-500/20 bg-black/70 p-3 font-mono text-sm leading-6 text-cyan-100 shadow-[inset_0_0_22px_rgba(34,211,238,0.05)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-black uppercase tracking-[0.22em] text-cyan-200">
                {noticeText}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-green-300/80">
                {resetText}
              </span>
            </div>
          </div>
        ) : null}

        <div className="space-y-2.5 font-mono">
          {taskRows.map((task) => (
            <div key={task.key} className="rounded-md border border-cyan-500/15 bg-black/70 p-3 shadow-[0_0_18px_rgba(34,211,238,0.04)]">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-fuchsia-300">{t(`dailyTasks.tasks.${task.translationKey}.name`)}</div>
                    <div className="mt-1 text-[0.92rem] font-black text-slate-100">{t(`dailyTasks.tasks.${task.translationKey}.hint`)}</div>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <span className="text-xs uppercase tracking-[0.18em] text-emerald-300/90">{t('dailyTasks.rewardLabel')} {task.rewardEur.toFixed(2)}€</span>
                    <button
                      type="button"
                      onClick={() => handleClaim(task)}
                      disabled={!task.complete || task.claimed || loading}
                      className={`inline-flex min-h-9 items-center justify-center rounded-md border px-3 py-1.5 text-[0.76rem] font-black uppercase tracking-[0.18em] transition ${task.claimed ? 'cursor-default border-emerald-400/45 bg-emerald-500/10 text-emerald-200' : task.complete ? 'border-cyan-400/65 bg-cyan-500/10 text-cyan-100 hover:border-cyan-300 hover:bg-cyan-500/20' : 'cursor-not-allowed border-slate-800 bg-black/50 text-slate-600'}`}
                    >
                      {task.claimed ? t('dailyTasks.claimed') : t('dailyTasks.claimReward')}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[0.70rem] uppercase tracking-[0.18em] text-slate-500">
                    <span>{task.value} / {task.target}</span>
                    <span>{task.filled}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-sm border border-cyan-500/10 bg-slate-950">
                    <div className="h-full rounded-none bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-green-300" style={{ width: `${task.filled}%` }} />
                  </div>
                </div>
              </div>
            ))}

            {message ? (
              <div className="rounded-md border border-cyan-500/15 bg-black/80 px-4 py-3 text-sm text-cyan-100">
                {message}
              </div>
            ) : null}
          </div>
      </div>
  );

  if (!framed) return content;

  return (
    <SectionFrame accent="#22d3ee" id="daily-tasks-section">
      {content}
    </SectionFrame>
  );
}
