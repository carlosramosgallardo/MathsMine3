'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { loadDailyTaskProgress } from '@/lib/daily-tasks';
import supabase from '@/lib/supabaseClient';
import HomeMiningMinimap from '@/components/HomeMiningMinimap';

// Interactive portal cards disabled during the 5-minute death cooldown
const INTERACTIVE_HREFS = new Set(['/training', '/trading', '/squeezing', '/relaying', '/daily-tasks', '/mining'])

const PORTAL = {
  en: [
    { href: '/training',    icon: '⛏',  name: 'Training',    desc: 'Solve math under pressure. 100 problems/day, 13 types.',    accent: '#f59e0b' },
    { href: '/trading',     icon: '💱',  name: 'Trading',     desc: 'Buy & sell MM3 in EUR/USD/CNY. 5 EXECs/day.',               accent: '#4ade80' },
    { href: '/squeezing',   icon: '⚔',  name: 'Squeezing',   desc: 'Pool-vs-pool combat. Burn stakes, win NFTJIs.',             accent: '#f87171' },
    { href: '/relaying',    icon: '>_', name: 'Relaying',    desc: 'Action terminal. /mine, world events, chain log.',          accent: '#22d3ee' },
    { href: '/daily-tasks', icon: '🎯',  name: 'Daily Tasks', desc: 'Daily objectives → fictional EUR rewards.',                accent: '#e879f9', daily: true },
    { href: '/mm3-value',   icon: '📈',  name: 'MM3 Chart',   desc: 'Token price over time — hourly chart.',                    accent: '#a78bfa' },
    { href: '/ranking',     icon: '🏆',  name: 'Ranking',     desc: 'Live leaderboard. Mining %, level, pool battles.',          accent: '#fbbf24' },
    { href: '/ai-team',     icon: '🤖',  name: 'AI Team',     desc: '24/7 bot wallets mining alongside humans.',                accent: '#86efac' },
    { href: '/manifesto',   icon: '📜',  name: 'Manifesto',   desc: 'Full game guide — rules, mechanics, philosophy.',          accent: '#94a3b8' },
  ],
  es: [
    { href: '/training',    icon: '⛏',  name: 'Training',    desc: 'Matemáticas bajo presión. 100 problemas/día.',              accent: '#f59e0b' },
    { href: '/trading',     icon: '💱',  name: 'Trading',     desc: 'Compra y vende MM3. 5 EXECs/día.',                         accent: '#4ade80' },
    { href: '/squeezing',   icon: '⚔',  name: 'Squeezing',   desc: 'Combate pool-vs-pool. Quema stakes, gana NFTJIs.',          accent: '#f87171' },
    { href: '/relaying',    icon: '>_', name: 'Relaying',    desc: 'Terminal de acción. /mine, eventos, log.',                 accent: '#22d3ee' },
    { href: '/daily-tasks', icon: '🎯',  name: 'Daily Tasks', desc: 'Objetivos diarios → EUR ficticio.',                        accent: '#e879f9', daily: true },
    { href: '/mm3-value',   icon: '📈',  name: 'MM3 Chart',   desc: 'Valor del token en el tiempo — gráfica horaria.',          accent: '#a78bfa' },
    { href: '/ranking',     icon: '🏆',  name: 'Ranking',     desc: 'Clasificación en vivo. Mining %, nivel, pools.',            accent: '#fbbf24' },
    { href: '/ai-team',     icon: '🤖',  name: 'AI Team',     desc: 'Bots 24/7 minando junto a humanos.',                       accent: '#86efac' },
    { href: '/manifesto',   icon: '📜',  name: 'Manifiesto',  desc: 'Guía completa — reglas, mecánicas, filosofía.',            accent: '#94a3b8' },
  ],
};

export default function LandingHero() {
  const { language } = useI18n();
  const { account } = useActiveWallet();
  const [pendingRewards, setPendingRewards] = useState(0);
  const [deadUntil, setDeadUntil] = useState(null)  // ms timestamp or null
  const [nowMs, setNowMs] = useState(() => Date.now())

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

  // Check death state from localStorage (works for both anon and logged-in wallets)
  useEffect(() => {
    const check = () => {
      try {
        const raw = localStorage.getItem('mm3_pvp_dead')
        if (!raw) { setDeadUntil(null); return }
        const data = JSON.parse(raw)
        const until = Number(data?.until)
        if (!until || until <= Date.now()) {
          localStorage.removeItem('mm3_pvp_dead')
          setDeadUntil(null)
        } else {
          setDeadUntil(until)
        }
      } catch { setDeadUntil(null) }
    }
    check()
    const t = setInterval(check, 5000)
    window.addEventListener('mm3-pvp-death', check)
    return () => { clearInterval(t); window.removeEventListener('mm3-pvp-death', check) }
  }, [])

  // Tick clock every second while dead so countdown updates
  useEffect(() => {
    if (!deadUntil) return
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [deadUntil])

  const count = Math.max(0, Number(pendingRewards) || 0);

  const isDead = deadUntil && deadUntil > nowMs
  let deadCountdown = ''
  if (isDead) {
    const msLeft = Math.max(0, deadUntil - nowMs)
    const totalSec = Math.ceil(msLeft / 1000)
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0')
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
    const ss = String(totalSec % 60).padStart(2, '0')
    deadCountdown = `${hh}:${mm}:${ss}`
  }

  return (
    <div className="mm3-home">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="mm3-splash">

        {/* animated hex grid bg */}
        <div className="mm3-splash-grid" aria-hidden="true" />

        {/* big background glow orb */}
        <div className="mm3-splash-orb" aria-hidden="true" />

        {/* scan line overlay */}
        <div className="mm3-splash-scanlines" aria-hidden="true" />

        <div className="mm3-splash-body">

          <div className="mm3-home-copy">

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

          <HomeMiningMinimap language={language} />
        </div>
      </section>

      {/* ── PORTAL GRID ──────────────────────────────────────────────────── */}
      <section className="mm3-portal">
        {(() => {
          const renderCard = ({ href, icon, name, desc, accent, daily }) => {
            const blocked = isDead && INTERACTIVE_HREFS.has(href)
            if (blocked) {
              return (
                <div
                  key={href}
                  className="mm3-portal-card"
                  style={{ '--ac': '#6b7280', opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none', userSelect: 'none' }}
                  aria-disabled="true"
                >
                  <span className="mm3-portal-block"><span className="mm3-portal-icon">💀</span></span>
                  <span className="mm3-portal-name">{name}</span>
                  <span className="mm3-portal-desc">
                    {es ? `MUERTO · revives en ${deadCountdown}` : `DEAD · revives in ${deadCountdown}`}
                  </span>
                </div>
              )
            }
            return (
              <Link key={href} href={href} className="mm3-portal-card" style={{ '--ac': accent }}>
                <span className="mm3-portal-block"><span className="mm3-portal-icon">{icon}</span></span>
                <span className="mm3-portal-name">
                  {name}
                  {daily && count > 0 && (
                    <span className="mm3-portal-badge">{count > 9 ? '9+' : count}</span>
                  )}
                </span>
                <span className="mm3-portal-desc">{desc}</span>
              </Link>
            )
          }
          return (
            <>
              <div className="mm3-portal-grid">{portal.slice(0, 5).map(renderCard)}</div>
              <div className="mm3-portal-row2">{portal.slice(5).map(renderCard)}</div>
            </>
          )
        })()}
      </section>
    </div>
  );
}
