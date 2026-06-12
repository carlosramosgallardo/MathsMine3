'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { normalizeMacroState } from '@/lib/mm3-macro';
import { useI18n } from '@/lib/i18n-context';
import { useDice } from '@/lib/dice-context';
import { useIrcPresence } from '@/lib/relaying-presence-context';

export default function GlobalPulseBar() {
  const { language } = useI18n();
  const dice = useDice();
  const { activeWallets, totalWallets } = useIrcPresence();

  const [macro, setMacro] = useState(() => normalizeMacroState());

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
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const isSpanish = language === 'es';
  const items = [
    { emoji: '🔥', value: macro.war_percent,    color: '#fb7185' },
    { emoji: '🌪️', value: macro.nature_percent, color: '#67e8f9' },
  ];
  const diceModPct = dice ? Math.round(Math.abs(dice.modifier) * 100) : 0;
  const diceSign   = dice?.modifier >= 0 ? '+' : '−';

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <div className="flex items-center gap-0.5 sm:gap-1">
        {items.map((item) => (
          <div
            key={item.emoji}
            className="flex h-7 sm:h-9 items-center gap-0.5 px-0.5 sm:px-1 font-mono text-[0.88rem] sm:text-[0.90rem] font-black"
            style={{ color: item.color }}
          >
            <span>{item.emoji}</span>
            <span>{item.value.toFixed(0)}%</span>
          </div>
        ))}
        {dice && (
          <div
            className="flex h-7 sm:h-9 items-center gap-0.5 px-0.5 sm:px-1 font-mono text-[0.88rem] sm:text-[0.90rem] font-black"
            style={{ color: dice.active ? dice.color : '#334155' }}
          >
            <span>🎲</span>
            <span>{dice.active ? `${diceSign}${diceModPct}%` : '0%'}</span>
          </div>
        )}
      </div>

      <div
        className="group relative flex h-7 items-center gap-[3px] px-0.5 sm:px-1 font-mono text-[0.82rem] font-black sm:h-9 sm:text-[0.90rem]"
        title={
          isSpanish
            ? `wallets online: ${activeWallets.length} / creadas en ranking: ${totalWallets}`
            : `wallets online: ${activeWallets.length} / ranking wallets: ${totalWallets}`
        }
      >
        <span className="text-emerald-400 tabular-nums">{activeWallets.length}</span>
        <span className="text-slate-600 text-[0.70rem]">/</span>
        <span className="text-slate-500 tabular-nums">{totalWallets}</span>
        <span className="text-slate-600 text-[0.65rem]">wal</span>
      </div>
    </div>
  );
}
