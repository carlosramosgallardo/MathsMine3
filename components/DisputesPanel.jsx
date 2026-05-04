'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { colorFromAddress } from '@/lib/wallet-colors';

const STATUS_LABELS = {
  registering: { es: 'REGISTRANDO', en: 'REGISTERING', color: '#22d3ee' },
  battle_start: { es: 'INICIO DISPUTA', en: 'BATTLE START', color: '#f59e0b' },
  resolved: { es: 'RESUELTO', en: 'RESOLVED', color: '#4ade80' },
};

const WINNER_LABELS = {
  challenger: { es: 'ATACANTE', en: 'CHALLENGER' },
  defender: { es: 'DEFENSOR', en: 'DEFENDER' },
  draw: { es: 'EMPATE', en: 'DRAW' },
};

function fmt(n, dec = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(dec);
}

function useCountdown(targetMs) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, targetMs - Date.now())), 500);
    return () => clearInterval(id);
  }, [targetMs]);
  return remaining;
}

function fmtCountdown(ms) {
  if (ms <= 0) return '00:00';
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function CountdownBadge({ targetMs, color }) {
  const rem = useCountdown(targetMs);
  return (
    <span style={{ color, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>
      {fmtCountdown(rem)}
    </span>
  );
}

function ScoreBar({ chScore, dfScore }) {
  const total = (Number(chScore) || 0) + (Number(dfScore) || 0);
  if (total <= 0) return null;
  const chPct = Math.round(((Number(chScore) || 0) / total) * 100);
  return (
    <div style={{ margin: '8px 0', background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
      <div style={{ width: `${chPct}%`, height: '100%', background: 'linear-gradient(90deg, #22d3ee, #3b82f6)', transition: 'width 0.8s' }} />
    </div>
  );
}

function DisputeCard({ dispute, activeWallet, poolCode, language, onJoin, onWalletClick }) {
  const lang = language === 'es' ? 'es' : 'en';
  const statusMeta = STATUS_LABELS[dispute.status] || STATUS_LABELS.resolved;
  const isRegistering = dispute.status === 'registering';
  const isBattleStart = dispute.status === 'battle_start';
  const isResolved = dispute.status === 'resolved';

  const battleDeadline = isRegistering
    ? new Date(dispute.registered_at).getTime() + 5 * 60 * 1000
    : null;
  const resolveDeadline = isBattleStart
    ? new Date(dispute.battle_start_at).getTime() + 5000
    : null;

  const registeredWallets = dispute.wallets || [];
  const isInChallenger = poolCode === dispute.challenger_pool_code;
  const isRegistered = registeredWallets.some((w) => w.wallet === activeWallet);
  const canJoin = isRegistering && isInChallenger && !isRegistered && activeWallet;

  const chWallets = registeredWallets.filter((w) => w.side === 'challenger');
  const dfWallets = registeredWallets.filter((w) => w.side === 'defender');

  const chScore = Number(dispute.ch_score || 0);
  const dfScore = Number(dispute.df_score || 0);
  const winner = dispute.winner;

  const winnerColor =
    winner === 'draw' ? '#94a3b8'
    : winner === 'challenger' ? '#22d3ee'
    : '#f59e0b';

  return (
    <div style={{
      border: `1px solid ${statusMeta.color}44`,
      borderRadius: 8,
      padding: '14px 16px',
      marginBottom: 12,
      background: 'rgba(2,6,23,0.7)',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#22d3ee', fontSize: '0.95rem' }}>
          {dispute.challenger_pool_code}
        </span>
        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
          {lang === 'es' ? 'vs' : 'vs'}
        </span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f59e0b', fontSize: '0.95rem' }}>
          {dispute.defender_pool_code}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: statusMeta.color,
          border: `1px solid ${statusMeta.color}66`,
          borderRadius: 4,
          padding: '1px 7px',
        }}>
          {statusMeta[lang]}
        </span>
      </div>

      {/* Registration countdown + join button */}
      {isRegistering && battleDeadline && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
            {lang === 'es' ? 'Cierre registro' : 'Closes in'}
          </span>
          <CountdownBadge targetMs={battleDeadline} color="#22d3ee" />
          {canJoin && (
            <button
              onClick={() => onJoin(dispute.id)}
              style={{
                marginLeft: 'auto',
                padding: '3px 12px',
                borderRadius: 4,
                border: '1px solid rgba(34,211,238,0.5)',
                background: 'rgba(34,211,238,0.1)',
                color: '#22d3ee',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontWeight: 700,
              }}
            >
              {lang === 'es' ? '+ UNIRSE' : '+ JOIN'}
            </button>
          )}
        </div>
      )}

      {/* Battle start countdown */}
      {isBattleStart && resolveDeadline && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>
            {lang === 'es' ? 'Resolución en' : 'Resolving in'}
          </span>
          <CountdownBadge targetMs={resolveDeadline} color="#f59e0b" />
        </div>
      )}

      {/* World state trace (shown from battle_start) */}
      {(isBattleStart || isResolved) && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
          {[
            { emoji: '⚔️', val: `${fmt(dispute.war_percent, 0)}%` },
            { emoji: '🌪️', val: `${fmt(dispute.nature_percent, 0)}%` },
            { emoji: '🎲', val: fmt(dispute.dice_modifier, 4) },
          ].map(({ emoji, val }) => (
            <div key={emoji} style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span>{emoji}</span>
              <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Score comparison (shown from battle_start) */}
      {(isBattleStart || isResolved) && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#22d3ee', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(chScore, 4)}</span>
              <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                {dispute.challenger_pool_code}
                {!isResolved && <> ({dispute.ch_wallet_count}w)</>}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                {dispute.defender_pool_code}
                {!isResolved && <> ({dispute.df_wallet_count}w)</>}
              </span>
              <span style={{ color: '#f59e0b', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(dfScore, 4)}</span>
            </div>
          </div>
          <ScoreBar chScore={chScore} dfScore={dfScore} />
        </div>
      )}

      {/* Resolution banner */}
      {isResolved && winner && (
        <div style={{
          border: `1px solid ${winnerColor}55`,
          borderRadius: 6,
          padding: '8px 12px',
          marginBottom: 10,
          background: `${winnerColor}11`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: '1.1rem' }}>
            {winner === 'draw' ? '⚖️' : winner === 'challenger' ? '🏆' : '🛡️'}
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: winnerColor }}>
              {lang === 'es' ? 'GANADOR' : 'WINNER'}: {WINNER_LABELS[winner]?.[lang] || winner.toUpperCase()}
            </div>
            {dispute.result_summary?.transfer_eur > 0 && (
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                {lang === 'es' ? 'Transferido' : 'Transferred'}{': '}
                <span style={{ color: '#4ade80' }}>
                  {fmt(dispute.result_summary.transfer_eur, 4)} EUR
                </span>
                {' + '}
                <span style={{ color: '#f59e0b' }}>
                  {fmt(dispute.result_summary.transfer_mm3, 4)} MM3
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wallet stats tables */}
      {(isRegistering || isBattleStart || isResolved) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { side: 'challenger', wallets: chWallets, color: '#22d3ee', pool: dispute.challenger_pool_code },
            { side: 'defender', wallets: dfWallets, color: '#f59e0b', pool: dispute.defender_pool_code },
          ].map(({ side, wallets, color, pool }) => (
            <div key={side} style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{ fontSize: '0.68rem', color, fontWeight: 700, marginBottom: 4, letterSpacing: '0.06em' }}>
                {pool} ({wallets.length}w)
              </div>
              {wallets.length === 0 ? (
                <div style={{ fontSize: '0.7rem', color: '#475569' }}>—</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {wallets.map((w) => {
                    const wColor = colorFromAddress(w.wallet);
                    const isMe = w.wallet === activeWallet;
                    return (
                      <div key={w.wallet} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.7rem' }}>
                        <button
                          type="button"
                          onClick={() => onWalletClick && onWalletClick(w.wallet)}
                          title={w.wallet}
                          style={{
                            fontFamily: 'monospace',
                            color: wColor,
                            fontWeight: isMe ? 700 : 400,
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: onWalletClick ? 'pointer' : 'default',
                            textDecoration: onWalletClick ? 'underline' : 'none',
                            textDecorationColor: `${wColor}55`,
                          }}
                        >
                          {w.wallet.slice(-5)}
                        </button>
                        <span style={{ color: '#64748b' }}>Lv{w.level_snap}</span>
                        {w.has_penalty && <span title={lang === 'es' ? 'Penalización activa' : 'Active penalty'}>⚠️</span>}
                        {w.market_nftji_snap && <span title="Market NFTJI">🛰</span>}
                        {isResolved && w.delta_eur !== 0 && (
                          <span style={{ marginLeft: 'auto', color: w.delta_eur > 0 ? '#4ade80' : '#f87171', fontFamily: 'monospace' }}>
                            {w.delta_eur > 0 ? '+' : ''}{fmt(w.delta_eur, 4)}€
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Aggregate stats trace + formula (battle_start / resolved) */}
      {(isBattleStart || isResolved) && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: '0.7rem', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
            {lang === 'es' ? 'Desglose stats' : 'Stats breakdown'}
          </summary>
          <div style={{ marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'n', ch: dispute.ch_wallet_count, df: dispute.df_wallet_count },
              { label: lang === 'es' ? 'Σnivel' : 'Σlevel', ch: dispute.ch_level_sum, df: dispute.df_level_sum },
              { label: 'ΣMM3', ch: fmt(dispute.ch_mm3_sum), df: fmt(dispute.df_mm3_sum) },
              { label: 'ΣEUR', ch: fmt(dispute.ch_eur_sum), df: fmt(dispute.df_eur_sum) },
              { label: 'NFTJIs', ch: dispute.ch_nftji_count, df: dispute.df_nftji_count },
              { label: 'Execs', ch: dispute.ch_exec_count, df: dispute.df_exec_count },
              { label: 'Pen.', ch: dispute.ch_penalty_count, df: dispute.df_penalty_count },
            ].map(({ label, ch, df }) => (
              <div key={label} style={{ fontSize: '0.68rem', color: '#64748b' }}>
                <div style={{ marginBottom: 1, color: '#475569', fontSize: '0.65rem' }}>{label}</div>
                <span style={{ color: '#22d3ee', fontFamily: 'monospace' }}>{ch}</span>
                <span style={{ color: '#334155' }}> / </span>
                <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>{df}</span>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 10,
            padding: '8px 10px',
            background: 'rgba(2,6,23,0.6)',
            border: '1px solid rgba(71,85,105,0.25)',
            borderRadius: 5,
            fontSize: '0.65rem',
            fontFamily: 'monospace',
            color: '#475569',
            lineHeight: 1.7,
          }}>
            <div style={{ color: '#334155', marginBottom: 3, letterSpacing: '0.06em' }}>
              {lang === 'es' ? 'FÓRMULA' : 'FORMULA'}
            </div>
            <div>
              <span style={{ color: '#64748b' }}>base</span>
              {' = '}
              <span style={{ color: '#22d3ee' }}>(Σnivel/n)×40</span>
              {' + '}
              <span style={{ color: '#22d3ee' }}>ln(ΣMM3/n+1)×20</span>
              {' + '}
              <span style={{ color: '#22d3ee' }}>(execs/n)×12</span>
              {' + '}
              <span style={{ color: '#22d3ee' }}>(nftjis/n)×8</span>
              {' + '}
              <span style={{ color: '#22d3ee' }}>(market/n)×15</span>
              {' - '}
              <span style={{ color: '#f87171' }}>(pen/n)×20</span>
            </div>
            <div style={{ marginTop: 3 }}>
              <span style={{ color: '#64748b' }}>⚔️ score</span>
              {' = base × (1+(⚔️-50)/100×0.30) × (1+(50-🌪️)/100×0.20) × (1+🎲×0.30)'}
            </div>
            <div>
              <span style={{ color: '#64748b' }}>🛡️ score</span>
              {' = base × (1+(50-⚔️)/100×0.30) × (1+(🌪️-50)/100×0.20) × (1-🎲×0.30)'}
            </div>
            <div style={{ marginTop: 3, color: '#334155' }}>
              {lang === 'es'
                ? `⚔️${fmt(dispute.war_percent,0)}% 🌪️${fmt(dispute.nature_percent,0)}% 🎲${fmt(dispute.dice_modifier,4)} → ⚔️${fmt(dispute.ch_score,4)} vs 🛡️${fmt(dispute.df_score,4)}`
                : `⚔️${fmt(dispute.war_percent,0)}% 🌪️${fmt(dispute.nature_percent,0)}% 🎲${fmt(dispute.dice_modifier,4)} → ⚔️${fmt(dispute.ch_score,4)} vs 🛡️${fmt(dispute.df_score,4)}`
              }
            </div>
            {isResolved && (
              <div style={{ marginTop: 3 }}>
                {lang === 'es' ? 'apuesta' : 'stake'}{': '}
                <span style={{ color: '#94a3b8' }}>5% EUR + 3% MM3 por wallet</span>
                {' → '}
                <span style={{ color: '#4ade80' }}>55% {lang === 'es' ? 'del perdedor al ganador' : 'of loser transferred to winner'}</span>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

export default function DisputesPanel({ wallet, poolCode, language, onWalletClick }) {
  const lang = language === 'es' ? 'es' : 'en';
  const [disputes, setDisputes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const pollingRef = useRef(null);
  const transitioningRef = useRef(new Set());

  const fetchDisputes = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet-pools/disputes?limit=50');
      const data = await res.json();
      if (data.ok) setDisputes(data.disputes || []);
      else setError(data.error || 'fetch_error');
    } catch {
      setError('network_error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll every 3 seconds; trigger state transitions when timers expire
  const checkTransitions = useCallback(async (disputeList) => {
    const now = Date.now();
    for (const d of disputeList) {
      if (transitioningRef.current.has(d.id)) continue;

      if (d.status === 'registering') {
        const deadline = new Date(d.registered_at).getTime() + 5 * 60 * 1000;
        if (now >= deadline) {
          transitioningRef.current.add(d.id);
          fetch('/api/wallet-pools/dispute/start-battle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disputeId: d.id }),
          }).then(() => {
            transitioningRef.current.delete(d.id);
            fetchDisputes();
          }).catch(() => transitioningRef.current.delete(d.id));
        }
      } else if (d.status === 'battle_start') {
        const deadline = new Date(d.battle_start_at).getTime() + 5000;
        if (now >= deadline) {
          transitioningRef.current.add(d.id);
          fetch('/api/wallet-pools/dispute/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disputeId: d.id }),
          }).then(() => {
            transitioningRef.current.delete(d.id);
            fetchDisputes();
          }).catch(() => transitioningRef.current.delete(d.id));
        }
      }
    }
  }, [fetchDisputes]);

  useEffect(() => {
    fetchDisputes();
    pollingRef.current = setInterval(async () => {
      await fetchDisputes();
    }, 3000);
    return () => clearInterval(pollingRef.current);
  }, [fetchDisputes]);

  useEffect(() => {
    if (disputes.length > 0) checkTransitions(disputes);
  }, [disputes, checkTransitions]);

  async function handleJoin(disputeId) {
    if (!wallet || joinBusy) return;
    setJoinBusy(true);
    try {
      const res = await fetch('/api/wallet-pools/dispute/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disputeId, wallet }),
      });
      const data = await res.json();
      if (data.ok) await fetchDisputes();
    } finally {
      setJoinBusy(false);
    }
  }

  const activeDisputes = disputes.filter((d) => d.status !== 'resolved');
  const resolvedDisputes = disputes.filter((d) => d.status === 'resolved');

  if (isLoading) {
    return (
      <div style={{ padding: 16, color: '#475569', fontSize: '0.8rem', textAlign: 'center' }}>
        {lang === 'es' ? 'Cargando disputas…' : 'Loading disputes…'}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: '#f87171', fontSize: '0.8rem' }}>
        {lang === 'es' ? 'Error al cargar disputas' : 'Error loading disputes'}
      </div>
    );
  }

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{
        fontFamily: 'monospace',
        fontSize: '0.7rem',
        color: '#475569',
        letterSpacing: '0.1em',
        marginBottom: 14,
        borderBottom: '1px solid rgba(71,85,105,0.3)',
        paddingBottom: 6,
      }}>
        {lang === 'es' ? 'DISPUTAS DE POOL' : 'POOL DISPUTES'}
        <span style={{ marginLeft: 10, color: '#334155' }}>
          {activeDisputes.length > 0 ? `${activeDisputes.length} ${lang === 'es' ? 'activa(s)' : 'active'}` : lang === 'es' ? 'sin disputas activas' : 'none active'}
        </span>
      </div>

      {activeDisputes.length === 0 && resolvedDisputes.length === 0 && (
        <div style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'center', padding: '24px 0' }}>
          {lang === 'es' ? 'No hay disputas registradas todavía.' : 'No disputes registered yet.'}
        </div>
      )}

      {activeDisputes.map((d) => (
        <DisputeCard
          key={d.id}
          dispute={d}
          activeWallet={wallet}
          poolCode={poolCode}
          language={language}
          onJoin={handleJoin}
          onWalletClick={onWalletClick}
        />
      ))}

      {resolvedDisputes.length > 0 && (
        <>
          <div style={{ fontSize: '0.68rem', color: '#334155', letterSpacing: '0.08em', marginTop: 8, marginBottom: 8 }}>
            {lang === 'es' ? 'HISTORIAL' : 'HISTORY'}
          </div>
          {resolvedDisputes.slice(0, 20).map((d) => (
            <DisputeCard
              key={d.id}
              dispute={d}
              activeWallet={wallet}
              poolCode={poolCode}
              language={language}
              onJoin={handleJoin}
              onWalletClick={onWalletClick}
            />
          ))}
        </>
      )}
    </div>
  );
}
