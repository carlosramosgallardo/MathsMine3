'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';

export default function DeadGate({ children }) {
  const { language } = useI18n();
  const es = language === 'es';
  const [deadUntil, setDeadUntil] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const check = () => {
      try {
        const raw = localStorage.getItem('mm3_pvp_dead');
        if (!raw) { setDeadUntil(null); return; }
        const data = JSON.parse(raw);
        const until = Number(data?.until);
        if (!until || until <= Date.now()) {
          localStorage.removeItem('mm3_pvp_dead');
          setDeadUntil(null);
        } else {
          setDeadUntil(until);
        }
      } catch { setDeadUntil(null); }
    };
    check();
    const t = setInterval(check, 5000);
    window.addEventListener('mm3-pvp-death', check);
    return () => { clearInterval(t); window.removeEventListener('mm3-pvp-death', check); };
  }, []);

  useEffect(() => {
    if (!deadUntil) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadUntil]);

  const isDead = deadUntil && deadUntil > nowMs;
  if (!isDead) return children;

  const msLeft = Math.max(0, deadUntil - nowMs);
  const totalSec = Math.ceil(msLeft / 1000);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  const countdown = `${hh}:${mm}:${ss}`;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '70vh', width: '100%', gap: '1.1rem',
      fontFamily: 'Consolas, "Courier New", monospace',
      background: 'transparent',
    }}>
      <div style={{
        fontSize: 'clamp(5rem, 18vw, 9rem)', lineHeight: 1,
        filter: 'grayscale(1) brightness(0.55)',
        userSelect: 'none',
      }}>💀</div>

      <div style={{
        fontSize: 'clamp(0.75rem, 2vw, 1rem)', fontWeight: 900,
        letterSpacing: '0.28em', color: '#374151', textTransform: 'uppercase',
      }}>
        {es ? 'MUERTO' : 'DEAD'}
      </div>

      <div style={{
        fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', fontWeight: 900,
        letterSpacing: '0.14em', color: '#4b5563',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {countdown}
      </div>

      <div style={{
        fontSize: 'clamp(0.58rem, 1.4vw, 0.68rem)', fontWeight: 700,
        letterSpacing: '0.22em', color: '#1f2937', textTransform: 'uppercase',
      }}>
        {es ? 'REVIVES EN' : 'REVIVES IN'}
      </div>

      <Link href="/" style={{
        marginTop: '0.6rem',
        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.20em',
        color: '#374151', textDecoration: 'none', textTransform: 'uppercase',
        border: '1px solid #1f2937', padding: '0.35rem 1rem',
        transition: 'color 0.15s, border-color 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#374151'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.borderColor = '#1f2937'; }}
      >
        ← {es ? 'VOLVER' : 'BACK'}
      </Link>
    </div>
  );
}
