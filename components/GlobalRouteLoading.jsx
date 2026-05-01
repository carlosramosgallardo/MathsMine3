'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import PageLoading from '@/components/PageLoading';

const MIN_VISIBLE_MS = 220;
const MAX_VISIBLE_MS = 900;

export default function GlobalRouteLoading() {
  const pathname = usePathname();
  const [state, setState] = useState({ visible: false, label: 'loading' });
  const startedAtRef = useRef(0);
  const hideTimerRef = useRef(null);
  const maxTimerRef = useRef(null);

  useEffect(() => {
    const show = (event) => {
      const label = String(event?.detail?.label || 'loading');
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current);
        maxTimerRef.current = null;
      }
      startedAtRef.current = Date.now();
      setState({ visible: true, label });
      maxTimerRef.current = setTimeout(() => {
        setState((current) => current.visible ? { ...current, visible: false } : current);
        maxTimerRef.current = null;
      }, MAX_VISIBLE_MS);
    };

    window.addEventListener('mm3-route-loading', show);
    return () => {
      window.removeEventListener('mm3-route-loading', show);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!state.visible) return;
    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    hideTimerRef.current = setTimeout(() => {
      setState((current) => ({ ...current, visible: false }));
      hideTimerRef.current = null;
      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current);
        maxTimerRef.current = null;
      }
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
