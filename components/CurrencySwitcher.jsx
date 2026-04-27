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
        className="flex h-7 sm:h-9 items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 text-[0.82rem] sm:text-[0.90rem] font-mono font-bold text-cyan-300
          hover:text-cyan-200 focus:outline-none uppercase tracking-wider transition"
      >
        {CURRENCY_FLAGS[currency]} <span className="text-[0.5rem] sm:text-[0.78rem] opacity-70">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 z-[120] mt-1 w-28 overflow-hidden rounded-lg border border-transparent bg-[#060a12] shadow-[0_0_18px_rgba(34,211,238,0.12)]">
          {['EUR', 'USD', 'CNY'].map((c) => (
            <button
              key={c}
              onClick={() => handleChange(c)}
              className={`w-full px-3 py-2 text-left text-[0.7rem] font-mono uppercase tracking-wider transition
                ${currency === c
                  ? 'bg-cyan-300 text-black font-bold'
                  : 'text-cyan-300 hover:bg-cyan-950/40'
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
