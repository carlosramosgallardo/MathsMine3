'use client';

import { useI18n } from '@/lib/i18n-context';
import { useState, useRef, useEffect } from 'react';

export default function LanguageSwitcher() {
  const { language, changeLanguage } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (lang) => {
    changeLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className="relative z-[80]" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Change language"
        aria-label="Change language"
        className="flex h-7 sm:h-9 items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 text-[0.58rem] sm:text-[0.68rem] font-mono font-bold text-cyan-300
          hover:text-cyan-200 focus:outline-none uppercase tracking-wider transition"
      >
        {language.toUpperCase()} <span className="text-[0.5rem] sm:text-[0.55rem] opacity-70">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 z-[120] mt-1 w-32 overflow-hidden rounded-lg border border-transparent bg-[#060a12] shadow-[0_0_18px_rgba(34,211,238,0.12)]">
          <button
            onClick={() => handleLanguageChange('en')}
            className={`w-full px-3 py-2 text-left text-[0.7rem] font-mono uppercase tracking-wider transition
              ${language === 'en'
                ? 'bg-cyan-300 text-black font-bold'
                : 'text-cyan-300 hover:bg-cyan-950/40'
              }`}
          >
            🇬🇧 English
          </button>
          <button
            onClick={() => handleLanguageChange('es')}
            className={`w-full px-3 py-2 text-left text-[0.7rem] font-mono uppercase tracking-wider transition
              ${language === 'es'
                ? 'bg-cyan-300 text-black font-bold'
                : 'text-cyan-300 hover:bg-cyan-950/40'
              }`}
          >
            🇪🇸 Español
          </button>
        </div>
      )}
    </div>
  );
}
