'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import supabase from '@/lib/supabaseClient';
import { useI18n } from '@/lib/i18n-context';

const DEFAULT_TICKER_MESSAGES = {
  en: 'WELCOME TO MATHSMINE3 // SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME',
  es: 'BIENVENIDO A MATHSMINE3 // RESUELVE RAPIDO, MINA MM3 Y ALIMENTA EL MAINFRAME RETRO',
};

const STORMROLL_TICKER = {
  en: '🎲 DICE ACTIVE // AoE DAMAGE ALERT // TAKE COVER: ENTER THE DICE POOL',
  es: '🎲 DICE ACTIVO // ALERTA DE DAÑO AoE // PROTÉGETE: ENTRA EN LA PISCINA DEL DADO',
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

export default function MacroTicker() {
  const { language } = useI18n();
  const [messages, setMessages] = useState(DEFAULT_TICKER_MESSAGES);
  const [stormrollActive, setStormrollActive] = useState(false);
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

  /* ── Load ticker text and stormroll state from DB ── */
  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('mm3_macro_state')
        .select('ticker_message, ticker_message_en, ticker_message_es, node_dice_expires_at, ticker_message_expires_at')
        .eq('id', 1)
        .maybeSingle();
      const tickerExpired = data?.ticker_message_expires_at
        && new Date(data.ticker_message_expires_at).getTime() < Date.now();
      const legacy = tickerExpired
        ? DEFAULT_TICKER_MESSAGES.en
        : normalizeTickerMessage(data?.ticker_message, DEFAULT_TICKER_MESSAGES.en);
      setMessages({
        en: tickerExpired ? DEFAULT_TICKER_MESSAGES.en : normalizeTickerMessage(data?.ticker_message_en, legacy),
        es: tickerExpired ? DEFAULT_TICKER_MESSAGES.es : normalizeTickerMessage(data?.ticker_message_es, legacy),
      });
      const expiresAt = data?.node_dice_expires_at ? new Date(data.node_dice_expires_at).getTime() : 0;
      setStormrollActive(expiresAt > Date.now());
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 300_000);
    return () => clearInterval(timer);
  }, [load]);

  /* ── Immediate refresh when stormroll activates / deactivates ── */
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('mm3-stormroll-changed', handler);
    return () => window.removeEventListener('mm3-stormroll-changed', handler);
  }, [load]);

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

  useEffect(() => { setNotif(null); queueRef.current = []; busyRef.current = false; }, [language]);

  const message = stormrollActive
    ? (STORMROLL_TICKER[language] || STORMROLL_TICKER.en)
    : (messages[language] || messages.en || DEFAULT_TICKER_MESSAGES.en);
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
        className="shrink-0 whitespace-nowrap font-mono text-[0.82rem] sm:text-[0.75rem] font-black uppercase tracking-[0.18em] sm:tracking-[0.22em] transition-opacity duration-300"
        style={{
          animation: `mm3-ticker-scroll ${TICKER_SECONDS}s linear infinite`,
          color: stormrollActive ? '#facc15' : '#86efac',
          textShadow: stormrollActive
            ? '0 0 12px rgba(250,204,21,0.65)'
            : '0 0 10px rgba(74,222,128,0.45)',
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
