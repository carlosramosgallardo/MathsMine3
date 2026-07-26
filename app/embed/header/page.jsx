'use client';

import { useLayoutEffect, useState } from 'react';
import Header from '@/components/Header';

/**
 * Real portal Header (ticker + pulse + controls + wallet row) for the Android app shell.
 * Query ?mm3_gw=0x… seeds Google/virtual wallet before AuthBar mounts.
 */
export default function EmbedHeaderPage() {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('mm3-native-embed', 'mm3-native-header-embed');

    try {
      const params = new URLSearchParams(window.location.search);
      const gw = params.get('mm3_gw');
      if (gw && /^0x[a-fA-F0-9]{40}$/.test(gw)) {
        localStorage.setItem('mm3_gw', gw.toLowerCase());
      }
      if (params.has('mm3_gw') && window.history.replaceState) {
        params.delete('mm3_gw');
        const q = params.toString();
        const clean = window.location.pathname + (q ? `?${q}` : '') + window.location.hash;
        window.history.replaceState(null, '', clean);
      }
    } catch {
      /* ignore */
    }

    setReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!ready) return undefined;
    const report = () => {
      try {
        const el = document.querySelector('header');
        const h = Math.ceil(el?.getBoundingClientRect().height || 0);
        if (h > 0 && window.MM3NativeHeader?.onHeight) {
          window.MM3NativeHeader.onHeight(h);
        }
      } catch {
        /* ignore */
      }
    };
    report();
    const t = window.setTimeout(report, 120);
    const t2 = window.setTimeout(report, 600);
    window.addEventListener('resize', report);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
      window.removeEventListener('resize', report);
    };
  }, [ready]);

  if (!ready) {
    return (
      <div
        style={{
          height: 120,
          background: '#01070e',
          color: '#22d3ee',
          fontFamily: 'Consolas, monospace',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        HEADER…
      </div>
    );
  }

  return <Header />;
}
