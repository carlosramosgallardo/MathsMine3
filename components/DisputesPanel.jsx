'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { colorFromAddress, colorFromPool } from '@/lib/wallet-colors';
import supabase from '@/lib/supabaseClient';
import { useCurrency } from '@/lib/currency-context';
import { CNY_TO_EUR, CNY_TO_USD, formatMoney } from '@/lib/sell-offer';
import { formatWalletLabel } from '@/lib/wallet-format';

const STATUS_LABELS = {
  proposing:    { es: 'PROPUESTA',      en: 'PROPOSAL',     color: '#64748b' },
  registering:  { es: 'REGISTRANDO',    en: 'REGISTERING',  color: '#22d3ee' },
  battle_start: { es: 'INICIO DISPUTA', en: 'BATTLE START', color: '#22d3ee' },
  resolved:     { es: 'RESUELTO',       en: 'RESOLVED',     color: '#4ade80' },
  cancelled:    { es: 'CANCELADO',      en: 'CANCELLED',    color: '#334155' },
};

const WINNER_LABELS = {
  challenger: { es: 'ATACANTE', en: 'CHALLENGER' },
  defender: { es: 'DEFENSOR', en: 'DEFENDER' },
  draw: { es: 'EMPATE', en: 'DRAW' },
};

const DISPUTE_FETCH_LIMIT = 500;
const HISTORY_PAGE_SIZE = 10;

function fmt(n, dec = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(dec);
}

function squeezeScoreTerms(dispute, side) {
  const prefix = side === 'challenger' ? 'ch' : 'df';
  const n = Math.max(1, Number(dispute?.[`${prefix}_wallet_count`]) || 0);
  const level = ((Number(dispute?.[`${prefix}_level_sum`]) || 0) / n) * 40;
  const mm3 = Math.log(((Number(dispute?.[`${prefix}_mm3_sum`]) || 0) / n) + 1) * 20;
  const execs = ((Number(dispute?.[`${prefix}_exec_count`]) || 0) / n) * 12;
  const nftjis = ((Number(dispute?.[`${prefix}_nftji_count`]) || 0) / n) * 8;
  const market = ((Number(dispute?.[`${prefix}_mining_nftji_count`]) || 0) / n) * 15;
  const attack = ((Number(dispute?.[`${prefix}_squeeze_atk_sum`]) || 0) / n) * 20;
  const penalty = -((Number(dispute?.[`${prefix}_penalty_count`]) || 0) / n) * 20;
  const base = level + mm3 + execs + nftjis + market + attack + penalty;
  return { level, mm3, execs, nftjis, market, attack, penalty, base };
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
  if (!ms) return '--';
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
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
    <div style={{ margin: '8px 0', background: 'rgba(255,255,255,0.07)', borderRadius: 0, height: 8, overflow: 'hidden' }}>
      <div style={{ width: `${chPct}%`, height: '100%', background: '#22d3ee', transition: 'width 0.8s' }} />
    </div>
  );
}

function PoolLink({ poolCode, onPoolClick, children, style }) {
  const color = colorFromPool(String(poolCode || ''));
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

function NftjiLevelSlot({ emoji, color, level, title, onClick, empty = false }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      style={{
        width: '1.5rem',
        height: '1.5rem',
        border: `1px solid ${empty ? `${color}33` : `${color}99`}`,
        borderRadius: 0,
        background: empty ? 'rgba(2,6,23,0.4)' : `${color}18`,
        color: empty ? 'rgba(100,116,139,0.35)' : color,
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace',
        fontWeight: 800,
        lineHeight: 1,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: empty ? 'none' : `0 0 8px ${color}25`,
        padding: 0,
      }}
    >
      <span style={{ fontSize: empty ? '0.88rem' : '0.72rem', lineHeight: 1 }}>{empty ? '' : emoji}</span>
      {!empty && <span style={{ fontSize: '0.48rem', lineHeight: 1, marginTop: 1 }}>{Math.max(0, Number(level) || 0)}</span>}
    </Tag>
  );
}

