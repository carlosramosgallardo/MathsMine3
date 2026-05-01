'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import supabase from './supabaseClient';

const ACTIVE_WINDOW_MS = 90_000;

const IrcPresenceContext = createContext({
  activeWallets: [],
  totalWallets: 0,
  anonIrcUsers: [],
  channelStatus: 'JOINING',
  trackAnon: async () => {},
  untrackAnon: async () => {},
});

export function IrcPresenceProvider({ children }) {
  const [activeWallets, setActiveWallets] = useState([]);
  const [totalWallets, setTotalWallets]   = useState(0);
  const [anonIrcUsers, setAnonIrcUsers]   = useState([]);
  const [channelStatus, setChannelStatus] = useState('JOINING');
  const channelRef = useRef(null);

  /* ── Single mm3-irc-anon-presence subscription ── */
  useEffect(() => {
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
    }, 15000);

    return () => {
      clearTimeout(timer);
      if (ch) supabase.removeChannel(ch);
      channelRef.current = null;
      setChannelStatus('JOINING');
    };
  }, []);

  /* ── Wallet presence from DB ── */
  useEffect(() => {
    const load = async () => {
      try {
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
      } catch { setActiveWallets([]); }
    };
    load();
    const t  = setInterval(load, 10_000);
    let ch = null;
    const channelTimer = setTimeout(() => {
      ch = supabase
        .channel('mm3-irc-presence-ctx')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_wallet_presence' }, load)
        .subscribe();
    }, 15000);
    return () => {
      clearInterval(t);
      clearTimeout(channelTimer);
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  /* ── Total wallets count ── */
  useEffect(() => {
    const load = async () => {
      try {
        const { count } = await supabase
          .from('player_progress')
          .select('wallet', { count: 'exact', head: true });
        if (count != null) setTotalWallets(count);
      } catch {}
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

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
      value={{ activeWallets, totalWallets, anonIrcUsers, channelStatus, trackAnon, untrackAnon }}
    >
      {children}
    </IrcPresenceContext.Provider>
  );
}

export const useIrcPresence = () => useContext(IrcPresenceContext);
