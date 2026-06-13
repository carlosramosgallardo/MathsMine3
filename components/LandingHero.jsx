'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { loadDailyTaskProgress } from '@/lib/daily-tasks';
import supabase from '@/lib/supabaseClient';

const C = '#22d3ee';

const SECTIONS = {
  en: [
    {
      href: '/mining', icon: '⬡', name: 'ENTER 3D MINING', kicker: 'MM3 BLOCK CHAIN · LIVE MULTIPLAYER',
      desc: '3D FPV block explorer. Find blocks, buy NFTJIs, mine cells, and fight enemy wallets live.',
      cta: 'PLAY NOW →', accent: '#22d3ee', hero: true,
    },
    { href: '/training',   icon: '⛏',  name: 'Training',    desc: 'Solve math problems against the clock. 100/day, 13 types. Speed earns more MM3.',           accent: '#f59e0b' },
    { href: '/trading',    icon: '💱',  name: 'Trading',     desc: 'Buy and sell MM3 in fictional EUR / USD / CNY. 5 EXECs/day — dice shifts rates.',             accent: '#4ade80' },
    { href: '/ranking',    icon: '🏆',  name: 'Ranking',     desc: 'Live wallet & pool leaderboard. Mining %, level, EXECs and penalty log.',                     accent: '#fbbf24' },
    { href: '/squeezing',  icon: '⚔',  name: 'Squeezing',   desc: 'Pool-vs-pool combat. Stakes burned, NFTJI drops, formula shifts.',                            accent: '#f87171' },
    { href: '/relaying',   icon: '>_', name: 'Relaying',    desc: 'Main action terminal. /mine commands, world events, live chain log.',                          accent: '#22d3ee' },
    { href: '/mm3-value',  icon: '📈',  name: 'MM3 Chart',   desc: 'Global MM3 token value over time — hourly chart with mining, trade and market event overlays.', accent: '#a78bfa' },
    { href: '/manifesto',  icon: '📜',  name: 'Manifesto',   desc: 'Game philosophy and full game guide — rules, mechanics and everything behind MathsMine3.',     accent: '#94a3b8' },
    { href: '/ai-team',    icon: '🤖',  name: 'AI Team',     desc: 'Meet the bot wallets running 24/7 on the board alongside human miners.',                       accent: '#86efac' },
    { href: '/daily-tasks', icon: '🎯', name: 'Daily Tasks', desc: 'Complete daily objectives to earn fictional EUR rewards. Resets every UTC midnight.',          accent: '#e879f9', daily: true },
  ],
  es: [
    {
      href: '/mining', icon: '⬡', name: 'ENTRA A MINING 3D', kicker: 'MM3 BLOCK CHAIN · MULTIJUGADOR EN VIVO',
      desc: 'Explorador 3D FPV de bloques. Encuentra bloques, compra NFTJIs, mina celdas y combate wallets enemigas en vivo.',
      cta: 'JUGAR AHORA →', accent: '#22d3ee', hero: true,
    },
    { href: '/training',   icon: '⛏',  name: 'Training',    desc: 'Resuelve problemas contra el reloj. 100/día, 13 tipos. Velocidad = más MM3.',                  accent: '#f59e0b' },
    { href: '/trading',    icon: '💱',  name: 'Trading',     desc: 'Compra y vende MM3 en EUR / USD / CNY ficticios. 5 EXECs/día — dados afectan tasas.',          accent: '#4ade80' },
    { href: '/ranking',    icon: '🏆',  name: 'Ranking',     desc: 'Clasificación en vivo de wallets y pools. Mining %, nivel, EXECs y penalizaciones.',           accent: '#fbbf24' },
    { href: '/squeezing',  icon: '⚔',  name: 'Squeezing',   desc: 'Combate pool-vs-pool. Stakes quemados, drops de NFTJI, la fórmula cambia.',                    accent: '#f87171' },
    { href: '/relaying',   icon: '>_', name: 'Relaying',    desc: 'Terminal de acción. Comandos /mine, eventos del mundo, log de cadena en vivo.',                 accent: '#22d3ee' },
    { href: '/mm3-value',  icon: '📈',  name: 'MM3 Chart',   desc: 'Valor global del token MM3 a lo largo del tiempo — gráfica horaria con overlays.',             accent: '#a78bfa' },
    { href: '/manifesto',  icon: '📜',  name: 'Manifiesto',  desc: 'Filosofía del juego y guía completa — reglas, mecánicas y todo lo que hay detrás.',            accent: '#94a3b8' },
    { href: '/ai-team',    icon: '🤖',  name: 'AI Team',     desc: 'Conoce los bots que corren 24/7 en el tablero junto a los mineros humanos.',                   accent: '#86efac' },
    { href: '/daily-tasks', icon: '🎯', name: 'Daily Tasks', desc: 'Completa objetivos diarios para ganar EUR ficticio. Reinicia cada medianoche UTC.',            accent: '#e879f9', daily: true },
  ],
};

