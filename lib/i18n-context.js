'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { translations } from './translations';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  // Always start with 'en' so SSR and first client render match, avoiding
  // hydration mismatches from localStorage/navigator reads.
  const [language, setLanguage] = useState('en');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('mm3-language');
    const detected = savedLang === 'en' || savedLang === 'es'
      ? savedLang
      : navigator.language?.startsWith('es') ? 'es' : 'en';
    setLanguage(detected);
    document.documentElement.lang = detected;
    setIsLoaded(true);
  }, []);

  const changeLanguage = (lang) => {
    if (lang === 'en' || lang === 'es') {
      setLanguage(lang);
      localStorage.setItem('mm3-language', lang);
      document.documentElement.lang = lang;
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
