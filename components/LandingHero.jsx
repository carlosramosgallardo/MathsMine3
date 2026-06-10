'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { loadDailyTaskProgress } from '@/lib/daily-tasks';
import supabase from '@/lib/supabaseClient';

const C = '#22d3ee';

const SECTIONS = {
  en: [
    { href: '/security',   icon: '🔐',  name: 'Security',    desc: 'AI-powered security audit. OSV vulnerability scan, header analysis, auth probing — full report & PDF export.', secCard: true },
    { href: '/hotel',      icon: '🏨',  name: 'MM3 Hotel',   desc: 'Explore the 28×28 mining grid in real-time 3D isometric view. Your wallet is an avatar. See other miners live.' },
    { href: '/training',   icon: '⛏',  name: 'Training',    desc: 'Solve math problems against the clock. 100/day, 13 types. Speed earns more MM3.' },
    { href: '/mining',     icon: '⬛',  name: 'Mining',      desc: '784-cell 28×28 board. Race to claim cells permanently with NFTJIs.' },
    { href: '/trading',    icon: '💱',  name: 'Trading',     desc: 'Buy and sell MM3 in fictional EUR / USD / CNY. 5 EXECs/day — dice shifts rates.' },
    { href: '/ranking',    icon: '🏆',  name: 'Ranking',     desc: 'Live wallet & pool leaderboard. Mining %, level, EXECs and penalty log.' },
    { href: '/squeezing',  icon: '⚔',  name: 'Squeezing',   desc: 'Pool-vs-pool combat. Stakes burned, NFTJI drops, formula shifts.' },
    { href: '/relaying',   icon: '>_', name: 'Relaying',    desc: 'Main action terminal. /mine commands, world events, live chain log.' },
    { href: '/mm3-value',  icon: '📈',  name: 'MM3 Chart',   desc: 'Global MM3 token value over time — hourly chart with mining, trade and market event overlays.' },
    { href: '/manifesto',  icon: '📜',  name: 'Manifesto',   desc: 'Game philosophy and full game guide — rules, mechanics and everything behind MathsMine3.' },
    { href: '/ai-team',    icon: '🤖',  name: 'AI Team',     desc: 'Meet the bot wallets running 24/7 on the board alongside human miners.' },
    { href: '/daily-tasks', icon: '🎯', name: 'Daily Tasks', desc: 'Complete daily objectives to earn fictional EUR rewards. Resets every UTC midnight.', daily: true },
    { href: '/relaying?command=/rm+-rf+%24MM3_BLOCK_CHAIN&chip=1', icon: null, name: 'KERNEL PANIC', desc: '<!-- /rm -rf $MM3_BLOCK_CHAIN -->', kernelPanic: true, chip: 1 },
  ],
  es: [
    { href: '/security',   icon: '🔐',  name: 'Security',    desc: 'Auditoría de seguridad con IA. Escaneo OSV, análisis de cabeceras, sondeo de autenticación — informe completo y PDF.', secCard: true },
    { href: '/hotel',      icon: '🏨',  name: 'MM3 Hotel',   desc: 'Explora el tablero 28×28 en 3D isométrico en tiempo real. Tu wallet es tu avatar. Ve al resto de mineros en vivo.' },
    { href: '/training',   icon: '⛏',  name: 'Training',    desc: 'Resuelve problemas contra el reloj. 100/día, 13 tipos. Velocidad = más MM3.' },
    { href: '/mining',     icon: '⬛',  name: 'Mining',      desc: 'Tablero 28×28 de 784 celdas. Carrera por reclamarlas con NFTJIs.' },
    { href: '/trading',    icon: '💱',  name: 'Trading',     desc: 'Compra y vende MM3 en EUR / USD / CNY ficticios. 5 EXECs/día — dados afectan tasas.' },
    { href: '/ranking',    icon: '🏆',  name: 'Ranking',     desc: 'Clasificación en vivo de wallets y pools. Mining %, nivel, EXECs y penalizaciones.' },
    { href: '/squeezing',  icon: '⚔',  name: 'Squeezing',   desc: 'Combate pool-vs-pool. Stakes quemados, drops de NFTJI, la fórmula cambia.' },
    { href: '/relaying',   icon: '>_', name: 'Relaying',    desc: 'Terminal de acción. Comandos /mine, eventos del mundo, log de cadena en vivo.' },
    { href: '/mm3-value',  icon: '📈',  name: 'MM3 Chart',   desc: 'Valor global del token MM3 a lo largo del tiempo — gráfica horaria con overlays de mining, trade y mercado.' },
    { href: '/manifesto',  icon: '📜',  name: 'Manifiesto',  desc: 'Filosofía del juego y guía completa — reglas, mecánicas y todo lo que hay detrás de MathsMine3.' },
    { href: '/ai-team',    icon: '🤖',  name: 'AI Team',     desc: 'Conoce los bots que corren 24/7 en el tablero junto a los mineros humanos.' },
    { href: '/daily-tasks', icon: '🎯', name: 'Daily Tasks', desc: 'Completa objetivos diarios para ganar EUR ficticio. Reinicia cada medianoche UTC.', daily: true },
    { href: '/relaying?command=/rm+-rf+%24MM3_BLOCK_CHAIN&chip=1', icon: null, name: 'KERNEL PANIC', desc: '<!-- /rm -rf $MM3_BLOCK_CHAIN -->', kernelPanic: true, chip: 1 },
  ],
};