function MarketBlockLink({ label, emoji, blockKey, level = 0, onMarketBlockClick, title }) {
  const display = label || emoji;
  if (!display) return null;
  return (
    <NftjiLevelSlot
      emoji={emoji}
      color="#facc15"
      level={level}
      title={`${title || blockKey || emoji} · Lv.${Math.max(0, Number(level) || 0)}`}
      onClick={blockKey && onMarketBlockClick ? () => onMarketBlockClick(blockKey) : null}
    />
  );
}

function SqueezeDropSlot({ emoji, color, level, claimable, claimed, busy, lang, onClaim }) {
  const title = claimed
    ? (lang === 'es' ? `NFTJI Squeeze reclamado · Lv.${level}` : `Squeeze NFTJI claimed · Lv.${level}`)
    : claimable
      ? (lang === 'es' ? `Pulsa para obtener NFTJI Squeeze · Lv.${level}` : `Click to claim Squeeze NFTJI · Lv.${level}`)
      : (lang === 'es' ? `NFTJI Squeeze disponible para wallets ganadoras · Lv.${level}` : `Squeeze NFTJI available for winning wallets · Lv.${level}`);
  const Tag = claimable ? 'button' : 'span';
  return (
    <Tag
      type={claimable ? 'button' : undefined}
      onClick={claimable ? onClaim : undefined}
      disabled={claimable ? busy : undefined}
      title={title}
      style={{
        width: '1.5rem',
        height: '1.5rem',
        border: `1px solid ${color}${claimable ? 'aa' : '66'}`,
        borderRadius: 0,
        background: claimed ? 'rgba(2,6,23,0.42)' : `${color}18`,
        color,
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace',
        fontWeight: 800,
        lineHeight: 1,
        cursor: claimable ? (busy ? 'wait' : 'pointer') : 'default',
        opacity: claimed ? 0.55 : 1,
        boxShadow: claimable ? `0 0 10px ${color}33` : 'none',
      }}
    >
      <span style={{ fontSize: '0.82rem', lineHeight: 1 }}>{busy ? '...' : emoji}</span>
      <span style={{ fontSize: '0.45rem', lineHeight: 1, marginTop: 1 }}>{level}</span>
    </Tag>
  );
}

