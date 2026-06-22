'use client';

import { useEffect, useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n-context';
import { colorFromPool, colorFromAddress } from '@/lib/wallet-colors';

const SQUEEZE_LAUNCH_LIMIT = 5;
const SQUEEZE_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatResetCountdown(resetAt, nowMs) {
  if (!resetAt) return '';
  const ms = new Date(resetAt).getTime() - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export default function PoolSqueezeList({ wallet }) {
  const { language } = useI18n();
  const es = language === 'es';
  const [pools, setPools] = useState([]);
  const [myPool, setMyPool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disputeBusy, setDisputeBusy] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const labels = es
    ? {
        squeeze: 'SQUEEZE',
        squeezeTitle: 'Squeeze a este pool',
        squeezeLimit: 'Límite de 5 Squeezes en 24h alcanzado.',
        squeezeDone: 'Squeeze iniciado',
        squeezeProposed: 'Propuesta enviada — esperando otra wallet del pool',
        squeezeError: 'Error en squeeze',
        squeezeAlready: 'Ya propusiste o hay squeeze activa',
        poolLocked: 'Pool bloqueado por una Squeeze activa.',
        myPool: 'mi pool',
        activePools: 'Pools activos',
        limit: 'LÍMITE',
      }
    : {
        squeeze: 'SQUEEZE',
        squeezeTitle: 'Squeeze this pool',
        squeezeLimit: '5 Squeezes per 24h limit reached.',
        squeezeDone: 'Squeeze started',
        squeezeProposed: 'Proposal sent — waiting for another pool wallet',
        squeezeError: 'Squeeze error',
        squeezeAlready: 'Already proposed or squeeze active',
        poolLocked: 'Pool locked by an active Squeeze.',
        myPool: 'my pool',
        activePools: 'Active pools',
        limit: 'LIMIT',
      };

  const fetchData = useCallback(async () => {
    try {
      const [poolsRes, myPoolRes] = await Promise.all([
        fetch('/api/pools-quick').then((r) => r.json()),
        wallet
          ? fetch(`/api/wallet-pools/my-pool?wallet=${encodeURIComponent(wallet)}`).then((r) =>
              r.json()
            )
          : Promise.resolve({ pool_code: null }),
      ]);
      if (poolsRes.ok) setPools(poolsRes.pools || []);
      setMyPool(
        myPoolRes.pool_code ? String(myPoolRes.pool_code).toUpperCase() : null
      );
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 120_000);
    return () => clearInterval(t);
  }, [fetchData]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSqueeze = async (defenderPool) => {
    if (!wallet || !myPool || disputeBusy) return;
    const myPoolData = pools.find((p) => p.pool_code === myPool);
    if (myPoolData?.squeeze_limit_reached) {
      window.dispatchEvent(
        new CustomEvent('mm3-toast', {
          detail: {
            msg: `${labels.squeezeLimit}${myPoolData.reset_at ? ` ${formatResetCountdown(myPoolData.reset_at, nowMs)}` : ''}`,
            type: 'error',
          },
        })
      );
      return;
    }
    setDisputeBusy(defenderPool);
    try {
      const response = await fetch('/api/wallet-pools/dispute/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, challengerPool: myPool, defenderPool }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const errKey =
          payload.error === 'squeeze_limit_reached'
            ? 'squeezeLimit'
            : payload.error === 'already_voted' || payload.error === 'dispute_already_active'
            ? 'squeezeAlready'
            : 'squeezeError';
        window.dispatchEvent(
          new CustomEvent('mm3-toast', { detail: { msg: labels[errKey], type: 'error' } })
        );
        return;
      }
      const msg =
        payload.proposing && !payload.created ? labels.squeezeProposed : labels.squeezeDone;
      window.dispatchEvent(
        new CustomEvent('mm3-toast', { detail: { msg, type: 'success' } })
      );
      fetchData();
    } catch {
      window.dispatchEvent(
        new CustomEvent('mm3-toast', { detail: { msg: labels.squeezeError, type: 'error' } })
      );
    } finally {
      setDisputeBusy('');
    }
  };

  if (loading || !pools.length) return null;

  const myPoolData = myPool ? pools.find((p) => p.pool_code === myPool) : null;
  const myLimitReached = myPoolData?.squeeze_limit_reached || false;
  const myResetAt = myPoolData?.reset_at || null;

  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center gap-2 px-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-slate-600">
        <span>{labels.activePools} · {pools.length}</span>
        {myLimitReached && myResetAt && (
          <span className="text-red-500">
            {labels.limit} {formatResetCountdown(myResetAt, nowMs)}
          </span>
        )}
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
        {pools.map((pool) => {
          const isMyPool = pool.pool_code === myPool;
          const poolColor = colorFromPool(pool.pool_code);
          const canSqueeze = !!wallet && !!myPool && !isMyPool;
          const busy = disputeBusy === pool.pool_code;

          return (
            <div
              key={pool.pool_code}
              className="rounded font-mono"
              style={{
                border: `1px solid ${isMyPool ? `${poolColor}55` : '#1e293b'}`,
                background: isMyPool ? `${poolColor}0d` : '#080808',
                padding: '0.5rem 0.625rem',
              }}
            >
              {/* header */}
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  className="font-black"
                  style={{ color: poolColor, fontSize: '0.85rem', letterSpacing: '0.05em' }}
                >
                  #{pool.pool_code}
                </span>
                {isMyPool && (
                  <span
                    className="rounded px-1 text-[0.52rem] uppercase tracking-[0.1em]"
                    style={{
                      color: poolColor,
                      border: `1px solid ${poolColor}44`,
                    }}
                  >
                    {labels.myPool}
                  </span>
                )}
                <span className="ml-auto text-[0.58rem] text-slate-600">
                  {pool.member_count}w
                </span>
              </div>

              {/* stats row */}
              <div className="mb-1.5 flex gap-3 text-[0.6rem] text-slate-500">
                <span>
                  <span className="text-slate-600">LVL </span>
                  <span className="font-bold text-slate-400">{pool.total_level}</span>
                </span>
                <span>
                  <span className="text-slate-600">CHAIN </span>
                  <span className="font-bold text-slate-400">
                    {Number(pool.block_chain_percent || 0).toFixed(1)}%
                  </span>
                </span>
                {pool.squeeze_count > 0 && (
                  <span className="text-red-400">
                    ⚔ {pool.squeeze_count}/{SQUEEZE_LAUNCH_LIMIT}
                  </span>
                )}
              </div>

              {/* wallet chips */}
              <div className="mb-1.5 flex flex-wrap gap-1">
                {pool.member_wallets_short.map((short, i) => {
                  const wColor = colorFromAddress(pool.member_wallets[i] || short);
                  return (
                    <span
                      key={pool.member_wallets[i] || i}
                      className="rounded px-1.5 py-0.5 text-[0.58rem]"
                      style={{
                        color: wColor,
                        background: '#0f172a',
                        border: `1px solid ${wColor}22`,
                      }}
                    >
                      {short}
                    </span>
                  );
                })}
              </div>

              {/* squeeze button — only for other pools when wallet has a pool */}
              {canSqueeze && (
                <button
                  type="button"
                  onClick={() => handleSqueeze(pool.pool_code)}
                  disabled={busy || myLimitReached}
                  title={
                    myLimitReached
                      ? `${labels.squeezeLimit}${myResetAt ? ` ${formatResetCountdown(myResetAt, nowMs)}` : ''}`
                      : labels.squeezeTitle
                  }
                  className="mt-0.5 w-full rounded border px-2 py-1 text-[0.6rem] font-black uppercase tracking-[0.14em] transition"
                  style={{
                    borderColor:
                      busy || myLimitReached ? '#f871711a' : '#f8717144',
                    background:
                      busy || myLimitReached ? 'transparent' : '#7f1d1d10',
                    color: busy || myLimitReached ? '#4b5563' : '#fca5a5',
                    cursor: busy || myLimitReached ? 'not-allowed' : 'pointer',
                  }}
                >
                  {busy ? '...' : `⚔ ${labels.squeeze}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
