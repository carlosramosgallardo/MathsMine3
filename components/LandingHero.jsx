'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { loadDailyTaskProgress } from '@/lib/daily-tasks';
import supabase from '@/lib/supabaseClient';
import HomeMiningScene from '@/components/HomeMiningScene';
import { prefetchMiningRoute } from '@/lib/prefetch-mining';
import { getEmojiTitle, computeRelayLevel, lifeNftjiEmojiFilterStyle } from '@/lib/wallet-decorations';

// Interactive portal cards disabled during the 5-minute death cooldown
const INTERACTIVE_HREFS = new Set(['/training', '/trading', '/squeezing', '/relaying', '/daily-tasks', '/mining'])

// NFTJIs obtainable per portal section — rendered on that section's caption
// card (see README «NFTJIs»: 🔮🍀🎰🧿 are rare rolls after correct Training
// answers; ❤️ Life Toll is bought in Training; 🔰⚔️ drop from Squeezes; 🔁
// comes from /exec in Relaying). Owned ones (connected wallet) glow and show
// their current level; unowned ones render greyed out. Mining's own NFTJIs
// (the 20 block NFTJIs + 🛰 Genesis) render next to the 3D-mine access line.
const SECTION_NFTJIS = {
  '/training': ['❤️', '🔮', '🍀', '🎰', '🧿'],
  '/trading': ['👾'],
  '/squeezing': ['🔰', '⚔️'],
  '/relaying': ['🔁'],
}

const EMPTY_NFTJI_STATE = Object.freeze({ owned: [], levels: {}, miningKey: null, miningLevels: {}, squeezeEquipped: null })

// Mining-skill passives per NFTJI (see miningSkillAbilityLines) — appended to
// the emoji tooltip so the skill is explained wherever the NFTJI shows up.
function nftjiTooltip(emoji, es, { base = null, isMiningBlock = false } = {}) {
  const name = base || getEmojiTitle(emoji)
  let skill = null
  if (emoji === '❤️') skill = es ? 'Skill en mining: +10% velocidad' : 'Mining skill: +10% speed'
  else if (emoji === '⚔️') skill = es ? 'Skill en mining: +5% crítico' : 'Mining skill: +5% crit'
  else if (emoji === '🔰') skill = es ? 'Skill en mining: 10% esquiva' : 'Mining skill: 10% dodge'
  else if (emoji === '👾') skill = es ? 'Skill en mining: HACKING — 10% por golpe deja al objetivo OFFLINE 5s' : 'Mining skill: HACKING — 10% per hit knocks the target OFFLINE 5s'
  else if (isMiningBlock) skill = es ? 'Skill en mining: +10% salto' : 'Mining skill: +10% jump'
  return skill ? `${name} · ${skill}` : name
}

