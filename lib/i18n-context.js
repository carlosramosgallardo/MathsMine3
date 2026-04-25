'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { translations } from './translations';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    const savedLang = localStorage.getItem('mm3-language');
    if (savedLang === 'en' || savedLang === 'es') return savedLang;
    return navigator.language?.startsWith('es') ? 'es' : 'en';
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = language;
    }
    setIsLoaded(true);
  }, [language]);

  const changeLanguage = (lang) => {
    if (lang === 'en' || lang === 'es') {
      setLanguage(lang);
      if (typeof window !== 'undefined') {
        localStorage.setItem('mm3-language', lang);
      }
    }
  };

  const t = (key) => {
    const keys = key.split('.');
    let value = translations[language];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  return (
    <I18nContext.Provider value={{ language, changeLanguage, t, isLoaded }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
