'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { loadDailyTaskProgress } from '@/lib/daily-tasks';
import supabase from '@/lib/supabaseClient';

const PORTAL = {
  en: [
    { href: '/training',    icon: '⛏',  name: 'Training',    desc: 'Solve math under pressure. 100 problems/day, 13 types.',    accent: '#f59e0b' },
    { href: '/trading',     icon: '💱',  name: 'Trading',     desc: 'Buy & sell MM3 in EUR/USD/CNY. 5 EXECs/day.',               accent: '#4ade80' },
    { href: '/ranking',     icon: '🏆',  name: 'Ranking',     desc: 'Live leaderboard. Mining %, level, pool battles.',          accent: '#fbbf24' },
    { href: '/squeezing',   icon: '⚔',  name: 'Squeezing',   desc: 'Pool-vs-pool combat. Burn stakes, win NFTJIs.',             accent: '#f87171' },
    { href: '/relaying',    icon: '>_', name: 'Relaying',    desc: 'Action terminal. /mine, world events, chain log.',          accent: '#22d3ee' },
    { href: '/mm3-value',   icon: '📈',  name: 'MM3 Chart',   desc: 'Token price over time — hourly chart.',                    accent: '#a78bfa' },
    { href: '/daily-tasks', icon: '🎯',  name: 'Daily Tasks', desc: 'Daily objectives → fictional EUR rewards.',                accent: '#e879f9', daily: true },
    { href: '/ai-team',     icon: '🤖',  name: 'AI Team',     desc: '24/7 bot wallets mining alongside humans.',                accent: '#86efac' },
    { href: '/manifesto',   icon: '📜',  name: 'Manifesto',   desc: 'Full game guide — rules, mechanics, philosophy.',          accent: '#94a3b8' },
  ],
  es: [
    { href: '/training',    icon: '⛏',  name: 'Training',    desc: 'Matemáticas bajo presión. 100 problemas/día.',              accent: '#f59e0b' },
    { href: '/trading',     icon: '💱',  name: 'Trading',     desc: 'Compra y vende MM3. 5 EXECs/día.',                         accent: '#4ade80' },
    { href: '/ranking',     icon: '🏆',  name: 'Ranking',     desc: 'Clasificación en vivo. Mining %, nivel, pools.',            accent: '#fbbf24' },
    { href: '/squeezing',   icon: '⚔',  name: 'Squeezing',   desc: 'Combate pool-vs-pool. Quema stakes, gana NFTJIs.',          accent: '#f87171' },
    { href: '/relaying',    icon: '>_', name: 'Relaying',    desc: 'Terminal de acción. /mine, eventos, log.',                 accent: '#22d3ee' },
    { href: '/mm3-value',   icon: '📈',  name: 'MM3 Chart',   desc: 'Valor del token en el tiempo — gráfica horaria.',          accent: '#a78bfa' },
    { href: '/daily-tasks', icon: '🎯',  name: 'Daily Tasks', desc: 'Objetivos diarios → EUR ficticio.',                        accent: '#e879f9', daily: true },
    { href: '/ai-team',     icon: '🤖',  name: 'AI Team',     desc: 'Bots 24/7 minando junto a humanos.',                       accent: '#86efac' },
    { href: '/manifesto',   icon: '📜',  name: 'Manifiesto',  desc: 'Guía completa — reglas, mecánicas, filosofía.',            accent: '#94a3b8' },
  ],
};

export default function LandingHero() {
  const { language } = useI18n();
  const { account } = useActiveWallet();
  const [pendingRewards, setPendingRewards] = useState(0);
  const [onlineCount, setOnlineCount] = useState(null);
  const scrollRef = useRef(null);

  const portal = PORTAL[language] || PORTAL.en;
  const es = language === 'es';

  // Daily tasks badge
  useEffect(() => {
    const wallet = String(account || '').toLowerCase();
    if (!wallet) { setPendingRewards(0); return; }
    let alive = true;
    const load = async () => {
      try {
        const s = await loadDailyTaskProgress(supabase, wallet);
        if (alive) setPendingRewards(s.pendingRewards || 0);
      } catch { /* */ }
    };
    load();
    const t = setInterval(load, 120_000);
    window.addEventListener('mm3-db-updated', load);
    return () => { alive = false; clearInterval(t); window.removeEventListener('mm3-db-updated', load); };
  }, [account]);

  // Online wallet count via presence channel
  useEffect(() => {
    let ch;
    try {
      ch = supabase.channel('mm3-chain3d-v1');
      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState();
        setOnlineCount(Object.keys(state).length);
      }).subscribe();
    } catch { /* */ }
    return () => { try { ch?.unsubscribe(); } catch { /* */ } };
  }, []);

  const count = Math.max(0, Number(pendingRewards) || 0);

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="mm3-splash">

        {/* animated hex grid bg */}
        <div className="mm3-splash-grid" aria-hidden="true" />

        {/* big background glow orb */}
        <div className="mm3-splash-orb" aria-hidden="true" />

        {/* scan line overlay */}
        <div className="mm3-splash-scanlines" aria-hidden="true" />

        <div className="mm3-splash-body">

          {/* kicker */}
          <div className="mm3-splash-kicker">
            <span className="mm3-splash-live" />
            {onlineCount !== null
              ? (es ? `${onlineCount} wallets en línea` : `${onlineCount} wallets online`)
              : 'MM3 · BLOCKCHAIN GAME'}
          </div>

          {/* title */}
          <h1 className="mm3-splash-title">MATHSMINE3</h1>

          {/* tagline */}
          <p className="mm3-splash-sub">
            {es
              ? <>3D WORLD <span className="mm3-dot">·</span> RESUELVE MATEMÁTICAS <span className="mm3-dot">·</span> MINA TOKENS</>
              : <>3D WORLD <span className="mm3-dot">·</span> SOLVE MATH <span className="mm3-dot">·</span> MINE TOKENS</>}
          </p>

          {/* CTA */}
          <Link href="/mining" className="mm3-splash-cta">
            {es ? 'ENTRAR AL MINE' : 'ENTER THE MINE'}
            <span className="mm3-splash-arrow">→</span>
          </Link>

          {/* disclaimer */}
          <p className="mm3-splash-disclaimer">
            {es
              ? 'Token ficticio · Sin inversión real · Sin pagos reales'
              : 'Fictional token · No real investment · No real payout'}
          </p>
        </div>

        {/* scroll hint */}
        <button
          className="mm3-splash-scroll"
          aria-label={es ? 'Ver secciones' : 'See sections'}
          onClick={() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' })}
        >▾</button>
      </section>

      {/* ── PORTAL GRID ──────────────────────────────────────────────────── */}
      <section ref={scrollRef} className="mm3-portal">
        <div className="mm3-portal-label" aria-hidden="true">
          <span />THE PORTAL<span />
        </div>

        <div className="mm3-portal-grid">
          {portal.map(({ href, icon, name, desc, accent, daily }) => (
            <Link
              key={href}
              href={href}
              className="mm3-portal-card"
              style={{ '--ac': accent }}
            >
              <span className="mm3-portal-icon">{icon}</span>
              <span className="mm3-portal-name">
                {name}
                {daily && count > 0 && (
                  <span className="mm3-portal-badge">{count > 9 ? '9+' : count}</span>
                )}
              </span>
              <span className="mm3-portal-desc">{desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
