'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { normalizeMacroState } from '@/lib/mm3-macro';
import { useI18n } from '@/lib/i18n-context';
import { useDice } from '@/lib/dice-context';

const ACTIVE_WINDOW_MS = 90_000;

function normalizeActiveWallets(rows) {
  const uniqueWallets = [];
  const seen = new Set();

  for (const entry of rows || []) {
    const wallet = String(entry.wallet || '').toLowerCase();
    if (!wallet || seen.has(wallet)) continue;
    seen.add(wallet);
    uniqueWallets.push({ wallet, source: entry.source || 'wallet', last_seen: entry.last_seen || null });
  }

  return uniqueWallets;
}

function countAnonFromState(state) {
  const seen = new Set();
  let count = 0;
  for (const entries of Object.values(state || {})) {
    for (const u of entries) {
      const id = String(u.anonId || '');
      if (!id.startsWith('anon:') || seen.has(id)) continue;
      seen.add(id);
      count++;
    }
  }
  return count;
}

function readIrcPanelCount() {
  if (typeof document === 'undefined') return null;
  const candidates = Array.from(document.querySelectorAll('span,div'));

  for (const el of candidates) {
    const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    const match = text.match(/(?:^|\s)(\d+)\s*\/\s*\d+\s*wallets\s*·\s*(\d+)\s*irc(?:\s|$)/i);
    if (!match) continue;

    const rect = el.getBoundingClientRect?.();
    if (rect && rect.left > window.innerWidth * 0.5) {
      return Number(match[2]);
    }
  }

  return null;
}

export default function GlobalPulseBar() {
  const { language } = useI18n();
  const dice = useDice();
  const [macro, setMacro] = useState(() => normalizeMacroState());
  const [activeWallets, setActiveWallets] = useState([]);
  const [anonCount, setAnonCount] = useState(0);
  const [panelIrcCount, setPanelIrcCount] = useState(null);
  const [totalWallets, setTotalWallets] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from('mm3_macro_state').select('war_percent, nature_percent').eq('id', 1).maybeSingle();
        setMacro(normalizeMacroState(data));
      } catch {}
    };
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadPresence = async () => {
      try {
        const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
        const { data } = await supabase
          .from('mm3_wallet_presence')
          .select('wallet, source, last_seen')
          .gte('last_seen', since)
          .order('last_seen', { ascending: false });
        setActiveWallets(normalizeActiveWallets(data));
      } catch {
        setActiveWallets([]);
      }
    };

    loadPresence();
    const timer = setInterval(loadPresence, 10000);
    const channel = supabase
      .channel('mm3-global-pulse-presence-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_wallet_presence' }, loadPresence)
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const loadTotal = async () => {
      try {
        const { count } = await supabase.from('player_progress').select('wallet', { count: 'exact', head: true });
        if (count != null) setTotalWallets(count);
      } catch {}
    };
    loadTotal();
    const timer = setInterval(loadTotal, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const channel = supabase.channel('mm3-irc-anon-presence');

    channel
      .on('presence', { event: 'sync' }, () => {
        setAnonCount(countAnonFromState(channel.presenceState()));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setAnonCount(countAnonFromState(channel.presenceState()));
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const syncFromPanel = () => {
      const next = readIrcPanelCount();
      setPanelIrcCount(Number.isFinite(next) ? next : null);
    };

    syncFromPanel();
    const timer = setInterval(syncFromPanel, 1000);
    const observer = new MutationObserver(syncFromPanel);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      clearInterval(timer);
      observer.disconnect();
    };
  }, []);

  const isSpanish = language === 'es';
  const calculatedIrcCount = activeWallets.length + anonCount;
  const ircConnectedCount = panelIrcCount ?? calculatedIrcCount;

  const items = [
    { emoji: '⚔️', value: macro.war_percent, color: '#fb7185' },
    { emoji: '🌪️', value: macro.nature_percent, color: '#67e8f9' },
  ];

  const diceModPct = dice ? Math.round(Math.abs(dice.modifier) * 100) : 0;
  const diceSign = dice?.modifier >= 0 ? '+' : '−';

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <div className="flex items-center gap-0.5 sm:gap-1">
        {items.map((item) => (
          <div key={item.emoji} className="flex h-7 sm:h-9 items-center gap-0.5 px-0.5 sm:px-1 font-mono text-[0.54rem] sm:text-[0.62rem] font-black" style={{ color: item.color }}>
            <span>{item.emoji}</span>
            <span>{item.value.toFixed(0)}%</span>
          </div>
        ))}
        {dice && (
          <div className="flex h-7 sm:h-9 items-center gap-0.5 px-0.5 sm:px-1 font-mono text-[0.54rem] sm:text-[0.62rem] font-black" style={{ color: dice.active ? dice.color : '#334155' }}>
            <span>🎲</span>
            <span>{dice.active ? `${diceSign}${diceModPct}%` : '0%'}</span>
          </div>
        )}
      </div>

      <div
        className="group relative flex h-7 items-center gap-[3px] px-0.5 sm:px-1 font-mono text-[0.54rem] font-black sm:h-9 sm:text-[0.62rem]"
        title={
          isSpanish
            ? `logados: ${activeWallets.length} / wallets: ${totalWallets} · IRC: ${ircConnectedCount}`
            : `online: ${activeWallets.length} / wallets: ${totalWallets} · IRC: ${ircConnectedCount}`
        }
      >
        <span className="text-emerald-400 tabular-nums">{activeWallets.length}</span>
        <span className="text-slate-600 text-[0.44rem]">/</span>
        <span className="text-slate-500 tabular-nums">{totalWallets}</span>
        <span className="text-slate-600 text-[0.38rem]">wallets</span>
        <span className="text-slate-700 mx-[1px]">·</span>
        <span className="text-cyan-700 tabular-nums">{ircConnectedCount}</span>
        <span className="text-cyan-900 text-[0.38rem]">irc</span>
      </div>
    </div>
  );
}
