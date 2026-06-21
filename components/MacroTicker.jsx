'use client';

import { useEffect, useRef, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { useI18n } from '@/lib/i18n-context';

const DEFAULT_TICKER_MESSAGES = {
  en: 'WELCOME TO MATHSMINE3 // SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME',
  es: 'BIENVENIDO A MATHSMINE3 // RESUELVE RAPIDO, MINA MM3 Y ALIMENTA EL MAINFRAME RETRO',
};

function normalizeTickerMessage(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

const NOTIF = {
  success: { color: '#4ade80', glow: 'rgba(74,222,128,0.55)' },
  error:   { color: '#f87171', glow: 'rgba(248,113,113,0.55)' },
  info:    { color: '#22d3ee', glow: 'rgba(34,211,238,0.55)' },
};
const TICKER_SECONDS = 55;
const NOTIF_SECONDS  = 28;  // shorter for mining events so queue drains faster

function toConsoleMessage(value) {
  return String(value || '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[‍️☀-➿]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function shortAddr(w) {
  if (!w) return '???';
  if (w.startsWith('anon-')) return w.slice(0, 10).toUpperCase();
  return `${w.slice(0, 6)}…${w.slice(-4)}`.toUpperCase();
}

function formatMiningEvent(row) {
  const w   = shortAddr(row.wallet);
  const mm3 = Number(row.delta_mm3 || 0);
  const amt = mm3 > 0 ? `  +${mm3.toFixed(4)} MM3` : '';
  switch (row.event_type) {
    case 'mining_buy':    return `${w} BOUGHT BLOCK${amt}`;
    case 'mining_resell': return `${w} RESOLD BLOCK${amt}`;
    case 'relaying':      return `${w} FIRED RELAY CMD${amt}`;
    case 'nftji_claim':   return `${w} CLAIMED NFTJI`;
    default:              return `${w} ${String(row.event_type || '').toUpperCase()}${amt}`;
  }
}

function formatPvpEvent(payload) {
  const atk = shortAddr(payload.attacker);
  const vic = shortAddr(payload.victim);
  const eur = Number(payload.eur_stolen || payload.stolen_eur || 0);
  const loot = eur > 0 ? `  +${eur.toFixed(2)} EUR` : '';
  if (payload.killed)   return `${atk} ELIMINATED ${vic}${loot}`;
  if (payload.dodged)   return `${vic} DODGED ${atk}`;
  if (payload.headshot) return `${atk} HEADSHOT ${vic}  -${payload.damage} HP`;
  if (payload.critical) return `${atk} CRIT ${vic}  -${payload.damage} HP`;
  return `${atk} HIT ${vic}  -${payload.damage || 1} HP`;
}

export default function MacroTicker() {
  const { language } = useI18n();
  const [messages, setMessages] = useState(DEFAULT_TICKER_MESSAGES);
  const [notif, setNotif]       = useState(null);

  // Queue so rapid mining events don't replace each other instantly
  const queueRef    = useRef([]);
  const busyRef     = useRef(false);

  function pushNotif(msg, type = 'info') {
    const entry = { id: `${Date.now()}-${Math.random()}`, msg: toConsoleMessage(msg), type };
    if (!entry.msg) return;
    queueRef.current.push(entry);
    if (!busyRef.current) drainQueue();
  }

  function drainQueue() {
    const next = queueRef.current.shift();
    if (!next) { busyRef.current = false; return; }
    busyRef.current = true;
    setNotif(next);
  }

  function onNotifEnd() {
    setNotif(null);
    drainQueue();
  }

  /* ── Load ticker text from DB ── */
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('mm3_macro_state')
          .select('ticker_message, ticker_message_en, ticker_message_es')
          .eq('id', 1)
          .maybeSingle();
        const legacy = normalizeTickerMessage(data?.ticker_message, DEFAULT_TICKER_MESSAGES.en);
        setMessages({
          en: normalizeTickerMessage(data?.ticker_message_en, legacy),
          es: normalizeTickerMessage(data?.ticker_message_es, legacy),
        });
      } catch {}
    };
    load();
    const timer = setInterval(load, 300_000);
    return () => clearInterval(timer);
  }, []);

  /* ── Manual mm3-toast events (from other components) ── */
  useEffect(() => {
    const handler = (e) => {
      const { msg, type } = e.detail || {};
      if (!msg) return;
      const localizedMsg = typeof msg === 'object'
        ? msg[language] || msg.en || msg.es || ''
        : msg;
      pushNotif(localizedMsg, NOTIF[type] ? type : 'info');
    };
    const clearHandler = () => { queueRef.current = []; busyRef.current = false; setNotif(null); };
    window.addEventListener('mm3-toast', handler);
    window.addEventListener('mm3-toast-clear', clearHandler);
    return () => {
      window.removeEventListener('mm3-toast', handler);
      window.removeEventListener('mm3-toast-clear', clearHandler);
    };
  }, [language]);

  /* ── Realtime: mining events (block buys, resells, relays) ── */
  useEffect(() => {
    const ch = supabase
      .channel('macro-ticker-mining')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mm3_mining_events' },
        ({ new: row }) => {
          if (!row?.wallet || !row?.event_type) return;
          pushNotif(formatMiningEvent(row), 'info');
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  /* ── Realtime: PvP hits via broadcast channel ── */
  useEffect(() => {
    const ch = supabase
      .channel('macro-ticker-pvp')
      .on('broadcast', { event: 'pvp-hit' }, ({ payload }) => {
        if (!payload?.attacker) return;
        pushNotif(formatPvpEvent(payload), payload.killed ? 'error' : 'info');
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { setNotif(null); queueRef.current = []; busyRef.current = false; }, [language]);

  const message = messages[language] || messages.en || DEFAULT_TICKER_MESSAGES.en;
  const cfg = notif ? NOTIF[notif.type] : null;

  return (
    <div className="relative w-full h-full flex items-center overflow-hidden">
      <style>{`
        @keyframes mm3-ticker-scroll {
          0%   { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

      {/* Normal scrolling ticker — hidden while notification is up */}
      <div
        className="shrink-0 whitespace-nowrap font-mono text-[0.82rem] sm:text-[0.75rem] font-black uppercase tracking-[0.18em] sm:tracking-[0.22em] text-green-300 transition-opacity duration-300"
        style={{
          animation: `mm3-ticker-scroll ${TICKER_SECONDS}s linear infinite`,
          textShadow: '0 0 10px rgba(74,222,128,0.45)',
          opacity: notif ? 0 : 1,
        }}
      >
        {message}
      </div>

      {/* Notification overlay */}
      {notif && (
        <div className="absolute inset-0 flex items-center overflow-hidden">
          <div
            key={notif.id}
            className="shrink-0 whitespace-nowrap font-mono text-[0.82rem] sm:text-[0.75rem] font-black uppercase tracking-[0.18em] sm:tracking-[0.22em]"
            onAnimationEnd={onNotifEnd}
            style={{
              animation: `mm3-ticker-scroll ${NOTIF_SECONDS}s linear 1 both`,
              color: cfg.color,
              textShadow: `0 0 10px ${cfg.glow}`,
            }}
          >
            {notif.msg}
          </div>
        </div>
      )}
    </div>
  );
}
