'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n-context';

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function shortWallet(w) {
  if (!w || w.length < 10) return w;
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

export default function ChainSolveCard({ wallet, onWinner }) {
  const { t } = useI18n();
  const [status, setStatus] = useState(null);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [countdown, setCountdown] = useState('');
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const params = wallet ? `?wallet=${encodeURIComponent(wallet)}` : '';
      const res = await fetch(`/api/chain-solve/status${params}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok) {
        setStatus(data);
        if (data.winner && onWinner) onWinner(data.winner);
      }
    } catch {}
  }, [wallet, onWinner]);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 30_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  useEffect(() => {
    if (!status?.resetAt) { setCountdown(''); return; }
    const tick = () => {
      const remaining = new Date(status.resetAt).getTime() - Date.now();
      if (remaining <= 0) {
        setCountdown('');
        fetchStatus();
        clearInterval(timerRef.current);
      } else {
        setCountdown(formatCountdown(remaining));
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [status?.resetAt, fetchStatus]);

  const handleSubmit = useCallback(async () => {
    if (!wallet || !input.trim() || submitting) return;
    const answer = parseInt(input.trim(), 10);
    const maxAnswer = Math.max(Number(status?.gamma) || 0, 50);
    if (isNaN(answer) || answer < 1 || answer > maxAnswer) {
      setFeedback({ type: 'error', msg: `${t('chainSolve.errorRange')} ${maxAnswer}.` });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/chain-solve/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, answer }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.error === 'already_attempted_today') {
          setFeedback({ type: 'warn', msg: t('chainSolve.feedbackAlreadyAttempted') });
        } else if (data.error === 'game_over') {
          setFeedback({ type: 'info', msg: `${t('chainSolve.feedbackGameOver')} ${shortWallet(data.winner?.wallet)}.` });
        } else {
          setFeedback({ type: 'error', msg: data.error || t('chainSolve.feedbackNetwork') });
        }
      } else if (data.correct) {
        setFeedback({ type: 'win', msg: t('chainSolve.feedbackWin') });
        if (onWinner) onWinner(data.winner);
      } else {
        setFeedback({ type: 'wrong', msg: `${t('chainSolve.feedbackWrong')} ${answer}${t('chainSolve.feedbackWrongSuffix')}` });
      }
      setInput('');
      await fetchStatus();
    } catch {
      setFeedback({ type: 'error', msg: t('chainSolve.feedbackNetwork') });
    } finally {
      setSubmitting(false);
    }
  }, [wallet, input, submitting, fetchStatus, onWinner]);

  const handleKey = useCallback((e) => {
    if (e.key === 'Enter') handleSubmit();
  }, [handleSubmit]);

  if (!status) {
    return (
      <div className="mm3-chain-solve-card w-full max-w-[1080px] mx-auto px-2 lg:px-3 mt-2">
        <div className="rounded border border-emerald-500/20 bg-black/40 px-3 py-3 text-center">
          <span className="text-[0.6rem] font-mono uppercase tracking-[0.2em] text-emerald-400/30 animate-pulse">
            {t('chainSolve.loadingOracle')}
          </span>
        </div>
      </div>
    );
  }

  const { winner, canAttempt, alpha, beta, gamma, mm3Global } = status;
  const mm3Display = Number(mm3Global || 0).toFixed(2);
  const effectiveGamma = Math.max(Number(gamma) || 0, 50);

  // ── GAME WON STATE ──────────────────────────────────────────
  if (winner) {
    return (
      <div className="mm3-chain-solve-card w-full max-w-[1080px] mx-auto px-2 lg:px-3 mt-2">
        <div
          className="rounded border px-3 py-4 text-center"
          style={{
            borderColor: 'rgba(74,222,128,0.6)',
            background: 'linear-gradient(180deg, rgba(0,20,10,0.97) 0%, rgba(0,10,5,0.95) 100%)',
            boxShadow: '0 0 40px rgba(74,222,128,0.18), inset 0 0 30px rgba(74,222,128,0.05)',
          }}
        >
          <div className="text-[0.72rem] font-black uppercase tracking-[0.28em] text-emerald-300 mb-1">
            {t('chainSolve.solvedTitle')}
          </div>
          <div className="text-[0.62rem] font-mono uppercase tracking-[0.18em] text-emerald-400/60 mb-2">
            {t('chainSolve.solvedSubtitle')}
          </div>
          <div
            className="inline-block px-4 py-1.5 text-[0.78rem] font-black font-mono"
            style={{
              color: '#4ade80',
              background: 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.3)',
              textShadow: '0 0 12px rgba(74,222,128,0.6)',
            }}
          >
            {shortWallet(winner.wallet)}
          </div>
          <div className="mt-1 text-[0.58rem] font-mono text-emerald-500/40">
            {new Date(winner.won_at).toUTCString()}
          </div>
        </div>
      </div>
    );
  }

  // ── FEEDBACK COLOR MAP ──────────────────────────────────────
  const feedbackColor = {
    error: '#f87171',
    warn: '#fbbf24',
    info: '#22d3ee',
    wrong: '#fb923c',
    win: '#4ade80',
  };

  return (
    <div className="mm3-chain-solve-card w-full max-w-[1080px] mx-auto px-2 lg:px-3 mt-2">
      <style>{`
        .chain-solve-input::-webkit-inner-spin-button,
        .chain-solve-input::-webkit-outer-spin-button { -webkit-appearance: none; }
        .chain-solve-input { -moz-appearance: textfield; }
        @keyframes chain-blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div
        className="rounded border px-3 py-3 lg:px-5 lg:py-4"
        style={{
          borderColor: 'rgba(74,222,128,0.18)',
          background: 'linear-gradient(180deg, rgba(0,12,6,0.96) 0%, rgba(0,5,3,0.92) 100%)',
          boxShadow: '0 0 18px rgba(74,222,128,0.05), inset 0 0 20px rgba(74,222,128,0.02)',
        }}
      >
        {/* Header row */}
        <div className="grid grid-cols-2 gap-2 items-start mb-3">

          {/* Left: formula hint */}
          <div>
            <div className="text-[0.58rem] font-mono uppercase tracking-[0.14em] text-emerald-400/40 leading-relaxed">
              Ω(α, β, γ) ∈ [1, {effectiveGamma}] · {t('chainSolve.formulaHint')}
            </div>
          </div>

          {/* Right: live variables */}
          <div
            className="rounded px-3 py-2 font-mono"
            style={{
              background: 'rgba(74,222,128,0.03)',
              border: '1px solid rgba(74,222,128,0.10)',
            }}
          >
            <div className="text-[0.55rem] uppercase tracking-[0.18em] text-emerald-500/40 mb-1.5">
              {t('chainSolve.liveLabel')}
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              {[
                { sym: 'α', label: t('chainSolve.labelMarket'), val: alpha },
                { sym: 'β', label: t('chainSolve.labelChain'), val: beta },
                { sym: 'γ', label: t('chainSolve.labelGamma'), val: gamma },
              ].map(({ sym, label, val }) => (
                <div key={sym}>
                  <div
                    className="text-[0.78rem] font-black"
                    style={{ color: '#4ade80', textShadow: '0 0 8px rgba(74,222,128,0.3)' }}
                  >
                    {sym}
                  </div>
                  <div className="text-[0.68rem] font-black text-emerald-200">{val}</div>
                  <div className="text-[0.52rem] text-emerald-500/40">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-center text-[0.52rem] text-emerald-500/25 font-mono">
              mm3 global: {mm3Display} · γ = |{mm3Display}|×100→int
            </div>
          </div>
        </div>

        {/* Input row */}
        {!wallet ? (
          <div className="text-center text-[0.64rem] font-mono uppercase tracking-[0.18em] text-emerald-500/40 py-1">
            {t('chainSolve.connectWallet')}
          </div>
        ) : !canAttempt && countdown ? (
          <div className="flex items-center justify-center gap-3 py-1">
            <span className="text-[0.6rem] font-mono uppercase tracking-[0.18em] text-emerald-500/40">
              {t('chainSolve.nextAttemptIn')}
            </span>
            <span
              className="text-[0.82rem] font-black font-mono"
              style={{
                color: '#4ade80',
                animation: 'chain-blink 2s ease-in-out infinite',
              }}
            >
              {countdown}
            </span>
          </div>
        ) : canAttempt ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={effectiveGamma}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`Ω(α, β, γ) ∈ [1, ${effectiveGamma}]`}
              disabled={submitting}
              className="chain-solve-input flex-1 bg-black/60 border border-emerald-500/20 text-emerald-200 font-mono text-[0.76rem] px-3 py-2 outline-none focus:border-emerald-400/50 placeholder:text-emerald-600/30"
              style={{ minWidth: 0 }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !input.trim()}
              className="shrink-0 px-4 py-2 font-black font-mono text-[0.72rem] uppercase tracking-widest transition-all"
              style={{
                color: submitting || !input.trim() ? 'rgba(74,222,128,0.25)' : '#4ade80',
                background: submitting || !input.trim() ? 'rgba(74,222,128,0.03)' : 'rgba(74,222,128,0.08)',
                border: '1px solid',
                borderColor: submitting || !input.trim() ? 'rgba(74,222,128,0.12)' : 'rgba(74,222,128,0.35)',
                cursor: submitting || !input.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? '…' : t('chainSolve.submit')}
            </button>
          </div>
        ) : (
          <div className="text-center text-[0.62rem] font-mono uppercase tracking-[0.18em] text-emerald-500/30 py-1">
            {t('chainSolve.loading')}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div
            className="mt-2 text-[0.64rem] font-mono px-2 py-1.5"
            style={{
              color: feedbackColor[feedback.type] || '#4ade80',
              background: `${feedbackColor[feedback.type] || '#4ade80'}08`,
              border: `1px solid ${feedbackColor[feedback.type] || '#4ade80'}20`,
            }}
          >
            {feedback.msg}
          </div>
        )}
      </div>
    </div>
  );
}