function DisputeCard({ dispute, activeWallet, poolCode, language, currency, onJoin, onClaimDrop, claimBusy, onWalletClick, onPoolClick, onMarketBlockClick, emojiByWallet, sqzNftjiByWallet, collapsed, onToggle }) {
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
  const chTerms = squeezeScoreTerms(dispute, 'challenger');
  const dfTerms = squeezeScoreTerms(dispute, 'defender');

  const winnerColor =
    winner === 'draw' ? '#94a3b8'
    : winner === 'challenger' ? '#22d3ee'
    : '#f59e0b';

  if (collapsed) {
    const icon = isCancelled ? '💨' : dispute.winner === 'draw' ? '⚖️' : dispute.winner === 'challenger' ? '🏆' : '🛡️';
    const chScore = Number(dispute.ch_score || 0);
    const dfScore = Number(dispute.df_score || 0);
    const transfer = dispute.result_summary?.transfer_eur;
    return (
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          textAlign: 'left',
          border: `1px solid ${statusMeta.color}33`,
          borderRadius: 0,
          padding: '6px 10px',
          marginBottom: 6,
          background: 'rgba(2,6,23,0.5)',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: '0.7rem',
          color: '#64748b',
        }}
      >
        <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{icon}</span>
        <span style={{ color: '#22d3ee', fontWeight: 700 }}>{dispute.challenger_pool_code}</span>
        <span style={{ color: '#475569' }}>vs</span>
        <span style={{ color: '#f59e0b', fontWeight: 700 }}>{dispute.defender_pool_code}</span>
        {!isCancelled && (
          <>
            <span style={{ color: '#334155', marginLeft: 4 }}>·</span>
            <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{fmt(chScore, 2)} – {fmt(dfScore, 2)}</span>
          </>
        )}
        {transfer > 0 && (
          <>
            <span style={{ color: '#334155' }}>·</span>
            <span style={{ color: '#4ade80' }}>+{formatEurAsCurrency(transfer, currency)}</span>
          </>
        )}
        <span style={{ marginLeft: 'auto', color: '#334155', fontSize: '0.65rem' }}>{formatUtc(trace.value)}</span>
        <span style={{ color: '#475569', fontSize: '0.65rem', flexShrink: 0 }}>▼</span>
      </button>
    );
  }

  return (
    <div style={{
      border: `1px solid ${statusMeta.color}44`,
      borderRadius: 0,
      padding: '14px 16px',
      marginBottom: 12,
      background: 'rgba(2,6,23,0.7)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <PoolLink poolCode={dispute.challenger_pool_code} color="#22d3ee" onPoolClick={onPoolClick} style={{ fontSize: '0.95rem' }} />
        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>vs</span>
        <PoolLink poolCode={dispute.defender_pool_code} color="#f59e0b" onPoolClick={onPoolClick} style={{ fontSize: '0.95rem' }} />
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: statusMeta.color,
          border: `1px solid ${statusMeta.color}66`,
          borderRadius: 0,
          padding: '1px 7px',
        }}>
          {statusMeta[lang]}
        </span>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            title={lang === 'es' ? 'Colapsar' : 'Collapse'}
            style={{
              background: 'none',
              border: 'none',
              color: '#334155',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              padding: '0 2px',
              flexShrink: 0,
            }}
          >▲</button>
        )}
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
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
            {lang === 'es'
              ? 'esperando a una wallet más del pool o se cancelará en'
              : 'waiting for another wallet from the pool or cancels in'}
          </span>
          <CountdownBadge targetMs={proposalDeadline} color="#64748b" />
        </div>
      )}

      {/* Cancelled: failed attempt banner */}
      {isCancelled && (
        <div style={{
          border: '1px solid rgba(71,85,105,0.4)',
          borderRadius: 0,
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
                borderRadius: 0,
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
            { emoji: '🔥', val: `${fmt(dispute.war_percent, 0)}%` },
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
          borderRadius: 0,
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
                    const currentDropLevelRaw = Number(isAtkDrop
                      ? sqzNftjiByWallet?.[w.wallet]?.attack_level
                      : sqzNftjiByWallet?.[w.wallet]?.defense_level) ?? -1;
                    const currentDropLevel = Math.max(0, Number.isFinite(currentDropLevelRaw) ? currentDropLevelRaw : -1);
                    const visibleDropLevel = w.squeeze_nftji_claimed
                      ? currentDropLevel
                      : Math.max(0, (Number.isFinite(currentDropLevelRaw) ? currentDropLevelRaw : -1) + 1);
                    const marketEmoji = w.mining_nftji_emoji || emojiByWallet?.[w.wallet]?.emoji || emojiByWallet?.[w.wallet] || '';
                    const marketBlockKey = w.mining_nftji_key || w.mining_nftji_snap || emojiByWallet?.[w.wallet]?.blockKey || '';
                    const marketLabel = w.mining_nftji_label || emojiByWallet?.[w.wallet]?.label || marketEmoji;
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
                          {formatWalletLabel(w.wallet)}
                        </button>
                        <span style={{ color: '#64748b' }}>Lv{w.level_snap}</span>
                        {w.nftji_snap > 0 && <span title={lang === 'es' ? `NFTJi poder total: ${w.nftji_snap}` : `NFTJi power: ${w.nftji_snap}`} style={{ color: '#22d3ee', fontFamily: 'monospace', fontSize: '0.65rem' }}>✦{w.nftji_snap}</span>}
                        {w.has_penalty && <span title={lang === 'es' ? 'Penalización activa' : 'Active penalty'}>⚠️</span>}
                        <MarketBlockLink
                          label={marketLabel}
                          emoji={marketEmoji}
                          blockKey={marketBlockKey}
                          level={w.mining_nftji_level_snap}
                          onMarketBlockClick={onMarketBlockClick}
                          title={marketLabel ? `Mining NFTJI — ${marketLabel}` : `Mining NFTJI — ${marketEmoji}`}
                        />
                        {isWinnerDropWallet && (
                          <SqueezeDropSlot
                            emoji={dropEmoji}
                            color={dropColor}
                            level={visibleDropLevel}
                            claimable={isMe && !w.squeeze_nftji_claimed}
                            claimed={w.squeeze_nftji_claimed}
                            busy={claimBusy === dispute.id}
                            lang={lang}
                            onClaim={() => onClaimDrop(dispute.id)}
                          />
                        )}
                        {(() => {
                          const sn = sqzNftjiByWallet?.[w.wallet];
                          if (!sn?.equipped) return null;
                          const isAtk = sn.equipped === 'attack';
                          const lvl = isAtk ? sn.attack_level : sn.defense_level;
                          return (
                            <NftjiLevelSlot
                              emoji={isAtk ? '⚔️' : '🛡️'}
                              color={isAtk ? '#f59e0b' : '#22d3ee'}
                              level={lvl}
                              title={`Squeeze ${isAtk ? 'Attack' : 'Defense'} NFTJI — Lv.${Math.max(0, Number(lvl) || 0)}`}
                            />
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
              { label: 'Mkt.NFTJI', ch: dispute.ch_mining_nftji_count ?? '—', df: dispute.df_mining_nftji_count ?? '—' },
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
            borderRadius: 0,
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
              {' = base × (1+(🔥-50)/100×0.30) × (1+(50-🌪️)/100×0.20) × (1+🎲×0.30)'}
            </div>
            <div>
              <span style={{ color: '#64748b' }}>🛡️ score</span>
              {' = base × (1+(50-🔥)/100×0.30) × (1+(🌪️-50)/100×0.20) × (1-🎲×0.30)'}
            </div>
            <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
              {[
                { color: '#22d3ee', pool: dispute.challenger_pool_code, terms: chTerms },
                { color: '#f59e0b', pool: dispute.defender_pool_code, terms: dfTerms },
              ].map(({ color, pool, terms }) => (
                <div key={pool} style={{ color: '#475569' }}>
                  <span style={{ color }}>{pool}</span>
                  {' base = '}
                  <span title="(Σlevel/n)×40">lvl {fmt(terms.level, 2)}</span>
                  {' + '}
                  <span title="ln(ΣMM3/n+1)×20">mm3 {fmt(terms.mm3, 2)}</span>
                  {' + '}
                  <span title="(EXECs/n)×12">exec {fmt(terms.execs, 2)}</span>
                  {' + '}
                  <span title="(NFTJIs/n)×8">nftji {fmt(terms.nftjis, 2)}</span>
                  {' + '}
                  <span title="(Mining NFTJI power/n)×15">mining {fmt(terms.market, 2)}</span>
                  {' + '}
                  <span title="(Squeeze attack power/n)×20">atk {fmt(terms.attack, 2)}</span>
                  {' '}
                  <span title="-(penalties/n)×20">pen {fmt(terms.penalty, 2)}</span>
                  {' = '}
                  <span style={{ color: '#94a3b8' }}>{fmt(terms.base, 2)}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 5, color: '#334155' }}>
              {lang === 'es'
                ? 'Execs = total histórico de operaciones Trade MM3 (mm3_sell_transactions) capturado en el snapshot.'
                : 'Execs = all-time Trade MM3 operations (mm3_sell_transactions) captured in the snapshot.'}
            </div>
            <div style={{ marginTop: 3, color: '#334155' }}>
              {lang === 'es'
                ? `🔥${fmt(dispute.war_percent,0)}% 🌪️${fmt(dispute.nature_percent,0)}% 🎲${fmt(dispute.dice_modifier,4)} → ⚔️${fmt(dispute.ch_score,4)} vs 🛡️${fmt(dispute.df_score,4)}`
                : `🔥${fmt(dispute.war_percent,0)}% 🌪️${fmt(dispute.nature_percent,0)}% 🎲${fmt(dispute.dice_modifier,4)} → ⚔️${fmt(dispute.ch_score,4)} vs 🛡️${fmt(dispute.df_score,4)}`
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
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState(new Set());
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
      supabase.from('player_progress').select('wallet, mining_nftji_key').in('wallet', allWallets).not('mining_nftji_key', 'is', null),
      supabase.from('mm3_mining_blocks').select('block_key, emoji, grid_row, grid_col'),
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
      const info = infoByKey.get(p.mining_nftji_key);
      if (info?.emoji) map[p.wallet] = { emoji: info.emoji, label: info.label, blockKey: p.mining_nftji_key };
    }
    setEmojiByWallet(map);
  }, []);

  // Client-side Squeeze NFTJI lookup (equipped type + levels per wallet)
  const refreshSqueezeNftji = useCallback(async (disputeList) => {
    const allWallets = [...new Set(disputeList.flatMap((d) => (d.wallets || []).map((w) => w.wallet)))];
    if (!allWallets.length) return;
    const { data } = await supabase
      .from('mm3_squeezing_nftji')
      .select('wallet, equipped, attack_level, defense_level')
      .in('wallet', allWallets);
    const map = {};
    for (const n of data || []) map[n.wallet] = n;
    setSqzNftjiByWallet(map);
  }, []);

  const fetchDisputes = useCallback(async () => {
    try {
      const res = await fetch(`/api/wallet-pools/disputes?limit=${DISPUTE_FETCH_LIMIT}`);
      const data = await res.json();
      if (data.ok) {
        const nextDisputes = data.disputes || [];
        setDisputes(nextDisputes);
        notifyResolvedSqueezes(nextDisputes);
        refreshEmojis(nextDisputes);
        refreshSqueezeNftji(nextDisputes);
        return nextDisputes;
      } else setError(data.error || 'fetch_error');
    } catch {
      setError('network_error');
    } finally {
      setIsLoading(false);
    }
    return [];
  }, [notifyResolvedSqueezes, refreshEmojis, refreshSqueezeNftji]);


  // Active battles stay responsive; idle pages back off to protect API/DB egress.
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
    let cancelled = false;
    const poll = async () => {
      const latest = await fetchDisputes();
      if (cancelled) return;
      const hasLiveTransition = latest.some((entry) =>
        ['registering', 'battle_start'].includes(entry.status)
      );
      const hasProposal = latest.some((entry) => entry.status === 'proposing');
      const delay = document.hidden ? 60_000 : hasLiveTransition ? 3_000 : hasProposal ? 10_000 : 30_000;
      pollingRef.current = setTimeout(poll, delay);
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(pollingRef.current);
    };
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
      localStorage.setItem('lb_dirty_at', String(Date.now()));
      window.dispatchEvent(new CustomEvent('mm3-db-updated'));
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
  const historyTotalPages = Math.max(1, Math.ceil(historyDisputes.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const visibleHistoryDisputes = historyDisputes.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE
  );

  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

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
      {activeDisputes.length > 0 && (
        <div style={{
          fontFamily: 'monospace',
          fontSize: '0.7rem',
          color: '#22d3ee',
          letterSpacing: '0.1em',
          marginBottom: 14,
          borderBottom: '1px solid rgba(71,85,105,0.3)',
          paddingBottom: 6,
        }}>
          {activeDisputes.length} {lang === 'es' ? 'activo(s)' : 'active'}
        </div>
      )}

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
          {visibleHistoryDisputes.map((d) => (
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
              collapsed={!expandedHistoryIds.has(d.id)}
              onToggle={() => setExpandedHistoryIds((prev) => {
                const next = new Set(prev);
                if (next.has(d.id)) next.delete(d.id);
                else next.add(d.id);
                return next;
              })}
            />
          ))}
          {historyTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', margin: '12px 0 4px' }}>
              <button
                type="button"
                onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                disabled={safeHistoryPage <= 1}
                style={{
                  border: '1px solid rgba(34,211,238,0.35)',
                  borderRadius: 0,
                  background: 'rgba(2,6,23,0.7)',
                  color: '#22d3ee',
                  padding: '3px 9px',
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  cursor: safeHistoryPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: safeHistoryPage <= 1 ? 0.35 : 1,
                }}
              >
                {'<'}
              </button>
              <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                {safeHistoryPage}/{historyTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setHistoryPage((page) => Math.min(historyTotalPages, page + 1))}
                disabled={safeHistoryPage >= historyTotalPages}
                style={{
                  border: '1px solid rgba(34,211,238,0.35)',
                  borderRadius: 0,
                  background: 'rgba(2,6,23,0.7)',
                  color: '#22d3ee',
                  padding: '3px 9px',
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  cursor: safeHistoryPage >= historyTotalPages ? 'not-allowed' : 'pointer',
                  opacity: safeHistoryPage >= historyTotalPages ? 0.35 : 1,
                }}
              >
                {'>'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
