'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n-context';
import { useSound } from '@/lib/sound-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { loadDailyTaskProgress } from '@/lib/daily-tasks';
import supabase from '@/lib/supabaseClient';
import HomeMiningScene from '@/components/HomeMiningScene';
import HomeWorldMinimap from '@/components/HomeWorldMinimap';
import { prefetchMiningRoute } from '@/lib/prefetch-mining';

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
    { href: '/ranking',     icon: '🏆',  name: 'Ranking',     desc: 'Live leaderboard. Wallet & pool ranks.',                    accent: '#fbbf24' },
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
    { href: '/ranking',     icon: '🏆',  name: 'Ranking',     desc: 'Clasificación en vivo. Ranks de wallets y pools.',          accent: '#fbbf24' },
    { href: '/ai-team',     icon: '🤖',  name: 'AI Team',     desc: 'Bots 24/7 minando junto a humanos.',                       accent: '#86efac' },
    { href: '/manifesto',   icon: '📜',  name: 'Manifiesto',  desc: 'Guía completa — reglas, mecánicas, filosofía.',            accent: '#94a3b8' },
  ],
};

/**
 * The nine portal accesses as a nonagon: each side is one access (its accent
 * colour + icon); hovering/selecting a side extends that card's info in the
 * centre, clicking the side (or the centre button) navigates.
 */
