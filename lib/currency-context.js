'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const CurrencyContext = createContext(null);

const VALID_CURRENCIES = ['EUR', 'USD', 'CNY'];

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => {
    if (typeof window === 'undefined') return 'EUR';
    const saved = localStorage.getItem('mm3-preferred-currency');
    return VALID_CURRENCIES.includes(saved) ? saved : 'EUR';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mm3-preferred-currency', currency);
    }
  }, [currency]);

  const changeCurrency = (c) => {
    if (VALID_CURRENCIES.includes(c)) setCurrencyState(c);
  };

  return (
    <CurrencyContext.Provider value={{ currency, changeCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
}
