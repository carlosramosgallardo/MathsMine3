'use client';

import { useEffect, useState } from 'react';
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
const NOTIF_SECONDS = 42;

function toConsoleMessage(value) {
  return String(value || '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u200d\ufe0f\u2600-\u27bf]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export default function MacroTicker() {
  const { language } = useI18n();
  const [messages, setMessages] = useState(DEFAULT_TICKER_MESSAGES);
  const [notif, setNotif]       = useState(null);   // { msg, type }

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
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  /* ── Listen for notifications ── */
  useEffect(() => {
    const handler = (e) => {
      const { msg, type } = e.detail || {};
      if (!msg) return;
      const localizedMsg = typeof msg === 'object'
        ? msg[language] || msg.en || msg.es || ''
        : msg;
      const consoleMsg = toConsoleMessage(localizedMsg);
      if (!consoleMsg) return;
      setNotif({
        id: `${Date.now()}-${Math.random()}`,
        msg: consoleMsg,
        type: NOTIF[type] ? type : 'info',
      });
    };
    const clearHandler = () => setNotif(null);
    window.addEventListener('mm3-toast', handler);
    window.addEventListener('mm3-toast-clear', clearHandler);
    return () => {
      window.removeEventListener('mm3-toast', handler);
      window.removeEventListener('mm3-toast-clear', clearHandler);
    };
  }, [language]);

  useEffect(() => {
    setNotif(null);
  }, [language]);

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
        className="shrink-0 whitespace-nowrap font-mono text-[0.58rem] sm:text-[0.62rem] font-black uppercase tracking-[0.18em] sm:tracking-[0.22em] text-green-300 transition-opacity duration-300"
        style={{
          animation: `mm3-ticker-scroll ${TICKER_SECONDS}s linear infinite`,
          textShadow: '0 0 10px rgba(74,222,128,0.45)',
          opacity: notif ? 0 : 1,
        }}
      >
        {message}
      </div>

      {/* Notification overlay — completes one full ticker pass before clearing */}
      {notif && (
        <div
          className="absolute inset-0 flex items-center overflow-hidden"
        >
          <div
            key={notif.id}
            className="shrink-0 whitespace-nowrap font-mono text-[0.58rem] sm:text-[0.62rem] font-black uppercase tracking-[0.18em] sm:tracking-[0.22em]"
            onAnimationEnd={() => setNotif(null)}
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
