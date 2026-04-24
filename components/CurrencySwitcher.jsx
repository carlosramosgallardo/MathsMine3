'use client';

import { useCurrency } from '@/lib/currency-context';
import { useState, useRef, useEffect } from 'react';

const CURRENCY_FLAGS = { EUR: '€', USD: '$', CNY: '¥' };

export default function CurrencySwitcher() {
  const { currency, changeCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (c) => {
    changeCurrency(c);
    setIsOpen(false);
  };

  return (
    <div className="relative z-[80]" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Change currency"
        aria-label="Change currency"
        className="flex h-7 sm:h-9 items-center gap-0.5 sm:gap-1 rounded-md px-1.5 sm:px-2 text-[0.58rem] sm:text-[0.68rem] font-mono font-bold
          bg-black border border-emerald-500/40 text-emerald-400
          hover:border-emerald-400/70 hover:text-emerald-300
          focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500
          uppercase tracking-wider transition"
      >
        {currency} <span className="text-[0.5rem] sm:text-[0.55rem] opacity-70">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 z-[120] mt-1 w-28 overflow-hidden rounded-lg border border-emerald-500/40 bg-[#0b0f19] shadow-xl">
          {['EUR', 'USD', 'CNY'].map((c) => (
            <button
              key={c}
              onClick={() => handleChange(c)}
              className={`w-full px-3 py-2 text-left text-[0.7rem] font-mono uppercase tracking-wider transition
                ${currency === c
                  ? 'bg-emerald-400 text-black font-bold'
                  : 'text-emerald-400 hover:bg-emerald-950/60'
                }`}
            >
              {CURRENCY_FLAGS[c]} {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