export default function LandingHero() {
  const { language } = useI18n();
  const { account } = useActiveWallet();
  const [pendingRewards, setPendingRewards] = useState(0);
  const sections = SECTIONS[language] || SECTIONS.en;

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
    const timer = setInterval(load, 120_000);
    window.addEventListener('mm3-db-updated', load);
    return () => { mounted = false; clearInterval(timer); window.removeEventListener('mm3-db-updated', load); };
  }, [account]);

  const count = Math.max(0, Number(pendingRewards) || 0);
  const hero = sections[0];
  const cards = sections.slice(1);
  const carRef = useRef(null);
  const scroll = (dir) => {
    const el = carRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  return (
    <section
      aria-label={language === 'es' ? 'Sobre MathsMine3' : 'About MathsMine3'}
      style={{ fontFamily: 'Consolas,"Courier New",monospace', background: '#060a0d', borderTop: `1px solid ${C}1a`, padding: '2.5rem 1rem 4rem', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}
    >
      <div style={{ maxWidth: '1040px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* Disclaimer */}
        <p style={{ color: `${C}88`, fontSize: 'clamp(0.72rem,1.4vw,0.88rem)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '2.5rem', lineHeight: 1.7 }}>
          {language === 'es'
            ? 'Matemáticas contra el reloj · Minería ficticia · Identidad wallet · Economía terminal · MM3 es un token ficticio · Sin minería real, sin pagos reales, sin inversión.'
            : 'Timed math · Fictional mining · Wallet identity · Terminal economy · MM3 is a fictional token · No real mining, no real payout, no investment.'}
        </p>

        {/* ── Hero: Mining 3D ─────────────────────────────── */}
        <Link href={hero.href} className="lh-hero-card">
          <span className="lh-hero-scan" aria-hidden="true" />
          <div className="lh-hero-body">
            <div className="lh-hero-icon">⬡</div>
            <div className="lh-hero-text">
              <div className="lh-hero-kicker">{hero.kicker}</div>
              <div className="lh-hero-title">{hero.name}</div>
              <p className="lh-hero-desc">{hero.desc}</p>
            </div>
          </div>
          <div className="lh-hero-cta">{hero.cta}</div>
        </Link>

        {/* ── Section carousel ─────────────────────────────── */}
        <div className="lh-carousel-wrap">
          <button className="lh-car-btn" onClick={() => scroll(-1)} aria-label="Previous">‹</button>
          <div className="lh-carousel" ref={carRef}>
            {cards.map(({ href, icon, name, accent, daily }) => (
              <Link key={href} href={href} className="lh-car-card" style={{ '--lh-accent': accent }}>
                <span className="lh-car-icon" style={{ color: accent, textShadow: `0 0 12px ${accent}66` }}>{icon}</span>
                <span className="lh-car-name" style={{ color: accent }}>
                  {name}
                  {daily && count > 0 && (
                    <span style={{ marginLeft: '0.3rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '0.9rem', height: '0.9rem', borderRadius: '9999px', background: '#d946ef', border: '1px solid #e879f9', fontFamily: 'monospace', fontSize: '0.50rem', fontWeight: 900, color: '#fff', padding: '0 0.15rem', boxShadow: '0 0 8px rgba(217,70,239,.75)' }}>
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
          <button className="lh-car-btn" onClick={() => scroll(1)} aria-label="Next">›</button>
        </div>

      </div>
    </section>
  );
}