function KernelPanicInner({ icon, name, desc, scanDate, daily, count, kernelPanic, kpResetsAt, nameColor, descColor }) {
  const remaining = useCountdown(kpResetsAt);
  const countdown = kpResetsAt ? formatCountdown(remaining) : null;
  const isLocked = kernelPanic && countdown;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
        {icon && <span style={{ fontSize: '0.95rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>}
        <span style={{ color: nameColor, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', fontFamily: 'monospace' }}>{name}</span>
        {daily && count > 0 && (
          <span style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: '1rem', height: '1rem', borderRadius: '9999px',
            background: '#d946ef', border: '1px solid #e879f9',
            fontFamily: 'monospace', fontSize: '0.56rem', fontWeight: 900,
            color: '#fff', padding: '0 0.2rem',
            boxShadow: '0 0 8px rgba(217,70,239,0.75)',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
        {isLocked && (
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'monospace', fontSize: '0.56rem', fontWeight: 900,
            color: '#ef4444', letterSpacing: '0.05em',
          }}>
            {countdown}
          </span>
        )}
      </div>
      <p style={{ color: descColor, fontSize: '0.72rem', margin: 0, lineHeight: '1.5', wordBreak: 'break-word', letterSpacing: '0.04em', fontFamily: 'monospace' }}>{desc}</p>
      {scanDate && (
        <p style={{ color: '#4a2d66', fontSize: '0.62rem', margin: 0, lineHeight: '1.4', fontFamily: 'monospace', letterSpacing: '0.03em' }}>{scanDate}</p>
      )}
    </>
  );
}

function useCountdown(resetsAt) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!resetsAt) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, resetsAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resetsAt]);
  return remaining;
}

