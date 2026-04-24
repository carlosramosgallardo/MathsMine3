'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { normalizeMacroState } from '@/lib/mm3-macro';
import { useI18n } from '@/lib/i18n-context';
import { useDice } from '@/lib/dice-context';

function formatUtc(date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date);
}

export default function GlobalPulseBar() {
  const { language } = useI18n();
  const dice = useDice();
  const [now, setNow] = useState(() => new Date());
  const [macro, setMacro] = useState(() => normalizeMacroState());
  const [activeWallets, setActiveWallets] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('mm3_macro_state')
          .select('war_percent, nature_percent')
          .eq('id', 1)
          .maybeSingle();
        setMacro(normalizeMacroState(data));
      } catch {}
    };

    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadPresence = async () => {
      try {
        const since = new Date(Date.now() - 90_000).toISOString();
        const { data } = await supabase
          .from('mm3_wallet_presence')
          .select('wallet, source, last_seen')
          .gte('last_seen', since)
          .order('last_seen', { ascending: false })
          .limit(20);
        setActiveWallets(data || []);
      } catch {
        setActiveWallets([]);
      }
    };

    loadPresence();
    const timer = setInterval(loadPresence, 15_000);
    return () => clearInterval(timer);
  }, []);

  const isSpanish = language === 'es';
  const items = [
    {
      emoji: '⚔️',
      value: macro.war_percent,
      color: '#fb7185',
      title: isSpanish
        ? 'Presión de guerra · Alto = el fiat se debilita, comisiones de Trade bajan. Bajo = el fiat aguanta, comisiones suben.'
        : 'War pressure · High = fiat weakens, Trade commissions drop. Low = fiat holds, commissions rise.',
    },
    {
      emoji: '🌪️',
      value: macro.nature_percent,
      color: '#67e8f9',
      title: isSpanish
        ? 'Presión natural · Alto = MM3 se fortalece, comisiones de Trade suben. Bajo = MM3 se debilita, comisiones bajan.'
        : 'Nature pressure · High = MM3 strengthens, Trade commissions rise. Low = MM3 weakens, commissions drop.',
    },
  ];

  const diceModPct = dice ? Math.round(Math.abs(dice.modifier) * 100) : 0;
  const diceSign   = dice?.modifier >= 0 ? '+' : '−';
  const diceTitle  = dice?.active
    ? isSpanish
      ? `Dado de azar activo 🎲 · Comisiones de Trade ${diceSign}${diceModPct}% (ventana de 15 min). Modificador alto encarece el trade; bajo lo abarata.`
      : `Fate die active 🎲 · Trade commissions ${diceSign}${diceModPct}% (15-min window). High modifier = pricier trade; low = cheaper.`
    : isSpanish
      ? 'Dado de azar · Se activa cada hora en un momento aleatorio durante 15 min, modificando las comisiones de Trade hasta ±50%.'
      : 'Fate die · Activates each hour at a random moment for 15 min, shifting Trade commissions up to ±50%.';

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      {/* Clock — hide "UTC" label on mobile to save space */}
      <div className="flex h-7 sm:h-9 items-center rounded-md border border-cyan-500/30 bg-black px-1.5 sm:px-2 font-mono text-[0.54rem] sm:text-[0.62rem] font-black tracking-[0.1em] sm:tracking-[0.18em] text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.12)]">
        <span className="hidden sm:inline mr-0.5 opacity-60">UTC</span>{formatUtc(now)}
      </div>
      {/* War + Nature + Dice indicators */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {items.map((item) => (
          <div
            key={item.emoji}
            className="flex h-7 sm:h-9 min-w-[2.2rem] sm:min-w-14 items-center justify-center gap-0.5 rounded-md border bg-black px-1 sm:px-1.5 font-mono text-[0.54rem] sm:text-[0.62rem] font-black"
            style={{
              borderColor: `${item.color}66`,
              color: item.color,
              boxShadow: `0 0 10px ${item.color}22`,
            }}
            title={`${item.emoji} ${item.value.toFixed(2)}% · ${item.title}`}
          >
            <span className="leading-none">{item.emoji}</span>
            <span>{item.value.toFixed(0)}%</span>
          </div>
        ))}

        {/* Dice slot */}
        {dice && (
          <div
            className="flex h-7 sm:h-9 min-w-[2.2rem] sm:min-w-[3.4rem] items-center justify-center gap-0.5 rounded-md border bg-black px-1 sm:px-1.5 font-mono text-[0.54rem] sm:text-[0.62rem] font-black transition-all duration-700"
            style={dice.active ? {
              borderColor: `${dice.color}70`,
              color: dice.color,
              boxShadow: `0 0 12px ${dice.color}30`,
            } : {
              borderColor: '#1e293b',
              color: '#334155',
            }}
            title={diceTitle}
          >
            <span className="text-sm sm:text-base leading-none select-none">🎲</span>
            <span className="text-[0.5rem] sm:text-[0.56rem] font-black tabular-nums">
              {dice.active ? `${diceSign}${diceModPct}%` : '0%'}
            </span>
          </div>
        )}
      </div>
      <div
        className="group relative flex h-7 min-w-[2.6rem] items-center justify-center gap-0.5 rounded-md border border-emerald-400/40 bg-black px-1 font-mono text-[0.54rem] font-black text-emerald-300 shadow-[0_0_10px_rgba(74,222,128,0.14)] sm:h-9 sm:min-w-14 sm:px-1.5 sm:text-[0.62rem]"
        title={isSpanish ? 'Wallets conectadas ahora al portal' : 'Wallets currently connected to the portal'}
      >
        <span>👥</span>
        <span>{activeWallets.length}</span>
        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-emerald-400/30 bg-black/95 p-2 text-left font-mono text-[0.58rem] font-semibold tracking-normal text-emerald-200 shadow-[0_0_18px_rgba(74,222,128,0.18)] group-hover:block group-focus-within:block">
          <div className="mb-1 text-[0.55rem] uppercase tracking-[0.16em] text-emerald-500">
            {isSpanish ? 'Wallets online' : 'Online wallets'}
          </div>
          {activeWallets.length > 0 ? activeWallets.map((entry) => (
            <div key={entry.wallet} className="truncate py-0.5" title={entry.wallet}>
              <span className="text-cyan-500">{entry.source === 'google' ? 'G' : 'W'}</span>
              <span className="mx-1 text-emerald-900">/</span>
              {entry.wallet}
            </div>
          )) : (
            <div className="py-1 text-emerald-800">
              {isSpanish ? 'Sin wallets activas' : 'No active wallets'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
