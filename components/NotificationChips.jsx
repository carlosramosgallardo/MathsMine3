'use client';

import { useState, useCallback, useEffect } from 'react';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { useI18n } from '@/lib/i18n-context';
import { colorFromAddress, colorFromPool } from '@/lib/wallet-colors';
import { formatWalletLabel } from '@/lib/wallet-format';
import supabase from '@/lib/supabaseClient';

function shortWallet(wallet) {
  const s = String(wallet || '').trim();
  return s ? formatWalletLabel(s).toUpperCase() : '';
}

const LABELS = {
  es: {
    acceptInvite: 'Aceptar invitación',
    declineInvite: 'Rechazar invitación',
    inviteAccepted: 'Solicitud aceptada.',
    inviteDeclined: 'Solicitud rechazada.',
    poolError: 'Error al procesar la solicitud.',
    disputeProposalJoin: 'Unirse a la propuesta de disputa',
    disputeProposed: 'Propuesta enviada — esperando otra wallet del pool',
    disputeVoted: 'Unido a la disputa.',
    disputeError: 'Error al enviar propuesta.',
    disputeAlready: 'Ya has participado en esta propuesta.',
    disputeLimit: 'Límite de 5 Squeezes en 24h alcanzado.',
  },
  en: {
    acceptInvite: 'Accept invite',
    declineInvite: 'Decline invite',
    inviteAccepted: 'Request accepted.',
    inviteDeclined: 'Request declined.',
    poolError: 'Could not process request.',
    disputeProposalJoin: 'Join the dispute proposal',
    disputeProposed: 'Proposal sent — waiting for another pool wallet',
    disputeVoted: 'Joined the dispute.',
    disputeError: 'Error sending proposal.',
    disputeAlready: 'You already participated in this proposal.',
    disputeLimit: '5 Squeezes per 24h limit reached.',
  },
};

