'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import supabase from './supabaseClient';

const ACTIVE_WINDOW_MS = 90_000;

const IrcPresenceContext = createContext({
  activeWallets: [],
  activeWalletCount: 0,
  totalWallets: 0,
  macro: null,
  anonIrcUsers: [],
  channelStatus: 'JOINING',
  trackAnon: async () => {},
  untrackAnon: async () => {},
});

export function IrcPresenceProvider({ children }) {
  const pathname = usePathname();
  const [activeWallets, setActiveWallets] = useState([]);
  const [activeWalletCount, setActiveWalletCount] = useState(0);
  const [totalWallets, setTotalWallets]   = useState(0);
  const [macro, setMacro] = useState(null);
  const [anonIrcUsers, setAnonIrcUsers]   = useState([]);
  const [channelStatus, setChannelStatus] = useState('JOINING');
  const channelRef = useRef(null);

  /* ── Single mm3-irc-anon-presence subscription ── */
  useEffect(() => {
    if (pathname !== '/relaying') {
      setAnonIrcUsers([]);
      setChannelStatus('OFFLINE');
      return undefined;
    }
    let ch = null;
    const timer = setTimeout(() => {
      ch = supabase.channel('mm3-irc-anon-presence');
      channelRef.current = ch;

      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState();
        const seen  = new Set();
        const users = [];
        for (const entries of Object.values(state || {})) {
          for (const u of entries) {
            const id = String(u.anonId || '');
            if (!id.startsWith('anon:') || seen.has(id)) continue;
            seen.add(id);
            const rawFlag = String(u.flag || '');
            users.push({ anonId: id, flag: rawFlag.length === 2 ? rawFlag : '' });
          }
        }
        setAnonIrcUsers(users);
      }).subscribe((status) => {
        setChannelStatus(status);
      });
    }, 250);

    return () => {
      clearTimeout(timer);
      if (ch) supabase.removeChannel(ch);
      channelRef.current = null;
      setChannelStatus('JOINING');
    };
  }, [pathname]);

  /* ── Wallet presence from DB ── */
  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/portal-status');
        const status = await response.json();
        if (status?.ok) {
          setActiveWalletCount(Number(status.activeWalletCount) || 0);
          setTotalWallets(Number(status.totalWallets) || 0);
          setMacro(status.macro || null);
        }
        if (pathname !== '/relaying') { setActiveWallets([]); return; }
        const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
        const { data } = await supabase
          .from('mm3_wallet_presence')
          .select('wallet, source, last_seen')
          .gte('last_seen', since)
          .order('last_seen', { ascending: false });
        const seen = new Set();
        const unique = [];
        for (const entry of data || []) {
          const wallet = String(entry.wallet || '').toLowerCase();
          if (!wallet || seen.has(wallet)) continue;
          seen.add(wallet);
          unique.push({ wallet, source: entry.source || 'wallet', last_seen: entry.last_seen });
        }
        setActiveWallets(unique);
        setActiveWalletCount(unique.length);
      } catch { setActiveWallets([]); }
    };
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, pathname === '/relaying' ? 60_000 : 300_000);
    window.addEventListener('focus', load);
    window.addEventListener('mm3-presence-changed', load);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', load);
      window.removeEventListener('mm3-presence-changed', load);
    };
  }, [pathname]);

  const trackAnon = useCallback(async (anonId, flag) => {
    if (!channelRef.current) return;
    await channelRef.current.track({ anonId, flag }).catch(() => {});
  }, []);

  const untrackAnon = useCallback(async () => {
    if (!channelRef.current) return;
    await channelRef.current.untrack().catch(() => {});
  }, []);

  return (
    <IrcPresenceContext.Provider
      value={{ activeWallets, activeWalletCount, totalWallets, macro, anonIrcUsers, channelStatus, trackAnon, untrackAnon }}
    >
      {children}
    </IrcPresenceContext.Provider>
  );
}

export const useIrcPresence = () => useContext(IrcPresenceContext);
