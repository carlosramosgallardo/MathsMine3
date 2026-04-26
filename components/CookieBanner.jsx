'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * CookieBanner — Minimal cookie consent component
 *
 * Stores consent preference in localStorage under 'mm3_cookies_accepted'.
 * Used for tracking analytics and marketing pixels (Google Analytics, GTM, AdSense, etc.).
 * Only shows if consent has not been previously stored.
 *
 * Complies with GDPR/ePrivacy cookie consent requirements.
 */
export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage for prior consent
    const cookieConsent = localStorage.getItem('mm3_cookies_accepted');
    if (!cookieConsent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('mm3_cookies_accepted', 'true');
    localStorage.setItem('mm3_cookies_accepted_at', new Date().toISOString());
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem('mm3_cookies_accepted', 'false');
    localStorage.setItem('mm3_cookies_accepted_at', new Date().toISOString());
    setShowBanner(false);
  };

  if (!mounted || !showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 border-t border-cyan-500/20 p-3 sm:p-4 text-[0.7rem] sm:text-xs font-mono text-gray-300 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">

        {/* Cookie notice text */}
        <div className="flex-1">
          <p className="leading-relaxed">
            We use cookies for analytics and advertising ({' '}
            <span className="text-cyan-400">Google Analytics, GTM, AdSense</span>
            ). See our{' '}
            <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300 underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {/* Consent buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDecline}
            className="px-3 py-1.5 border border-slate-700/60 rounded text-slate-500 hover:text-slate-400 hover:border-slate-600 transition-colors whitespace-nowrap"
          >
            [ Decline ]
          </button>
          <button
            onClick={handleAccept}
            className="px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/40 rounded text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-400/60 transition-colors whitespace-nowrap"
          >
            [ Accept ]
          </button>
        </div>
      </div>
    </div>
  );
}