export default function NotificationChips() {
  const { account } = useActiveWallet();
  const activeWallet = account?.toLowerCase() || '';
  const { language } = useI18n();
  const labels = LABELS[language] || LABELS.en;

  const [myPool, setMyPool] = useState('');
  const [invites, setInvites] = useState([]);
  const [proposingDisputes, setProposingDisputes] = useState([]);
  const [acceptBusy, setAcceptBusy] = useState('');
  const [declineBusy, setDeclineBusy] = useState('');
  const [disputeBusy, setDisputeBusy] = useState('');

  // Fetch wallet's current pool
  useEffect(() => {
    if (!activeWallet) { setMyPool(''); return; }
    fetch(`/api/wallet-pools/my-pool?wallet=${encodeURIComponent(activeWallet)}`)
      .then((r) => r.json())
      .then((d) => setMyPool(d.pool_code || ''))
      .catch(() => setMyPool(''));
  }, [activeWallet]);

  // Also refresh pool membership after DB updates (e.g. accept invite)
  useEffect(() => {
    if (!activeWallet) return;
    const refresh = () => {
      fetch(`/api/wallet-pools/my-pool?wallet=${encodeURIComponent(activeWallet)}`)
        .then((r) => r.json())
        .then((d) => setMyPool(d.pool_code || ''))
        .catch(() => {});
    };
    window.addEventListener('mm3-db-updated', refresh);
    return () => window.removeEventListener('mm3-db-updated', refresh);
  }, [activeWallet]);

  const fetchInvites = useCallback(async () => {
    if (!activeWallet) { setInvites([]); return; }
    try {
      const r = await fetch(`/api/wallet-pools/invites?wallet=${encodeURIComponent(activeWallet)}`);
      const d = await r.json().catch(() => ({}));
      setInvites(r.ok && d.ok ? (d.invites || []) : []);
    } catch { setInvites([]); }
  }, [activeWallet]);

  useEffect(() => {
    fetchInvites();
    const poll = setInterval(fetchInvites, 5_000);
    return () => clearInterval(poll);
  }, [activeWallet, fetchInvites]);

  useEffect(() => {
    if (!activeWallet) return;
    const ch = supabase
      .channel('mm3-notif-chips-invites')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_wallet_pool_invitations' }, fetchInvites)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [activeWallet, fetchInvites]);

  useEffect(() => {
    if (!myPool) { setProposingDisputes([]); return; }
    const load = () => {
      fetch(`/api/wallet-pools/disputes?pool=${encodeURIComponent(myPool)}&limit=50`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.ok) return;
          setProposingDisputes(
            (d.disputes || []).filter(
              (disp) =>
                disp.status === 'proposing' &&
                disp.challenger_pool_code === myPool &&
                activeWallet &&
                !(disp.votes || []).includes(activeWallet),
            ),
          );
        })
        .catch(() => {});
    };
    load();
    const poll = setInterval(load, 5_000);
    return () => clearInterval(poll);
  }, [myPool, activeWallet]);

  const handleAccept = async (inviteId) => {
    if (!activeWallet || acceptBusy) return;
    setAcceptBusy(inviteId);
    try {
      const r = await fetch('/api/wallet-pools/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: activeWallet, inviteId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.poolError, type: 'error' } }));
        return;
      }
      localStorage.removeItem('lb_data');
      localStorage.removeItem('lb_fetch_time');
      localStorage.setItem('lb_dirty_at', String(Date.now()));
      window.dispatchEvent(new CustomEvent('mm3-db-updated'));
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.inviteAccepted, type: 'success' } }));
      await fetchInvites();
    } catch {
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.poolError, type: 'error' } }));
    } finally {
      setAcceptBusy('');
    }
  };

  const handleDecline = async (inviteId) => {
    if (!activeWallet || declineBusy) return;
    setDeclineBusy(inviteId);
    try {
      const r = await fetch('/api/wallet-pools/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: activeWallet, inviteId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.poolError, type: 'error' } }));
        return;
      }
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.inviteDeclined, type: 'success' } }));
      await fetchInvites();
    } catch {
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.poolError, type: 'error' } }));
    } finally {
      setDeclineBusy('');
    }
  };

  const handleDisputeJoin = async (defenderPoolCode, disputeId) => {
    if (!activeWallet || !myPool || disputeBusy) return;
    setDisputeBusy(defenderPoolCode);
    try {
      const r = await fetch('/api/wallet-pools/dispute/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: activeWallet, challengerPool: myPool, defenderPool: defenderPoolCode }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        const errKey = d.error === 'squeeze_limit_reached'
          ? 'disputeLimit'
          : d.error === 'already_voted' || d.error === 'dispute_already_active' ? 'disputeAlready' : 'disputeError';
        window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels[errKey], type: 'error' } }));
        return;
      }
      const msg = d.proposing && !d.created ? labels.disputeProposed : labels.disputeVoted;
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type: 'success' } }));
      setProposingDisputes((prev) => prev.filter((p) => p.id !== disputeId));
    } catch {
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: labels.disputeError, type: 'error' } }));
    } finally {
      setDisputeBusy('');
    }
  };

  if (!activeWallet || (invites.length === 0 && proposingDisputes.length === 0)) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-b border-cyan-900/10 px-3 py-1 sm:px-4">
      {invites.map((invite) => {
        const isJoinRequest = myPool && String(invite.pool_code).toUpperCase() === String(myPool).toUpperCase();
        const busy = acceptBusy === invite.id || declineBusy === invite.id;
        return (
          <div key={invite.id} className="flex items-center gap-2 rounded border border-cyan-500/20 bg-black/80 px-2 py-0.5 text-[0.6rem] font-mono">
            <span className="uppercase tracking-wide text-cyan-600">{isJoinRequest ? 'req' : 'inv'}</span>
            <span className="font-semibold" style={{ color: colorFromAddress(invite.invited_by) }}>
              {shortWallet(invite.invited_by)}
            </span>
            <span style={{ color: colorFromPool(String(invite.pool_code || '')) }}>#{invite.pool_code}</span>
            <button type="button" onClick={() => handleDecline(invite.id)} disabled={busy} title={labels.declineInvite}
              className="ml-1 px-1 text-[0.82rem] font-black leading-none text-rose-400 transition hover:text-rose-200 disabled:opacity-30">✗</button>
            <button type="button" onClick={() => handleAccept(invite.id)} disabled={busy} title={labels.acceptInvite}
              className="px-1 text-[0.82rem] font-black leading-none text-emerald-400 transition hover:text-emerald-200 disabled:opacity-30">✓</button>
          </div>
        );
      })}
      {proposingDisputes.map((d) => {
        const busy = disputeBusy === d.defender_pool_code;
        return (
          <div key={`prop-${d.id}`} className="flex items-center gap-2 rounded border border-violet-500/20 bg-black/80 px-2 py-0.5 text-[0.6rem] font-mono">
            <span className="text-violet-500">⚔️</span>
            <span className="text-slate-500">vs</span>
            <span className="font-semibold" style={{ color: colorFromPool(String(d.defender_pool_code || '')) }}>#{d.defender_pool_code}</span>
            <button type="button" onClick={() => handleDisputeJoin(d.defender_pool_code, d.id)} disabled={busy}
              title={labels.disputeProposalJoin}
              className="ml-1 px-1 text-[0.82rem] font-black leading-none text-emerald-400 transition hover:text-emerald-200 disabled:opacity-30">✓</button>
          </div>
        );
      })}
    </div>
  );
}