const PORTAL = {
  en: [
    { href: '/mining',      icon: '⬡',  name: 'Mining',      desc: 'The 3D world. 1000 mineable blocks.',                       accent: '#fb923c' },
    // Shorter desc than the rest: its five NFTJI tiles share the line.
    { href: '/training',    icon: '⛏',  name: 'Training',    desc: 'Solve math under pressure.',                                accent: '#f59e0b' },
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
    { href: '/mining',      icon: '⬡',  name: 'Mining',      desc: 'El mundo 3D. 1000 bloques minables.',                      accent: '#fb923c' },
    // Desc corta: sus cinco tiles NFTJI comparten la línea.
    { href: '/training',    icon: '⛏',  name: 'Training',    desc: 'Matemáticas bajo presión.',                                accent: '#f59e0b' },
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

/** One NFTJI tile — logo-badge format: framed square with the emoji inside
    and, when leveled/equipped, a corner badge with the current level (like the
    header logo tile, with the level where the home marker sits). Three states:
    greyed (not leveled), colored + badge without glow (leveled but not worn —
    only exists where a single NFTJI can be equipped at a time: mining blocks
    and Squeezing ⚔️/🔰) and the gold glow (equipped right now). `equipped`
    defaults to `owned` so always-active NFTJIs keep the glow as before. */
function NftjiTile({ emoji, owned, level, title, equipped = owned }) {
  const lit = owned || equipped
  return (
    <span className={`mm3-nftji-tile${equipped ? ' is-owned' : lit ? ' is-leveled' : ''}`} title={title}>
      <span style={lit ? lifeNftjiEmojiFilterStyle(emoji) : undefined}>{emoji}</span>
      {lit && <span className="mm3-nftji-lvbadge">{Math.max(0, Number(level) || 0)}</span>}
    </span>
  )
}

/** Section NFTJI tile fed from the wallet ownership/levels state. */
function NftjiChip({ emoji, nftji, es }) {
  const owned = nftji.owned.includes(emoji)
  // Squeezing is one-at-a-time: only the equipped side keeps the glow.
  const equipped = emoji === '⚔️' ? owned && nftji.squeezeEquipped === 'attack'
    : emoji === '🔰' ? owned && nftji.squeezeEquipped === 'defense'
    : owned
  return (
    <NftjiTile
      emoji={emoji}
      owned={owned}
      equipped={equipped}
      level={nftji.levels[emoji] ?? 0}
      title={nftjiTooltip(emoji, es)}
    />
  )
}

/**
 * Portal accesses as a plain stacked list, one row per section — replaces
 * the nonagon polygon + MM3 logo (no more select-then-navigate two-step:
 * each row's title is a direct link, like every other nav on the site).
 * Every row shows its own icon/desc/NFTJI chips at once, so there's no
 * selection state or auto-rotation to drive a "which one is showing" cycle
 * — the earlier per-selection card became a permanent per-row block instead.
 */
function PortalCardList({ portal, es, isDead, deadCountdown, count, nftji, miningBlocks }) {
  const isBlocked = (href) => isDead && INTERACTIVE_HREFS.has(href)
  return (
    <div className="mm3-portal-list" aria-label={es ? 'Accesos del portal' : 'Portal accesses'}>
      {portal.map((card) => {
        const blocked = isBlocked(card.href)
        return (
          <div
            key={card.href}
            className={`mm3-portal-row${card.href === '/mining' ? ' is-tall' : ''}`}
            data-testid={`mm3-portal-row-${card.href.replace(/^\//, '')}`}
            data-portal-href={card.href}
            style={{ '--ac': blocked ? '#6b7280' : card.accent }}
          >
            <span className="mm3-portal-row-head">
              <span className="mm3-portal-row-icon" aria-hidden="true">{blocked ? '💀' : card.icon}</span>
              {blocked ? (
                <span className="mm3-portal-row-name">{card.name}</span>
              ) : (
                <Link href={card.href} className="mm3-portal-row-name">{card.name}</Link>
              )}
              {card.daily && count > 0 && !blocked && (
                <span className="mm3-portal-row-dot" aria-hidden="true" />
              )}
            </span>
            <span className="mm3-portal-row-desc">
              {blocked
                ? (es ? `MUERTO · revives en ${deadCountdown}` : `DEAD · revives in ${deadCountdown}`)
                : card.desc}
            </span>
            {!blocked && SECTION_NFTJIS[card.href] && (
              <span className="mm3-portal-row-nftjis" aria-label="NFTJIs">
                {SECTION_NFTJIS[card.href].map((emoji) => (
                  <NftjiChip key={emoji} emoji={emoji} nftji={nftji} es={es} />
                ))}
              </span>
            )}
            {/* Mining row: its 20 block NFTJIs as a second strip; every block the
                wallet has leveled shows its level, and the one currently equipped
                keeps the gold glow. */}
            {!blocked && card.href === '/mining' && miningBlocks.length > 0 && (
              <span className="mm3-portal-row-nftjis mm3-portal-row-nftjis-blocks" aria-label="NFTJIs">
                {miningBlocks.map((block) => (
                  <NftjiTile
                    key={block.block_key}
                    emoji={block.emoji || '⬡'}
                    owned={Math.max(0, Number(nftji.miningLevels[block.block_key] ?? 0)) > 0}
                    equipped={nftji.miningKey === block.block_key}
                    level={Math.max(0, Number(nftji.miningLevels[block.block_key] ?? 0))}
                    title={nftjiTooltip(block.emoji, es, {
                      base: (es ? block.title_es : block.title_en) || block.block_key,
                      isMiningBlock: true,
                    })}
                  />
                ))}
              </span>
            )}
          </div>
        )
      })}
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

  // NFTJI ownership + levels for the connected wallet — lights up the caption
  // chips and the mining minicube. Same sources as the mining HUD:
  // player_progress (trade/relay/mining) and mm3_squeezing_nftji (🔰/⚔️).
  const [nftji, setNftji] = useState(EMPTY_NFTJI_STATE)
  useEffect(() => {
    const wallet = String(account || '').toLowerCase()
    if (!wallet) { setNftji(EMPTY_NFTJI_STATE); return undefined }
    let alive = true
    const load = async () => {
      try {
        const [{ data: pp }, { data: sq }] = await Promise.all([
          supabase.from('player_progress')
            .select('wallet_emojis,lucky_50_level,lucky_100_level,lucky_500_level,lucky_1000_level,zero_day_level,relay_exec_count,mining_nftji_key,mining_nftji_levels')
            .eq('wallet', wallet).maybeSingle(),
          supabase.from('mm3_squeezing_nftji')
            .select('equipped,attack_level,defense_level')
            .eq('wallet', wallet).maybeSingle(),
        ])
        if (!alive) return
        const owned = Array.isArray(pp?.wallet_emojis) ? [...pp.wallet_emojis] : []
        const levels = {
          '🔮': Number(pp?.lucky_50_level ?? 0),
          '🍀': Number(pp?.lucky_100_level ?? 0),
          '🎰': Number(pp?.lucky_500_level ?? 0),
          '🧿': Number(pp?.lucky_1000_level ?? 0),
          '👾': Number(pp?.zero_day_level ?? 0),
          '🔁': computeRelayLevel(pp?.relay_exec_count, 0),
        }
        if (Number(sq?.attack_level) > 0) { owned.push('⚔️'); levels['⚔️'] = Number(sq.attack_level) }
        if (Number(sq?.defense_level) > 0) { owned.push('🔰'); levels['🔰'] = Number(sq.defense_level) }
        setNftji({
          owned,
          levels,
          miningKey: pp?.mining_nftji_key || null,
          miningLevels: pp?.mining_nftji_levels || {},
          squeezeEquipped: sq?.equipped || null,
        })
      } catch { /* keep previous state */ }
    }
    load()
    window.addEventListener('mm3-db-updated', load)
    return () => { alive = false; window.removeEventListener('mm3-db-updated', load) }
  }, [account])

  // The 20 mineable NFTJI blocks (key + emoji + title) — one light read at
  // mount, wallet-independent; the owned one lights up via nftji.miningKey.
  const [miningBlocks, setMiningBlocks] = useState([])
  useEffect(() => {
    let alive = true
    supabase.from('mm3_mining_blocks')
      .select('block_key,emoji,title_en,title_es')
      .order('block_key')
      .then(({ data }) => { if (alive && Array.isArray(data)) setMiningBlocks(data) })
    return () => { alive = false }
  }, [])

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

  // Fullscreen showcase: a clean tap on the stage (dispatched by the 3D
  // scene) expands the avatar carousel to the whole screen and hides the
  // rest of the home; a second tap restores the normal view.
  const [stageZoom, setStageZoom] = useState(false)
  useEffect(() => {
    const toggle = () => setStageZoom((z) => !z)
    window.addEventListener('mm3-stage-zoom-toggle', toggle)
    return () => window.removeEventListener('mm3-stage-zoom-toggle', toggle)
  }, [])

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
          <div className={`mm3-home-access${stageZoom ? ' is-stagezoom' : ''}`} onMouseEnter={prefetchMiningRoute} onTouchStart={prefetchMiningRoute}>
            <span className="mm3-home-access-stage">
              <HomeMiningScene />
            </span>
            {/* Stacked portal access rows — mining included like every other
                section (with its 20 block NFTJIs on its own row). */}
            <div className="mm3-home-underrow">
              <PortalCardList
                portal={portal}
                es={es}
                isDead={isDead}
                deadCountdown={deadCountdown}
                count={count}
                nftji={nftji}
                miningBlocks={miningBlocks}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
