'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import PageLoading from '@/components/PageLoading';

const MIN_VISIBLE_MS = 220;

export default function GlobalRouteLoading() {
  const pathname = usePathname();
  const [state, setState] = useState({ visible: false, label: 'loading' });
  const startedAtRef = useRef(0);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const show = (event) => {
      const label = String(event?.detail?.label || 'loading');
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      startedAtRef.current = Date.now();
      setState({ visible: true, label });
    };

    window.addEventListener('mm3-route-loading', show);
    return () => {
      window.removeEventListener('mm3-route-loading', show);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!state.visible) return;
    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    hideTimerRef.current = setTimeout(() => {
      setState((current) => ({ ...current, visible: false }));
      hideTimerRef.current = null;
    }, remaining);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [pathname]);

  if (!state.visible) return null;
  return <PageLoading label={state.label} />;
}
