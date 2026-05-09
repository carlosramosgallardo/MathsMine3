'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { colorFromAddress } from '@/lib/wallet-colors';
import supabase from '@/lib/supabaseClient';
import { useCurrency } from '@/lib/currency-context';
import { CNY_TO_EUR, CNY_TO_USD, formatMoney } from '@/lib/sell-offer';

const STATUS_LABELS = {
  proposing:    { es: 'PROPUESTA',      en: 'PROPOSAL',     color: '#a78bfa' },
  registering:  { es: 'REGISTRANDO',    en: 'REGISTERING',  color: '#22d3ee' },
  battle_start: { es: 'INICIO DISPUTA', en: 'BATTLE START', color: '#f59e0b' },
  resolved:     { es: 'RESUELTO',       en: 'RESOLVED',     color: '#4ade80' },
  cancelled:    { es: 'CANCELADO',      en: 'CANCELLED',    color: '#475569' },
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

function eurToCurrency(value, currency) {
  const eur = Number(value) || 0;
  if (currency === 'USD') return eur * (CNY_TO_USD / CNY_TO_EUR);
  if (currency === 'CNY') return eur / CNY_TO_EUR;
  return eur;
}

function formatEurAsCurrency(value, currency) {
  return formatMoney(eurToCurrency(value, currency), currency);
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

function parseMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function formatUtc(value) {
  const ms = parseMs(value);
  if (!ms) return 'UTC --';
  return `UTC ${new Date(ms).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z')}`;
}

function getDisputeTrace(dispute, lang) {
  const labels = {
    proposing: lang === 'es' ? 'propuesta' : 'proposed',
    registering: lang === 'es' ? 'registro' : 'registered',
    battle_start: lang === 'es' ? 'batalla' : 'battle',
    resolved: lang === 'es' ? 'resultado' : 'result',
    cancelled: lang === 'es' ? 'cancelada' : 'cancelled',
  };
  const value = dispute.status === 'resolved'
    ? dispute.resolved_at || dispute.battle_start_at || dispute.registered_at
    : dispute.status === 'cancelled'
      ? dispute.cancelled_at || dispute.registered_at
      : dispute.status === 'battle_start'
        ? dispute.battle_start_at || dispute.registered_at
        : dispute.registered_at;
  return {
    label: labels[dispute.status] || labels.proposing,
    value,
    ms: parseMs(value),
  };
}

function getDisputeSortMs(dispute) {
  return getDisputeTrace(dispute, 'en').ms;
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

function PoolLink({ poolCode, color, onPoolClick, children, style }) {
  return (
    <button
      type="button"
      onClick={() => onPoolClick?.(poolCode)}
      title={poolCode}
      style={{
        fontFamily: 'monospace',
        fontWeight: 700,
        color,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: onPoolClick ? 'pointer' : 'default',
        textDecoration: onPoolClick ? 'underline' : 'none',
        textDecorationColor: `${color}55`,
        ...style,
      }}
    >
      {children || poolCode}
    </button>
  );
}

function MarketBlockLink({ label, emoji, blockKey, onMarketBlockClick, title }) {
  const display = label || emoji;
  if (!display) return null;
  return (
    <button
      type="button"
      onClick={() => blockKey && onMarketBlockClick?.(blockKey)}
      title={title || blockKey || emoji}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: blockKey && onMarketBlockClick ? 'pointer' : 'default',
        lineHeight: 1,
        textDecoration: blockKey && onMarketBlockClick ? 'underline' : 'none',
        textDecorationColor: 'rgba(34,211,238,0.35)',
      }}
    >
      {display}
    </button>
  );
}

function DisputeCard({ dispute, activeWallet, poolCode, language, currency, onJoin, onClaimDrop, claimBusy, onWalletClick, onPoolClick, onMarketBlockClick, emojiByWallet, sqzNftjiByWallet }) {
  const lang = language === 'es' ? 'es' : 'en';
  const statusMeta = STATUS_LABELS[dispute.status] || STATUS_LABELS.resolved;
  const isProposing   = dispute.status === 'proposing';
  const isRegistering = dispute.status === 'registering';
  const isBattleStart = dispute.status === 'battle_start';
  const isResolved    = dispute.status === 'resolved';
  const isCancelled   = dispute.status === 'cancelled';
  const trace = getDisputeTrace(dispute, lang);

  const proposalDeadline = isProposing
    ? new Date(dispute.registered_at).getTime() + 5 * 60 * 1000
    : null;
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
        <PoolLink poolCode={dispute.challenger_pool_code} color="#22d3ee" onPoolClick={onPoolClick} style={{ fontSize: '0.95rem' }} />
        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
          {lang === 'es' ? 'vs' : 'vs'}
        </span>
        <PoolLink poolCode={dispute.defender_pool_code} color="#f59e0b" onPoolClick={onPoolClick} style={{ fontSize: '0.95rem' }} />
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
      <div style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 10,
        fontSize: '0.68rem',
        fontFamily: 'monospace',
        color: '#64748b',
        letterSpacing: '0.06em',
      }}>
        <span style={{ color: statusMeta.color }}>{trace.label.toUpperCase()}</span>
        <span>{formatUtc(trace.value)}</span>
        {isProposing && proposalDeadline && (
          <span style={{ color: '#475569' }}>
            {lang === 'es' ? 'EXPIRA' : 'EXPIRES'} {formatUtc(proposalDeadline)}
          </span>
        )}
        {isRegistering && battleDeadline && (
          <span style={{ color: '#475569' }}>
            {lang === 'es' ? 'CIERRE' : 'CLOSE'} {formatUtc(battleDeadline)}
          </span>
        )}
        {isBattleStart && resolveDeadline && (
          <span style={{ color: '#475569' }}>
            {lang === 'es' ? 'RESUELVE' : 'RESOLVES'} {formatUtc(resolveDeadline)}
          </span>
        )}
      </div>

      {/* Proposing: waiting for a 2nd wallet */}
      {isProposing && proposalDeadline && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#a78bfa', fontSize: '0.75rem' }}>
            {lang === 'es'
              ? 'esperando a una wallet más del pool o se cancelará en'
              : 'waiting for another wallet from the pool or cancels in'}
          </span>
          <CountdownBadge targetMs={proposalDeadline} color="#a78bfa" />
        </div>
      )}

      {/* Cancelled: failed attempt banner */}
      {isCancelled && (
        <div style={{
          border: '1px solid rgba(71,85,105,0.4)',
          borderRadius: 6,
          padding: '8px 12px',
          marginBottom: 10,
          background: 'rgba(15,23,42,0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: '1.1rem' }}>💨</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#64748b', letterSpacing: '0.06em' }}>
              {lang === 'es' ? 'INTENTO DE SQUEEZE FALLIDO' : 'FAILED SQUEEZE ATTEMPT'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 2 }}>
              {lang === 'es'
                ? <>
                    <PoolLink poolCode={dispute.challenger_pool_code} color="#64748b" onPoolClick={onPoolClick} style={{ fontSize: '0.7rem', fontWeight: 400 }} />
                    {' intentó un squeeze a '}
                    <PoolLink poolCode={dispute.defender_pool_code} color="#64748b" onPoolClick={onPoolClick} style={{ fontSize: '0.7rem', fontWeight: 400 }} />
                  </>
                : <>
                    <PoolLink poolCode={dispute.challenger_pool_code} color="#64748b" onPoolClick={onPoolClick} style={{ fontSize: '0.7rem', fontWeight: 400 }} />
                    {' attempted to squeeze '}
                    <PoolLink poolCode={dispute.defender_pool_code} color="#64748b" onPoolClick={onPoolClick} style={{ fontSize: '0.7rem', fontWeight: 400 }} />
                  </>}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#334155', marginTop: 2, fontFamily: 'monospace' }}>
              {formatUtc(trace.value)}
            </div>
          </div>
        </div>
      )}

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
                <PoolLink poolCode={dispute.challenger_pool_code} color="#64748b" onPoolClick={onPoolClick} style={{ fontSize: '0.7rem', fontWeight: 400 }} />
                {!isResolved && <> ({dispute.ch_wallet_count}w)</>}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                <PoolLink poolCode={dispute.defender_pool_code} color="#64748b" onPoolClick={onPoolClick} style={{ fontSize: '0.7rem', fontWeight: 400 }} />
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
                  {formatEurAsCurrency(dispute.result_summary.transfer_eur, currency)}
                </span>
              </div>
            )}
            <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 2, fontFamily: 'monospace' }}>
              {formatUtc(trace.value)}
            </div>
          </div>
        </div>
      )}

      {/* Squeeze NFTJI drop notice (claim happens per winning wallet row) */}
      {isResolved && dispute.drop_type && (() => {
        const isAtk = dispute.drop_type === 'attack';
        const dropEmoji = isAtk ? '⚔️' : '🛡️';
        const dropLabel = isAtk
          ? (lang === 'es' ? 'Ataque' : 'Attack')
          : (lang === 'es' ? 'Defensa' : 'Defense');
        const winnerWalletCount = registeredWallets.filter((w) => w.side === dispute.winner).length;
        return (
          <div style={{
            border: `1px solid ${isAtk ? 'rgba(245,158,11,0.5)' : 'rgba(34,211,238,0.5)'}`,
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 10,
            background: isAtk ? 'rgba(245,158,11,0.07)' : 'rgba(34,211,238,0.07)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: '1.2rem' }}>{dropEmoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: isAtk ? '#f59e0b' : '#22d3ee' }}>
                {lang === 'es' ? `DROP: NFTJI ${dropLabel.toUpperCase()}` : `DROP: ${dropLabel.toUpperCase()} NFTJI`}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 1 }}>
                {lang === 'es'
                  ? `Disponible para ${winnerWalletCount} wallet(s) ganadoras — reclama en tu fila`
                  : `Available for ${winnerWalletCount} winning wallet(s) — claim on your row`}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Wallet stats tables (not shown for proposing/cancelled) */}
      {(isRegistering || isBattleStart || isResolved) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { side: 'challenger', wallets: chWallets, color: '#22d3ee', pool: dispute.challenger_pool_code },
            { side: 'defender', wallets: dfWallets, color: '#f59e0b', pool: dispute.defender_pool_code },
          ].map(({ side, wallets, color, pool }) => (
            <div key={side} style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{ fontSize: '0.68rem', color, fontWeight: 700, marginBottom: 4, letterSpacing: '0.06em' }}>
                <PoolLink poolCode={pool} color={color} onPoolClick={onPoolClick} style={{ fontSize: '0.68rem' }} />
                {' '}({wallets.length}w)
              </div>
              {wallets.length === 0 ? (
                <div style={{ fontSize: '0.7rem', color: '#475569' }}>—</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {wallets.map((w) => {
                    const wColor = colorFromAddress(w.wallet);
                    const isMe = w.wallet === activeWallet;
                    const isWinnerDropWallet = isResolved && dispute.drop_type && w.side === dispute.winner;
                    const isAtkDrop = dispute.drop_type === 'attack';
                    const dropEmoji = isAtkDrop ? '⚔️' : '🛡️';
                    const dropColor = isAtkDrop ? '#f59e0b' : '#22d3ee';
                    const marketEmoji = w.market_nftji_emoji || emojiByWallet?.[w.wallet]?.emoji || emojiByWallet?.[w.wallet] || '';
                    const marketBlockKey = w.market_nftji_key || w.market_nftji_snap || emojiByWallet?.[w.wallet]?.blockKey || '';
                    const marketLabel = w.market_nftji_label || emojiByWallet?.[w.wallet]?.label || marketEmoji;
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
                        {w.nftji_snap > 0 && <span title={lang === 'es' ? `NFTJi poder total: ${w.nftji_snap}` : `NFTJi power: ${w.nftji_snap}`} style={{ color: '#22d3ee', fontFamily: 'monospace', fontSize: '0.65rem' }}>✦{w.nftji_snap}</span>}
                        {w.has_penalty && <span title={lang === 'es' ? 'Penalización activa' : 'Active penalty'}>⚠️</span>}
                        <MarketBlockLink
                          label={marketLabel}
                          emoji={marketEmoji}
                          blockKey={marketBlockKey}
                          onMarketBlockClick={onMarketBlockClick}
                          title={marketLabel ? `Market NFTJI — ${marketLabel}` : `Market NFTJI — ${marketEmoji}`}
                        />
                        {isWinnerDropWallet && (
                          isMe && !w.squeeze_nftji_claimed ? (
                            <button
                              type="button"
                              onClick={() => onClaimDrop(dispute.id)}
                              disabled={claimBusy === dispute.id}
                              title={lang === 'es' ? `Obtener NFTJI ${isAtkDrop ? 'Ataque' : 'Defensa'}` : `Claim ${isAtkDrop ? 'Attack' : 'Defense'} NFTJI`}
                              style={{
                                border: `1px solid ${dropColor}88`,
                                background: `${dropColor}1a`,
                                color: dropColor,
                                borderRadius: 4,
                                padding: '1px 5px',
                                fontFamily: 'monospace',
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                cursor: claimBusy === dispute.id ? 'wait' : 'pointer',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {dropEmoji} {claimBusy === dispute.id ? '...' : (lang === 'es' ? 'OBTENER' : 'CLAIM')}
                            </button>
                          ) : (
                            <span
                              title={w.squeeze_nftji_claimed
                                ? (lang === 'es' ? 'NFTJI reclamado' : 'NFTJI claimed')
                                : (lang === 'es' ? 'NFTJI disponible para esta wallet ganadora' : 'NFTJI available for this winning wallet')}
                              style={{
                                color: dropColor,
                                fontFamily: 'monospace',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                opacity: w.squeeze_nftji_claimed ? 0.55 : 1,
                              }}
                            >
                              {dropEmoji}{w.squeeze_nftji_claimed ? ' claimed' : ' drop'}
                            </span>
                          )
                        )}
                        {(() => {
                          const sn = sqzNftjiByWallet?.[w.wallet];
                          if (!sn?.equipped) return null;
                          const isAtk = sn.equipped === 'attack';
                          const lvl = isAtk ? sn.attack_level : sn.defense_level;
                          return (
                            <span
                              title={`Squeeze ${isAtk ? 'Attack' : 'Defense'} NFTJI — Lv${lvl}`}
                              style={{ fontSize: '0.75rem', opacity: 0.9 }}
                            >
                              {isAtk ? '⚔️' : '🛡️'}<span style={{ fontFamily: 'monospace', fontSize: '0.6rem', verticalAlign: 'super', color: isAtk ? '#f59e0b' : '#22d3ee' }}>{lvl}</span>
                            </span>
                          );
                        })()}
                        {isResolved && w.delta_eur !== 0 && (
                          <span style={{ marginLeft: 'auto', color: w.delta_eur > 0 ? '#4ade80' : '#f87171', fontFamily: 'monospace' }}>
                            {w.delta_eur > 0 ? '+' : ''}{formatEurAsCurrency(w.delta_eur, currency)}
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
              { label: `Σ${currency}`, ch: formatEurAsCurrency(dispute.ch_eur_sum, currency), df: formatEurAsCurrency(dispute.df_eur_sum, currency) },
              { label: 'NFTJIs', ch: dispute.ch_nftji_count, df: dispute.df_nftji_count },
              { label: 'Σ✦NFTJI', ch: chWallets.reduce((s, w) => s + (w.nftji_snap || 0), 0), df: dfWallets.reduce((s, w) => s + (w.nftji_snap || 0), 0) },
              { label: 'Mkt.NFTJI', ch: dispute.ch_market_nftji_count ?? '—', df: dispute.df_market_nftji_count ?? '—' },
              { label: '⚔️Σatk', ch: dispute.ch_squeeze_atk_sum ?? 0, df: dispute.df_squeeze_atk_sum ?? 0 },
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
              {' + '}
              <span style={{ color: '#f59e0b' }}>(⚔️Σatk/n)×20</span>
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
                <span style={{ color: '#94a3b8' }}>5% {currency} {lang === 'es' ? 'por wallet' : 'per wallet'}</span>
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

export default function DisputesPanel({ wallet, poolCode, language, onWalletClick, onPoolClick, onMarketBlockClick }) {
  const lang = language === 'es' ? 'es' : 'en';
  const { currency } = useCurrency();
  const [disputes, setDisputes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [claimBusy, setClaimBusy] = useState(null);
  const [emojiByWallet, setEmojiByWallet] = useState({});
  const [sqzNftjiByWallet, setSqzNftjiByWallet] = useState({});
  const pollingRef = useRef(null);
  const transitioningRef = useRef(new Set());
  const notifiedResolvedRef = useRef(new Set());
  const firstFetchRef = useRef(true);

  const notifyResolvedSqueezes = useCallback((disputeList) => {
    const resolved = (disputeList || []).filter((d) => d.status === 'resolved');
    if (firstFetchRef.current) {
      for (const d of resolved) notifiedResolvedRef.current.add(d.id);
      firstFetchRef.current = false;
      return;
    }

    for (const d of resolved) {
      if (notifiedResolvedRef.current.has(d.id)) continue;
      notifiedResolvedRef.current.add(d.id);
      const winnerPool = d.winner === 'challenger'
        ? d.challenger_pool_code
        : d.winner === 'defender'
          ? d.defender_pool_code
          : '';
      const loserPool = d.winner === 'challenger'
        ? d.defender_pool_code
        : d.winner === 'defender'
          ? d.challenger_pool_code
          : '';
      const msg = d.winner === 'draw'
        ? {
            en: `FREAK SIGNAL :: SQUEEZE DRAW ${d.challenger_pool_code} VS ${d.defender_pool_code}`,
            es: `FREAK SIGNAL :: EMPATE SQUEEZE ${d.challenger_pool_code} VS ${d.defender_pool_code}`,
          }
        : {
            en: `FREAK SIGNAL :: ${winnerPool} WON SQUEEZE VS ${loserPool}`,
            es: `FREAK SIGNAL :: ${winnerPool} GANA SQUEEZE VS ${loserPool}`,
          };
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type: 'success' } }));
      }
    }
  }, []);

  // Client-side Market NFTJI emoji lookup (direct Supabase — same as Leaderboard)
  const refreshEmojis = useCallback(async (disputeList) => {
    const allWallets = [...new Set(disputeList.flatMap((d) => (d.wallets || []).map((w) => w.wallet)))];
    if (!allWallets.length) return;
    const [{ data: progress }, { data: blocks }] = await Promise.all([
      supabase.from('player_progress').select('wallet, market_nftji_key').in('wallet', allWallets).not('market_nftji_key', 'is', null),
      supabase.from('mm3_market_blocks').select('block_key, emoji, grid_row, grid_col'),
    ]);
    const infoByKey = new Map((blocks || []).map((b) => {
      const hex = b.grid_row != null && b.grid_col != null
        ? `#${((Number(b.grid_row) || 0) * 28 + (Number(b.grid_col) || 0)).toString(16).toUpperCase().padStart(3, '0')}`
        : '';
      return [b.block_key, {
        emoji: b.emoji,
        label: `${b.emoji || ''}${hex ? ` ${hex}` : ''}`.trim(),
      }];
    }));
    const map = {};
    for (const p of progress || []) {
      const info = infoByKey.get(p.market_nftji_key);
      if (info?.emoji) map[p.wallet] = { emoji: info.emoji, label: info.label, blockKey: p.market_nftji_key };
    }
    setEmojiByWallet(map);
  }, []);

  // Client-side Squeeze NFTJI lookup (equipped type + levels per wallet)
  const refreshSqueezeNftji = useCallback(async (disputeList) => {
    const allWallets = [...new Set(disputeList.flatMap((d) => (d.wallets || []).map((w) => w.wallet)))];
    if (!allWallets.length) return;
    const { data } = await supabase
      .from('mm3_squeeze_nftji')
      .select('wallet, equipped, attack_level, defense_level')
      .in('wallet', allWallets);
    const map = {};
    for (const n of data || []) map[n.wallet] = n;
    setSqzNftjiByWallet(map);
  }, []);

  const fetchDisputes = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet-pools/disputes?limit=50');
      const data = await res.json();
      if (data.ok) {
        const nextDisputes = data.disputes || [];
        setDisputes(nextDisputes);
        notifyResolvedSqueezes(nextDisputes);
        refreshEmojis(nextDisputes);
        refreshSqueezeNftji(nextDisputes);
      } else setError(data.error || 'fetch_error');
    } catch {
      setError('network_error');
    } finally {
      setIsLoading(false);
    }
  }, [notifyResolvedSqueezes, refreshEmojis, refreshSqueezeNftji]);


  // Poll every 3 seconds; trigger state transitions when timers expire
  const checkTransitions = useCallback(async (disputeList) => {
    const now = Date.now();
    for (const d of disputeList) {
      if (transitioningRef.current.has(d.id)) continue;

      if (d.status === 'proposing') {
        const deadline = new Date(d.registered_at).getTime() + 5 * 60 * 1000;
        if (now >= deadline) {
          transitioningRef.current.add(d.id);
          fetch('/api/wallet-pools/dispute/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disputeId: d.id }),
          }).then(() => {
            transitioningRef.current.delete(d.id);
            fetchDisputes();
          }).catch(() => transitioningRef.current.delete(d.id));
        }
      } else if (d.status === 'registering') {
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

  async function handleClaimDrop(disputeId) {
    if (!wallet || claimBusy) return;
    setClaimBusy(disputeId);
    try {
      const res = await fetch('/api/wallet-pools/dispute/claim-nftji-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disputeId, wallet }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data?.error || 'claim_failed';
        window.dispatchEvent(new CustomEvent('mm3-toast', {
          detail: {
            msg: {
              en: `NFTJI claim failed :: ${msg}`,
              es: `Fallo al reclamar NFTJI :: ${msg}`,
            },
            type: 'error',
          },
        }));
        return;
      }
      const emoji = data.drop_type === 'attack' ? '⚔️' : '🛡️';
      const level = data.drop_type === 'attack' ? data.attack_level : data.defense_level;
      window.dispatchEvent(new CustomEvent('mm3-toast', {
        detail: {
          msg: {
            en: `${emoji} NFTJI claimed :: Lv${level}`,
            es: `${emoji} NFTJI reclamado :: Lv${level}`,
          },
          type: 'success',
        },
      }));
      await fetchDisputes();
    } catch {
      window.dispatchEvent(new CustomEvent('mm3-toast', {
        detail: {
          msg: {
            en: 'NFTJI claim failed :: network',
            es: 'Fallo al reclamar NFTJI :: red',
          },
          type: 'error',
        },
      }));
    } finally {
      setClaimBusy(null);
    }
  }

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

  const activeDisputes = disputes
    .filter((d) => !['resolved', 'cancelled'].includes(d.status))
    .sort((a, b) => getDisputeSortMs(b) - getDisputeSortMs(a));
  const historyDisputes = disputes
    .filter((d) => ['resolved', 'cancelled'].includes(d.status))
    .sort((a, b) => getDisputeSortMs(b) - getDisputeSortMs(a));

  if (isLoading) {
    return (
      <div style={{ padding: 16, color: '#475569', fontSize: '0.8rem', textAlign: 'center' }}>
        {lang === 'es' ? 'Cargando squeezes…' : 'Loading squeezes…'}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: '#f87171', fontSize: '0.8rem' }}>
        {lang === 'es' ? 'Error cargando squeezes' : 'Error loading squeezes'}
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
        {'SQUEEZE'}
        <span style={{ marginLeft: 10, color: '#334155' }}>
          {activeDisputes.length > 0 ? `${activeDisputes.length} ${lang === 'es' ? 'activo(s)' : 'active'}` : lang === 'es' ? 'sin combates activos' : 'none active'}
        </span>
      </div>

      {activeDisputes.length === 0 && historyDisputes.length === 0 && (
        <div style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'center', padding: '24px 0' }}>
          {lang === 'es' ? 'Sin combates registrados todavía.' : 'No Squeeze battles yet.'}
        </div>
      )}

      {activeDisputes.map((d) => (
        <DisputeCard
          key={d.id}
          dispute={d}
          activeWallet={wallet}
          poolCode={poolCode}
          language={language}
          currency={currency}
          onJoin={handleJoin}
          onClaimDrop={handleClaimDrop}
          claimBusy={claimBusy}
          onWalletClick={onWalletClick}
          onPoolClick={onPoolClick}
          onMarketBlockClick={onMarketBlockClick}
          emojiByWallet={emojiByWallet}
          sqzNftjiByWallet={sqzNftjiByWallet}
        />
      ))}

      {historyDisputes.length > 0 && (
        <>
          <div style={{ fontSize: '0.68rem', color: '#334155', letterSpacing: '0.08em', marginTop: 8, marginBottom: 8 }}>
            {lang === 'es' ? 'HISTORIAL' : 'HISTORY'}
          </div>
          {historyDisputes.slice(0, 20).map((d) => (
            <DisputeCard
              key={d.id}
              dispute={d}
              activeWallet={wallet}
              poolCode={poolCode}
              language={language}
              currency={currency}
              onJoin={handleJoin}
              onClaimDrop={handleClaimDrop}
              claimBusy={claimBusy}
              onWalletClick={onWalletClick}
              onPoolClick={onPoolClick}
              onMarketBlockClick={onMarketBlockClick}
              emojiByWallet={emojiByWallet}
              sqzNftjiByWallet={sqzNftjiByWallet}
            />
          ))}
        </>
      )}
    </div>
  );
}
