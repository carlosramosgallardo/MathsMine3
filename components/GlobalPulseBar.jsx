'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { normalizeMacroState } from '@/lib/mm3-macro';
import { useI18n } from '@/lib/i18n-context';
import { useDice } from '@/lib/dice-context';

export default function GlobalPulseBar() {
  const { language } = useI18n();
  const dice = useDice();
  const [macro, setMacro] = useState(() => normalizeMacroState());
  const [activeWallets, setActiveWallets] = useState([]);
  const [anonCount, setAnonCount] = useState(0);
  const [totalWallets, setTotalWallets] = useState(0);

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

  useEffect(() => {
    const loadTotal = async () => {
      try {
        const { count } = await supabase
          .from('player_progress')
          .select('wallet', { count: 'exact', head: true });
        if (count != null) setTotalWallets(count);
      } catch {}
    };
    loadTotal();
    const timer = setInterval(loadTotal, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const channel = supabase.channel('mm3-irc-anon-presence');
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const seen = new Set();
        let count = 0;
        for (const entries of Object.values(state)) {
          for (const u of entries) {
            const id = String(u.anonId || '');
            if (!id.startsWith('anon:') || seen.has(id)) continue;
            seen.add(id);
            count++;
          }
        }
        setAnonCount(count);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      {/* War + Nature + Dice indicators */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {items.map((item) => (
          <div
            key={item.emoji}
            className="flex h-7 sm:h-9 items-center gap-0.5 px-0.5 sm:px-1 font-mono text-[0.54rem] sm:text-[0.62rem] font-black"
            style={{ color: item.color }}
            title={`${item.emoji} ${item.value.toFixed(2)}% · ${item.title}`}
          >
            <span className="leading-none">{item.emoji}</span>
            <span>{item.value.toFixed(0)}%</span>
          </div>
        ))}

        {/* Dice slot */}
        {dice && (
          <div
            className="flex h-7 sm:h-9 items-center gap-0.5 px-0.5 sm:px-1 font-mono text-[0.54rem] sm:text-[0.62rem] font-black transition-all duration-700"
            style={{ color: dice.active ? dice.color : '#334155' }}
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
        className="group relative flex h-7 items-center gap-[3px] px-0.5 sm:px-1 font-mono text-[0.54rem] font-black sm:h-9 sm:text-[0.62rem]"
        title={
          isSpanish
            ? `logados: ${activeWallets.length} · totales: ${totalWallets} · IRC: ${activeWallets.length + anonCount}`
            : `online: ${activeWallets.length} · total: ${totalWallets} · IRC: ${activeWallets.length + anonCount}`
        }
      >
        <span className="text-emerald-400 tabular-nums">{activeWallets.length}</span>
        <span className="text-slate-700">·</span>
        <span className="text-slate-500 tabular-nums">{totalWallets}</span>
        <span className="text-slate-700">·</span>
        <span className="text-cyan-700 tabular-nums">{activeWallets.length + anonCount}</span>
        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-emerald-400/30 bg-black/95 p-2 text-left font-mono text-[0.58rem] font-semibold tracking-normal text-emerald-200 shadow-[0_0_18px_rgba(74,222,128,0.18)] group-hover:block group-focus-within:block">
          <div className="mb-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[0.55rem]">
            <span className="text-emerald-400">{activeWallets.length}</span>
            <span className="text-slate-400">{isSpanish ? 'logados ahora' : 'online now'}</span>
            <span className="text-slate-400">{totalWallets}</span>
            <span className="text-slate-500">{isSpanish ? 'wallets creadas' : 'wallets created'}</span>
            <span className="text-cyan-600">{activeWallets.length + anonCount}</span>
            <span className="text-slate-500">{isSpanish ? 'conectados IRC (wallets + anon)' : 'IRC connected (wallets + anon)'}</span>
          </div>
          {activeWallets.length > 0 && (
            <>
              <div className="mb-1 text-[0.52rem] uppercase tracking-[0.16em] text-emerald-700">
                {isSpanish ? 'wallets online' : 'online wallets'}
              </div>
              {activeWallets.map((entry) => (
                <div key={entry.wallet} className="truncate py-0.5" title={entry.wallet}>
                  <span className="text-cyan-500">{entry.source === 'google' ? 'G' : 'W'}</span>
                  <span className="mx-1 text-emerald-900">/</span>
                  {entry.wallet}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