function NonagonPortal({ portal, es, isDead, deadCountdown, count }) {
  const router = useRouter()
  const { playNavTick } = useSound()
  const [sel, setSel] = useState(0)
  // Core toggle: MM3 logo (compact — the avatar showcase gets the spotlight)
  // ⇄ extended world minimap (the nonagon grows to fit it).
  const [mapOpen, setMapOpen] = useState(false)
  const markSide = (i) => {
    if (i === sel) return
    setSel(i)
    playNavTick()
  }

  // Auto-rotation: every 3s the marked side advances and the card cycles
  // through the nine accesses. Pauses while the pointer is over the polygon
  // (manual browsing wins) and while the map is open. Silent — the nav tick
  // only plays on manual hovering.
  const [autoPaused, setAutoPaused] = useState(false)
  useEffect(() => {
    if (mapOpen || autoPaused) return undefined
    const id = setInterval(() => {
      setSel((s) => (s + 1) % portal.length)
    }, 3000)
    return () => clearInterval(id)
  }, [mapOpen, autoPaused, portal.length])
  const C = 200
  const R = 176
  const pt = (i) => {
    const a = ((-90 + i * 40) * Math.PI) / 180
    return [C + R * Math.cos(a), C + R * Math.sin(a)]
  }
  const isBlocked = (href) => isDead && INTERACTIVE_HREFS.has(href)
  const current = portal[sel] || portal[0]
  const currentBlocked = isBlocked(current.href)

  // Map mode: no polygon at all — the world minimap takes the full carpet
  // width on its own; clicking it warps back to the logo + nonagon.
  if (mapOpen) {
    return (
      <div className="mm3-nonagon is-open">
        <button
          type="button"
          className="mm3-nonagon-mapfull"
          onClick={() => setMapOpen(false)}
          title={es ? 'Mostrar logo MM3' : 'Show MM3 logo'}
        >
          <span className="mm3-nonagon-core-flip">
            <HomeWorldMinimap es={es} />
          </span>
        </button>
      </div>
    )
  }

  return (
    <div
      className="mm3-nonagon"
      onMouseEnter={() => setAutoPaused(true)}
      onMouseLeave={() => setAutoPaused(false)}
    >
      <div className="mm3-nonagon-ring">
      <svg viewBox="0 0 400 400" className="mm3-nonagon-svg" aria-label={es ? 'Accesos del portal' : 'Portal accesses'}>
        {portal.map((card, i) => {
          const [x1, y1] = pt(i)
          const [x2, y2] = pt(i + 1)
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          const ix = C + (mx - C) * 0.80
          const iy = C + (my - C) * 0.80
          const blocked = isBlocked(card.href)
          const selected = i === sel
          // Sides carry no icons and only the two eye colours: holo cyan at
          // rest, fight red when the side is marked.
          const stroke = blocked ? '#4b5563' : selected ? '#ff2020' : '#22d3ee'
          return (
            <g
              key={card.href}
              className="mm3-nonagon-side"
              style={{ cursor: blocked ? 'not-allowed' : 'pointer' }}
              onMouseEnter={() => markSide(i)}
              onClick={() => { markSide(i); if (!blocked) router.push(card.href) }}
            >
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={stroke}
                strokeWidth={selected ? 13 : 8}
                strokeLinecap="round"
                opacity={selected ? 1 : 0.62}
                style={selected && !blocked ? { filter: 'drop-shadow(0 0 6px #ff2020)' } : undefined}
              />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={34} strokeLinecap="round" />
              {card.daily && count > 0 && !blocked && (
                <circle cx={ix} cy={iy} r={5} fill="#ef4444" stroke="#010709" strokeWidth={1.4} />
              )}
            </g>
          )
        })}
      </svg>
        {/* Clickable core: the MM3 logo — click warps into the full-width map. */}
        <button
          type="button"
          className="mm3-nonagon-core"
          onClick={() => setMapOpen(true)}
          title={es ? 'Mostrar mapa del mundo' : 'Show world map'}
        >
          <span className="mm3-nonagon-core-flip">
            <Image src="/og-image.jpg" alt="MM3" width={160} height={160} className="mm3-nonagon-logo" />
          </span>
        </button>
      </div>
      {/* Selected side: the card's info extends here — only while the core
          shows the logo (map mode keeps the ring clean; sides still navigate).
          Single cyan accent for every card, keyed so the glitch-in replays. */}
      {!mapOpen && (
      <div className="mm3-nonagon-caption" key={current.href} style={{ '--ac': currentBlocked ? '#6b7280' : '#22d3ee' }}>
        <span className="mm3-nonagon-center-head">
          <span className="mm3-nonagon-center-icon" aria-hidden="true">{currentBlocked ? '💀' : current.icon}</span>
          {currentBlocked ? (
            <span className="mm3-nonagon-center-name">{current.name}</span>
          ) : (
            <Link href={current.href} className="mm3-nonagon-center-name">{current.name}</Link>
          )}
        </span>
        <span className="mm3-nonagon-center-desc">
          {currentBlocked
            ? (es ? `MUERTO · revives en ${deadCountdown}` : `DEAD · revives in ${deadCountdown}`)
            : current.desc}
        </span>
      </div>
      )}
    </div>
  )
}

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
      <section className="mm3-splash mm3-splash-with-nonagon">

        {/* animated hex grid bg */}
        <div className="mm3-splash-grid" aria-hidden="true" />

        {/* big background glow orb */}
        <div className="mm3-splash-orb" aria-hidden="true" />

        {/* scan line overlay */}
        <div className="mm3-splash-scanlines" aria-hidden="true" />

        <div className="mm3-splash-body">

          {/* Display case: the stage only drags the carousel; navigation into
              /mining lives on the access-text link alone. */}
          <div className="mm3-home-access" onMouseEnter={prefetchMiningRoute} onTouchStart={prefetchMiningRoute}>
            <span className="mm3-home-access-stage">
              <HomeMiningScene />
            </span>
            <Link
              href="/mining"
              className="mm3-home-access-text"
              aria-label={es ? 'Entrar al mundo 3D de Mining' : 'Enter the 3D Mining world'}
              onFocus={prefetchMiningRoute}
            >
              {es ? 'ENTRAR AL MUNDO 3D' : 'ENTER THE 3D MINE'}
            </Link>
            {/* Nonagon of portal accesses with the extended world minimap inside. */}
            <div className="mm3-home-underrow">
              <NonagonPortal
                portal={portal}
                es={es}
                isDead={isDead}
                deadCountdown={deadCountdown}
                count={count}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
