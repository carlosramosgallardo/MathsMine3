'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const SoundContext = createContext(null);

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  return AudioCtx ? new AudioCtx() : null;
}

export function SoundProvider({ children }) {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('mm3-sound-enabled') !== 'false';
  });
  // Music is a separate switch from the effects: either can be off while the
  // other keeps playing.
  const [musicEnabled, setMusicEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('mm3-music-enabled') !== 'false';
  });
  const audioRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mm3-sound-enabled', enabled ? 'true' : 'false');
    }
  }, [enabled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mm3-music-enabled', musicEnabled ? 'true' : 'false');
    }
  }, [musicEnabled]);

  // Portal-wide ambient music — loops at low volume on every page while the
  // music switch is on. Autoplay is blocked until the first user gesture, so
  // retry on pointer/key input; pause while the tab is hidden.
  useEffect(() => {
    if (!musicEnabled || typeof window === 'undefined') return undefined;
    const music = new Audio('/ambient/freakingai_mm3_song.mp3');
    music.loop = true;
    music.volume = 0.12;
    music.preload = 'auto';
    let disposed = false;
    const tryPlay = () => { if (!disposed && !document.hidden) music.play().catch(() => {}); };
    const onGesture = () => tryPlay();
    const onVisibility = () => { if (document.hidden) music.pause(); else tryPlay(); };
    tryPlay();
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      document.removeEventListener('visibilitychange', onVisibility);
      music.pause();
      music.src = '';
    };
  }, [musicEnabled]);

  const ensureAudio = async () => {
    if (!enabled) return null;
    if (!audioRef.current) audioRef.current = getAudioContext();
    const ctx = audioRef.current;
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { return null; }
    }
    return ctx;
  };

  const playTone = async ({ frequency, duration = 0.14, delay = 0, type = 'sine', volume = 0.035 }) => {
    const ctx = await ensureAudio();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  };

  const playSuccess = () => {
    playTone({ frequency: 880, duration: 0.13, volume: 0.03 });
    playTone({ frequency: 1320, duration: 0.18, delay: 0.09, volume: 0.026 });
  };

  const playFailure = () => {
    playTone({ frequency: 185, duration: 0.2, type: 'sawtooth', volume: 0.032 });
    playTone({ frequency: 125, duration: 0.28, delay: 0.13, type: 'sawtooth', volume: 0.028 });
  };

  // Discrete two-tone chime for buy/sell trade confirmation
  const playTrade = () => {
    playTone({ frequency: 523, duration: 0.12, volume: 0.025 });
    playTone({ frequency: 784, duration: 0.15, delay: 0.11, volume: 0.022 });
  };

  // Soft shimmering reward cue for Market NFTJI purchases
  const playMarketClaim = () => {
    playTone({ frequency: 659, duration: 0.08, type: 'triangle', volume: 0.020 });
    playTone({ frequency: 988, duration: 0.11, delay: 0.08, type: 'triangle', volume: 0.018 });
    playTone({ frequency: 1319, duration: 0.16, delay: 0.16, type: 'sine', volume: 0.017 });
    playTone({ frequency: 1760, duration: 0.22, delay: 0.25, type: 'sine', volume: 0.014 });
  };

  // Tiny navigation tick — hovering across the home nonagon sides
  const playNavTick = () => {
    playTone({ frequency: 980, duration: 0.05, type: 'square', volume: 0.012 });
    playTone({ frequency: 1470, duration: 0.04, delay: 0.02, type: 'sine', volume: 0.008 });
  };

  // Gentle terminal ping for IRC activity
  const playIrcMessage = () => {
    playTone({ frequency: 740, duration: 0.06, type: 'triangle', volume: 0.014 });
    playTone({ frequency: 988, duration: 0.09, delay: 0.055, type: 'sine', volume: 0.011 });
  };

  // Triple ascending ping — dice window opens (x3 pattern)
  const playDiceActivate = () => {
    for (let i = 0; i < 3; i++) {
      const base = i * 0.32;
      playTone({ frequency: 440, duration: 0.09, delay: base,        volume: 0.020 });
      playTone({ frequency: 554, duration: 0.09, delay: base + 0.10, volume: 0.022 });
      playTone({ frequency: 659, duration: 0.11, delay: base + 0.20, volume: 0.024 });
    }
  };

  // Sparkling ascending arpeggio — NFTJI drops during mining
  const playNftDrop = () => {
    playTone({ frequency: 523,  duration: 0.07, delay: 0,    type: 'triangle', volume: 0.018 });
    playTone({ frequency: 784,  duration: 0.08, delay: 0.07, type: 'triangle', volume: 0.020 });
    playTone({ frequency: 1047, duration: 0.10, delay: 0.14, type: 'sine',     volume: 0.022 });
    playTone({ frequency: 1568, duration: 0.14, delay: 0.22, type: 'sine',     volume: 0.018 });
    playTone({ frequency: 2093, duration: 0.18, delay: 0.34, type: 'sine',     volume: 0.013 });
  };

  // Power chord pulse — rank tier advancement
  const playTierUp = () => {
    playTone({ frequency: 440,  duration: 0.12, delay: 0,    type: 'square',   volume: 0.018 });
    playTone({ frequency: 660,  duration: 0.14, delay: 0.10, type: 'square',   volume: 0.020 });
    playTone({ frequency: 880,  duration: 0.18, delay: 0.22, type: 'sine',     volume: 0.024 });
    playTone({ frequency: 1320, duration: 0.22, delay: 0.36, type: 'sine',     volume: 0.020 });
  };

  // Triple descending ping — dice window closes (x3 pattern)
  const playDiceDeactivate = () => {
    for (let i = 0; i < 3; i++) {
      const base = i * 0.32;
      playTone({ frequency: 659, duration: 0.09, delay: base,        volume: 0.024 });
      playTone({ frequency: 554, duration: 0.09, delay: base + 0.10, volume: 0.022 });
      playTone({ frequency: 440, duration: 0.11, delay: base + 0.20, type: 'sine', volume: 0.020 });
    }
  };

  const value = useMemo(() => ({
    enabled,
    toggleSound: () => setEnabled(c => !c),
    musicEnabled,
    toggleMusic: () => setMusicEnabled(c => !c),
    playNavTick,
    playSuccess,
    playFailure,
    playTrade,
    playMarketClaim,
    playIrcMessage,
    playNftDrop,
    playTierUp,
    playDiceActivate,
    playDiceDeactivate,
  }), [enabled, musicEnabled]);

  return (
    <SoundContext.Provider value={value}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) throw new Error('useSound must be used within SoundProvider');
  return context;
}
