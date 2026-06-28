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

function solverBadge(solver) {
  const base = shortWallet(solver.wallet);
  return base + '@MM3';
}

export default function ChainSolveCard({ wallet, onWinner }) {
  const { t } = useI18n();
  const [status, setStatus] = useState(null);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [countdown, setCountdown] = useState('');
  const timerRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const params = wallet ? `?wallet=${encodeURIComponent(wallet)}` : '';
      const res = await fetch(`/api/chain-solve/status${params}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok) {
        setStatus(data);
        if (data.solvers?.length && onWinner) onWinner(data.solvers[0]);
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
        } else if (data.error === 'already_solved_lifetime') {
          setFeedback({ type: 'info', msg: '✓ Tu wallet ya ha resuelto la fórmula anteriormente.' });
        } else {
          setFeedback({ type: 'error', msg: data.error || t('chainSolve.feedbackNetwork') });
        }
        setInput('');
        await fetchStatus();
      } else if (data.correct) {
        setFeedback({ type: 'win', msg: '⬡ FÓRMULA RESUELTA — chain al 100%, modo demine activo. +1000 MM3 a tu wallet.' });
        setInput('');
        onWinner?.();
        setTimeout(fetchStatus, 4000);
      } else {
        setFeedback({ type: 'wrong', msg: `${t('chainSolve.feedbackWrong')} ${answer}${t('chainSolve.feedbackWrongSuffix')}` });
        setInput('');
        await fetchStatus();
      }
    } catch {
      setFeedback({ type: 'error', msg: t('chainSolve.feedbackNetwork') });
    } finally {
      setSubmitting(false);
    }
  }, [wallet, input, submitting, fetchStatus, onWinner, status]);

  const handleKey = useCallback((e) => {
    if (e.key === 'Enter') handleSubmit();
  }, [handleSubmit]);

  if (!status) {
    return (
      <div className="mm3-chain-solve-card w-full max-w-[1080px] mx-auto px-2 lg:px-3 mt-2">
        <div className="rounded border border-emerald-500/20 bg-black/40 px-3 py-2 text-center">
          <span className="text-[0.6rem] font-mono uppercase tracking-[0.2em] text-emerald-400/30 animate-pulse">
            {t('chainSolve.loadingOracle')}
          </span>
        </div>
      </div>
    );
  }

  const { solvers = [], walletSolved, canAttempt, alpha, beta, gamma, mm3Global, chainDemineActive, chainDemineHitsRemaining } = status;
  const mm3Display = Number(mm3Global || 0).toFixed(2);
  const effectiveGamma = Math.max(Number(gamma) || 0, 50);

  const feedbackColor = {
    error: '#f87171', warn: '#fbbf24', info: '#22d3ee',
    wrong: '#fb923c', win: '#4ade80',
  };

  return (
    <div className="mm3-chain-solve-card w-full max-w-[1080px] mx-auto px-2 lg:px-3 mt-2 space-y-2">
      <style>{`
        .chain-solve-input::-webkit-inner-spin-button,
        .chain-solve-input::-webkit-outer-spin-button { -webkit-appearance: none; }
        .chain-solve-input { -moz-appearance: textfield; }
        @keyframes chain-blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes chain-demine-pulse { 0%,100%{opacity:1;text-shadow:0 0 8px #fb923c88} 50%{opacity:0.8;text-shadow:0 0 22px #fb923ccc} }
        @keyframes chain-win-pulse { 0%,100%{opacity:1;text-shadow:0 0 18px rgba(74,222,128,0.9)} 50%{opacity:0.75;text-shadow:0 0 36px rgba(74,222,128,1)} }
      `}</style>

      {/* ── Demine mode banner ────────────────────────────────────────────── */}
      {chainDemineActive && (
        <div
          className="rounded border px-3 py-2 text-center"
          style={{ borderColor: 'rgba(251,146,60,0.55)', background: 'rgba(12,5,0,0.97)', boxShadow: '0 0 24px rgba(251,146,60,0.10)' }}
        >
          <div
            className="text-[0.82rem] font-black font-mono uppercase tracking-[0.18em]"
            style={{ color: '#fb923c', animation: 'chain-demine-pulse 2s ease-in-out infinite' }}
          >
            ⛏ MODO DEMINE ACTIVO
          </div>
          <div className="text-[0.6rem] font-mono text-orange-400/60 mt-1">
            {chainDemineHitsRemaining} golpes restantes · Golpea el nodo de la chain en el juego · +1 MM3 por golpe
          </div>
          <div className="text-[0.54rem] font-mono text-orange-400/35 mt-0.5">
            El minado de bloques está desactivado hasta que la chain llegue al 0%
          </div>
        </div>
      )}

      {/* ── Main formula card ─────────────────────────────────────────────── */}
      <div
        className="rounded border px-2.5 py-1.5"
        style={{
          borderColor: walletSolved ? 'rgba(74,222,128,0.40)' : 'rgba(74,222,128,0.18)',
          background: 'rgba(0,8,4,0.94)',
        }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <div className="text-[0.54rem] font-mono uppercase tracking-[0.12em] text-emerald-400/40 leading-tight">
            Ω(α, β, γ) ∈ [1, {effectiveGamma}] · {t('chainSolve.formulaHint')}
          </div>
          <div
            className="flex items-center gap-1.5 font-mono px-2 py-0.5 shrink-0"
            style={{ border: '1px solid rgba(74,222,128,0.10)', background: 'rgba(74,222,128,0.03)' }}
          >
            <span className="text-[0.46rem] uppercase tracking-[0.16em] text-emerald-500/40 mr-0.5">
              {t('chainSolve.liveLabel')}
            </span>
            {[
              { sym: 'α', label: t('chainSolve.labelMarket'), val: alpha },
              { sym: 'β', label: t('chainSolve.labelChain'), val: beta },
              { sym: 'γ', label: t('chainSolve.labelGamma'), val: gamma },
            ].map(({ sym, label, val }, i) => (
              <span key={sym} className="flex items-baseline gap-0.5">
                {i > 0 && <span className="text-emerald-700/30 text-[0.46rem] mx-0.5">·</span>}
                <span className="text-[0.64rem] font-black" style={{ color: '#4ade80' }}>{sym}</span>
                <span className="text-[0.6rem] font-black text-emerald-200 ml-0.5">{val}</span>
                <span className="text-[0.44rem] text-emerald-500/35 ml-0.5">{label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="text-[0.44rem] text-emerald-500/25 font-mono mb-1">
          mm3 global: {mm3Display} · γ = |{mm3Display}|×100→int
        </div>

        {/* Wallet solved badge */}
        {walletSolved && (
          <div
            className="flex items-center gap-2 mb-1.5 px-2 py-1"
            style={{ border: '1px solid rgba(74,222,128,0.30)', background: 'rgba(74,222,128,0.06)' }}
          >
            <span className="text-[0.7rem]" style={{ animation: 'chain-win-pulse 2.4s ease-in-out infinite', color: '#4ade80' }}>⬡</span>
            <span className="text-[0.62rem] font-black font-mono tracking-[0.14em]" style={{ color: '#4ade80' }}>
              TU WALLET ES @MM3 — HAS RESUELTO LA CHAIN
            </span>
          </div>
        )}

        {/* Input row */}
        {!wallet ? (
          <div className="text-center text-[0.62rem] font-mono uppercase tracking-[0.18em] text-emerald-500/40 py-0.5">
            {t('chainSolve.connectWallet')}
          </div>
        ) : walletSolved ? (
          <div className="text-center text-[0.58rem] font-mono text-emerald-500/30 py-0.5">
            Sólo puedes resolver la fórmula una vez en toda la vida del juego.
          </div>
        ) : !canAttempt && countdown ? (
          <div className="flex items-center justify-center gap-3 py-0.5">
            <span className="text-[0.6rem] font-mono uppercase tracking-[0.18em] text-emerald-500/40">
              {t('chainSolve.nextAttemptIn')}
            </span>
            <span
              className="text-[0.82rem] font-black font-mono"
              style={{ color: '#4ade80', animation: 'chain-blink 2s ease-in-out infinite' }}
            >
              {countdown}
            </span>
          </div>
        ) : canAttempt ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={effectiveGamma}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`Ω(α, β, γ) ∈ [1, ${effectiveGamma}]`}
              disabled={submitting}
              className="chain-solve-input flex-1 bg-black/60 border border-emerald-500/20 text-emerald-200 font-mono text-[0.74rem] px-3 py-1.5 outline-none focus:border-emerald-400/50 placeholder:text-emerald-600/30"
              style={{ minWidth: 0 }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !input.trim()}
              className="shrink-0 px-4 py-1.5 font-black font-mono text-[0.7rem] uppercase tracking-widest transition-all"
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

      {/* ── Chain solvers registry ────────────────────────────────────────── */}
      {solvers.length > 0 && (
        <div
          className="rounded border px-2.5 py-2"
          style={{ borderColor: 'rgba(74,222,128,0.14)', background: 'rgba(0,6,3,0.90)' }}
        >
          <div className="text-[0.5rem] font-mono uppercase tracking-[0.22em] text-emerald-500/40 mb-1.5">
            ⬡ WALLETS @MM3 — CHAIN COMPLETADA AL 100%
          </div>
          <div className="space-y-0.5">
            {solvers.map((s, i) => (
              <div key={s.wallet} className="flex items-center gap-2">
                <span className="text-[0.52rem] font-mono text-emerald-700/50 w-4 shrink-0">
                  #{i + 1}
                </span>
                <a
                  href={`/ranking?wallet=${encodeURIComponent(s.wallet)}`}
                  className="text-[0.62rem] font-black font-mono tracking-[0.08em] hover:opacity-80 transition-opacity"
                  style={{ color: '#4ade80', textDecoration: 'none' }}
                >
                  {shortWallet(s.wallet)}@MM3
                </a>
                <span className="text-[0.46rem] font-mono text-emerald-600/30 ml-auto shrink-0">
                  {s.formula_solved ? '⚡formula' : '⛏bloques'} · {new Date(s.solved_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
