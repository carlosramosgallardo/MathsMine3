'use client';

import { useEffect, useState } from 'react';

const SPINNER_FRAMES = ['◜', '◠', '◝', '◞', '◡', '◟'];
const DOT_FRAMES = ['.  ', '.. ', '...', ' ..', '  .'];

export default function PageLoading({ label = 'loading', fullScreen = true }) {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [dotFrame, setDotFrame] = useState(0);

  useEffect(() => {
    const spinnerId = setInterval(() => setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length), 100);
    const dotId = setInterval(() => setDotFrame((f) => (f + 1) % DOT_FRAMES.length), 200);
    return () => {
      clearInterval(spinnerId);
      clearInterval(dotId);
    };
  }, []);

  return (
    <div
      className={
        fullScreen
          ? 'fixed inset-0 z-[120] flex items-center justify-center bg-black/96 px-6 font-mono'
          : 'flex h-20 items-center justify-center font-mono'
      }
    >
      <style>{`
        @keyframes glitch-flicker {
          0%, 100% { text-shadow: 0 0 8px rgba(34, 211, 238, 0.4); }
          50% { text-shadow: 0 0 20px rgba(34, 211, 238, 0.8), 0 0 30px rgba(34, 211, 238, 0.5); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .loading-spinner {
          animation: glitch-flicker 0.4s infinite, pulse-glow 1.5s infinite;
        }
        .loading-dots {
          animation: pulse-glow 1s infinite;
        }
      `}</style>
      <div className="text-center">
        <div className={fullScreen ? 'mb-4 text-3xl sm:text-4xl' : 'mb-3 text-2xl'} style={{ color: '#22d3ee' }}>
          <span className="loading-spinner">{SPINNER_FRAMES[spinnerFrame]}</span>
        </div>
        <div
          className={fullScreen ? 'loading-dots text-[0.95rem] uppercase tracking-[0.24em] sm:text-[0.8rem]' : 'text-[0.88rem] uppercase tracking-[0.22em] loading-dots'}
          style={{ color: 'rgba(34,211,238,0.8)' }}
        >
          {label}
          <span className="inline-block w-6 text-left">{DOT_FRAMES[dotFrame]}</span>
        </div>
      </div>
    </div>
  );
}
