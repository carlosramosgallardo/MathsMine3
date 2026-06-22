'use client';

import { useCallback, useEffect, useState } from 'react';

const isHex = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

export function useMm3Accent() {
  const [orbColor, setOrbColor] = useState('#000000');

  const reconcileTop1Color = useCallback(async () => {
    try {
      const response = await fetch('/api/portal-status');
      const data = await response.json();
      if (data?.ok && isHex(data.accent)) setOrbColor(data.accent);
    } catch {}
  }, []);

  useEffect(() => {
    reconcileTop1Color();
    const timer = setInterval(() => {
      if (!document.hidden) reconcileTop1Color();
    }, 300_000);
    const onVisible = () => {
      if (!document.hidden) reconcileTop1Color();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('mm3-db-updated', reconcileTop1Color);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('mm3-db-updated', reconcileTop1Color);
    };
  }, [reconcileTop1Color]);

  const frameAccent = orbColor.toLowerCase() !== '#000000' ? orbColor : '#cbd5e1';
  return { frameAccent, reconcileTop1Color };
}
