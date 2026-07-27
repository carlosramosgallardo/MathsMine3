'use client';

import { useEffect, useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n-context';
import { colorFromPool, colorFromAddress } from '@/lib/wallet-colors';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { apiFetch, ensureWalletSession } from '@/lib/wallet-session-client';

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
  const { isVirtualWallet } = useActiveWallet();
  const es = language === 'es';
  const [pools, setPools] = useState([]);
  const [myPool, setMyPool] = useState(null);
  const [pendingAccept, setPendingAccept] = useState({}); // defenderPool -> { id, votes }
  const [loading, setLoading] = useState(true);
  const [disputeBusy, setDisputeBusy] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const labels = es
    ? {
        squeeze: 'SQUEEZE',
        accept: '✓ ACEPTAR',
        acceptTitle: 'Aceptar propuesta de Squeeze de tu pool',
        squeezeTitle: 'Squeeze a este pool',
        squeezeLimit: 'Límite de 5 Squeezes en 24h alcanzado.',
        squeezeDone: 'Squeeze iniciado',
        squeezeAccepted: 'Squeeze aceptado — registro abierto',
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
        accept: '✓ ACCEPT',
        acceptTitle: 'Accept your pool Squeeze proposal',
        squeezeTitle: 'Squeeze this pool',
        squeezeLimit: '5 Squeezes per 24h limit reached.',
        squeezeDone: 'Squeeze started',
        squeezeAccepted: 'Squeeze accepted — registration open',
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
      const pool = myPoolRes.pool_code ? String(myPoolRes.pool_code).toUpperCase() : null;
      setMyPool(pool);

      if (pool && wallet) {
        const dRes = await fetch(`/api/wallet-pools/disputes?pool=${encodeURIComponent(pool)}&limit=50`).then((r) => r.json()).catch(() => ({}));
        const map = {};
        for (const d of dRes.disputes || []) {
          if (d.status !== 'proposing') continue;
          if (String(d.challenger_pool_code || '').toUpperCase() !== pool) continue;
          const votes = (d.votes || []).map((w) => String(w || '').toLowerCase());
          if (votes.includes(String(wallet).toLowerCase())) continue;
          map[String(d.defender_pool_code || '').toUpperCase()] = { id: d.id, votes };
        }
        setPendingAccept(map);
      } else {
        setPendingAccept({});
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15_000);
    window.addEventListener('mm3-db-updated', fetchData);
    return () => {
      clearInterval(t);
      window.removeEventListener('mm3-db-updated', fetchData);
    };
  }, [fetchData]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSqueeze = async (defenderPool) => {
    if (!wallet || !myPool || disputeBusy) return;
    const accepting = !!pendingAccept[String(defenderPool || '').toUpperCase()];
    const myPoolData = pools.find((p) => p.pool_code === myPool);
    if (!accepting && myPoolData?.squeeze_limit_reached) {
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
      await ensureWalletSession(wallet, { isVirtualWallet });
      const response = await apiFetch('/api/wallet-pools/dispute/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, challengerPool: myPool, defenderPool }),
      }, wallet);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const msg = payload.error === 'unauthorized'
          ? (es ? 'Sesión caducada — vuelve a entrar y reintenta' : 'Session expired — sign in again and retry')
          : payload.error === 'not_in_challenger_pool'
          ? (es ? 'Solo wallets del pool atacante pueden aceptar' : 'Only attacking-pool wallets can accept')
          : payload.error === 'squeeze_limit_reached'
          ? labels.squeezeLimit
          : payload.error === 'already_voted' || payload.error === 'dispute_already_active'
          ? labels.squeezeAlready
          : `${labels.squeezeError}${payload.error ? ` · ${payload.error}` : ''}`;
        window.dispatchEvent(
          new CustomEvent('mm3-toast', { detail: { msg, type: 'error' } })
        );
        return;
      }
      const msg = accepting
        ? labels.squeezeAccepted
        : payload.proposing && !payload.created
          ? labels.squeezeProposed
          : labels.squeezeDone;
      window.dispatchEvent(
        new CustomEvent('mm3-toast', { detail: { msg, type: 'success' } })
      );
      window.dispatchEvent(new CustomEvent('mm3-db-updated'));
      fetchData();
    } catch (err) {
      const code = err?.message || '';
      const msg = code === 'google_session_required' || code === 'session_failed'
        ? (es ? 'Sesión caducada — vuelve a entrar con Google/wallet' : 'Session expired — sign in again')
        : labels.squeezeError;
      window.dispatchEvent(
        new CustomEvent('mm3-toast', { detail: { msg, type: 'error' } })
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
          const pending = pendingAccept[String(pool.pool_code || '').toUpperCase()];
          const isAccept = !!pending;
          const disabled = busy || (!isAccept && myLimitReached);

          return (
            <div
              key={pool.pool_code}
              className="rounded font-mono"
              style={{
                border: `1px solid ${isAccept ? '#4ade8055' : isMyPool ? `${poolColor}55` : '#1e293b'}`,
                background: isAccept ? '#052e16' : isMyPool ? `${poolColor}0d` : '#080808',
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

              {/* squeeze / accept button — only for other pools when wallet has a pool */}
              {canSqueeze && (
                <button
                  type="button"
                  onClick={() => handleSqueeze(pool.pool_code)}
                  disabled={disabled}
                  title={
                    isAccept
                      ? labels.acceptTitle
                      : myLimitReached
                      ? `${labels.squeezeLimit}${myResetAt ? ` ${formatResetCountdown(myResetAt, nowMs)}` : ''}`
                      : labels.squeezeTitle
                  }
                  className="mt-0.5 w-full rounded border px-2 py-1 text-[0.6rem] font-black uppercase tracking-[0.14em] transition"
                  style={isAccept ? {
                    borderColor: disabled ? '#4ade801a' : '#4ade8088',
                    background: disabled ? 'transparent' : '#14532d55',
                    color: disabled ? '#4b5563' : '#86efac',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  } : {
                    borderColor: disabled ? '#f871711a' : '#f8717144',
                    background: disabled ? 'transparent' : '#7f1d1d10',
                    color: disabled ? '#4b5563' : '#fca5a5',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {busy ? '...' : (isAccept ? labels.accept : `⚔ ${labels.squeeze}`)}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
