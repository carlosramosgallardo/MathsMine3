'use client';

import { useLayoutEffect, useState } from 'react';
import MiningPageClient from '@/components/MiningPageClient';

/**
 * Bare Mining FPV for the native Android WebView.
 * - Forces touch joystick / look-pad via html.mm3-native-embed
 * - Accepts ?mm3_gw=0x… so Google/wallet session from the app lands before auth reads localStorage
 */
export default function EmbedMiningPage() {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('mm3-native-embed');

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

  if (!ready) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#070b0f',
          color: '#22d3ee',
          fontFamily: 'Consolas, monospace',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        MINING…
      </div>
    );
  }

  return <MiningPageClient />;
}
