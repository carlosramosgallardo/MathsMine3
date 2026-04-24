'use client';

import { useSound } from '@/lib/sound-context';
import { useI18n } from '@/lib/i18n-context';

export default function SoundToggle() {
  const { enabled, toggleSound } = useSound();
  const { t } = useI18n();
  const label = enabled ? t('wallet.soundOn') : t('wallet.soundOff');

  return (
    <button
      type="button"
      onClick={toggleSound}
      title={label}
      aria-label={label}
      aria-pressed={enabled}
      className={`flex h-7 sm:h-9 items-center justify-center rounded-md px-1.5 sm:px-2 text-[0.72rem] sm:text-[0.82rem] font-mono font-bold
        bg-black border transition uppercase tracking-wider focus:outline-none focus-visible:ring-1
        ${enabled
          ? 'border-emerald-500/40 text-emerald-300 hover:border-emerald-400/70 focus-visible:ring-emerald-500'
          : 'border-slate-700/60 text-slate-500 hover:border-slate-500/70 focus-visible:ring-slate-500'
        }`}
    >
      {enabled ? '🔊' : '🔇'}
    </button>
  );
}