function formatCountdown(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function LandingHero() {
  const { language } = useI18n();
  const { account } = useActiveWallet();
  const [pendingRewards, setPendingRewards] = useState(0);
  const [chipCooldowns, setChipCooldowns] = useState({ chip1: null, chip2: null });
  const [lastScan, setLastScan] = useState(null);
  const sections = SECTIONS[language] || SECTIONS.en;

  useEffect(() => {
    let mounted = true;
    const fetchLastScan = () => {
      fetch('/api/security/scan')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (mounted && data) setLastScan(data); })
        .catch(() => {});
    };
    fetchLastScan();
    const timer = setInterval(fetchLastScan, 30_000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const wallet = String(account || '').toLowerCase();
    if (!wallet) { setPendingRewards(0); return; }
    let mounted = true;
    const load = async () => {
      try {
        const state = await loadDailyTaskProgress(supabase, wallet);
        if (mounted) setPendingRewards(state.pendingRewards || 0);
      } catch { if (mounted) setPendingRewards(0); }
    };
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener('mm3-db-updated', load);
    return () => { mounted = false; clearInterval(timer); window.removeEventListener('mm3-db-updated', load); };
  }, [account]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/rm-rf-chain');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setChipCooldowns({
          chip1: data.chip1?.active ? data.chip1.resetsAt : null,
          chip2: data.chip2?.active ? data.chip2.resetsAt : null,
        });
      } catch {}
    };
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener('mm3-db-updated', load);
    return () => { mounted = false; clearInterval(timer); window.removeEventListener('mm3-db-updated', load); };
  }, []);

  const count = Math.max(0, Number(pendingRewards) || 0);

  return (
    <section
      aria-label={language === 'es' ? 'Sobre MathsMine3' : 'About MathsMine3'}
      style={{
        fontFamily: 'Consolas, "Courier New", monospace',
        background: '#060a0d',
        borderTop: `1px solid ${C}1a`,
        padding: '2rem 1rem 3rem',
        marginTop: '1rem',
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <div style={{ maxWidth: '920px', margin: '0 auto', width: '100%', boxSizing: 'border-box', minWidth: 0 }}>

        <p style={{
          color: C,
          fontSize: 'clamp(0.9rem, 2vw, 1.2rem)',
          textShadow: `0 0 20px ${C}55`,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textAlign: 'center',
          marginBottom: '1.75rem',
        }}>
          {language === 'es' ? 'Matemáticas contra el reloj. Minería ficticia. Identidad wallet. Economía terminal. MM3 es un token ficticio. Sin minería real, sin pagos reales, sin inversión.' : 'Timed math. Fictional mining. Wallet identity. Terminal economy. MM3 is a fictional token. No real mining, no real payout, no investment.'}
        </p>

        <ul className="landing-grid" style={{
          display: 'grid',
          gap: '0.6rem',
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}>
          {sections.map(({ href, icon, name, desc, daily, kernelPanic, chip, secCard }, idx) => {
            const kpResetsAt = kernelPanic ? chipCooldowns[`chip${chip}`] : null;
            const SEC = '#a855f7';
            const borderColor = kernelPanic ? '#ef444420' : secCard ? `${SEC}28` : `${C}18`;
            const bg = kernelPanic ? '#0d0505' : secCard ? '#0d0a14' : '#0b1015';
            const nameColor = kernelPanic ? '#ef4444' : secCard ? SEC : '#e2e8f0';
            const descColor = kernelPanic ? '#7f1d1d' : secCard ? '#5b3a7a' : '#475569';

            const effectiveDesc = secCard && lastScan?.summary ? lastScan.summary : desc;
            const scanDate = secCard && lastScan?.triggered_at
              ? new Date(lastScan.triggered_at).toLocaleString()
              : null;

            const inner = (
              <KernelPanicInner
                icon={icon}
                name={name}
                desc={effectiveDesc}
                scanDate={scanDate}
                daily={daily}
                count={count}
                kernelPanic={kernelPanic}
                kpResetsAt={kpResetsAt}
                nameColor={nameColor}
                descColor={descColor}
              />
            );

            const cardStyle = {
              display: 'flex', flexDirection: 'column', gap: '0.35rem',
              background: bg, border: `1px solid ${borderColor}`,
              borderRadius: '8px', padding: '0.85rem 1rem',
              textDecoration: 'none', height: '100%', boxSizing: 'border-box',
              transition: 'border-color 0.18s, background 0.18s',
              cursor: 'pointer',
            };

            const hoverBorder = kernelPanic ? '#ef444455' : secCard ? `${SEC}66` : `${C}55`;
            const hoverBg = kernelPanic ? '#150808' : secCard ? '#130a1a' : '#0d1419';

            return (
              <li key={`${href ?? name}-${idx}`} style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <Link
                  href={href}
                  style={{ ...cardStyle, flex: 1 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = hoverBorder; e.currentTarget.style.background = hoverBg; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.background = bg; }}
                >
                  {inner}
                </Link>
              </li>
            );
          })}
        </ul>


      </div>
    </section>
  );
}
