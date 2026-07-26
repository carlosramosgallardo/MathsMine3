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
        if (!el) return;
        // Prefer scrollHeight after wrap (controls row + wallet row).
        const h = Math.ceil(Math.max(el.getBoundingClientRect().height, el.scrollHeight));
        if (h > 0 && window.MM3NativeHeader?.onHeight) {
          window.MM3NativeHeader.onHeight(h);
        }
      } catch {
        /* ignore */
      }
    };
    report();
    const times = [50, 150, 400, 900, 1600].map((ms) => window.setTimeout(report, ms));
    window.addEventListener('resize', report);
    let ro;
    try {
      const el = document.querySelector('header');
      if (el && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => report());
        ro.observe(el);
      }
    } catch {
      /* ignore */
    }
    return () => {
      times.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('resize', report);
      try { ro?.disconnect(); } catch { /* */ }
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
