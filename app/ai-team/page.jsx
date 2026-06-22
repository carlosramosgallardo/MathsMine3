'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';
import { colorFromAddress, colorFromPool } from '@/lib/wallet-colors';

const BOT_POOLS = [
  {
    pool_code: 'FHNN6',
    bots: [
      {
        key: 'bear',
        wallet: '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
        tags: ['sell_mm3', 'squeeze 90%', 'attack', 'chain_mine'],
      },
      {
        key: 'bull',
        wallet: '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202',
        tags: ['buy_mm3', 'squeeze 15%', 'defense', 'chain_mine'],
      },
    ],
  },
  {
    pool_code: '8FR49',
    bots: [
      {
        key: 'collector',
        wallet: '0xd6c6c15060b27406d956c7e99e520cc810b44233',
        tags: ['mining_buy', 'squeeze 55%', 'balanced', 'chain_mine'],
      },
      {
        key: 'flipper',
        wallet: '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab',
        tags: ['market_sell', 'squeeze 80%', 'balanced', 'chain_mine'],
      },
    ],
  },
];

function shortWallet(w) {
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

export default function AITeamPage() {
  const { t, language } = useI18n();
  const es = language === 'es';

  return (
    <>
      <style>{`
        @keyframes ai-float-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ai-pool-section { animation: ai-float-in 0.5s ease-out both; }
        .ai-bot-card {
          transition: border-color 0.15s, background-color 0.15s;
          border-radius: 6px;
          padding: 1rem;
        }
        .ai-bot-link {
          font-family: monospace;
          font-size: 0.72rem;
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .ai-bot-link:hover { opacity: 0.65; }
        .ai-bot-tag {
          font-family: monospace;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 2px 7px;
          border-radius: 3px;
        }
        .ai-panel {
          background: rgba(2,6,11,0.85);
          border: 1px solid rgba(34,211,238,0.14);
          border-radius: 8px;
          padding: 1.25rem;
        }
      `}</style>

      {/* ── Hero (same structure as Home) ─────────────────────────────── */}
      <section className="mm3-splash">
        <div className="mm3-splash-grid" aria-hidden="true" />
        <div className="mm3-splash-orb" aria-hidden="true" />
        <div className="mm3-splash-scanlines" aria-hidden="true" />
        <div className="mm3-splash-body">
          <div className="mm3-splash-kicker">
            <span className="mm3-splash-live" />
            {es ? 'EQUIPO IA · @FREAKINGAI' : 'AI TEAM · @FREAKINGAI'}
          </div>
          <p className="mm3-splash-sub">{t('aiTeam.subtitle')}</p>
        </div>
      </section>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <section className="mm3-portal">
        <div className="mx-auto max-w-5xl">

          {/* Pools */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {BOT_POOLS.map((pool, pi) => {
              const poolColor = colorFromPool(pool.pool_code);
              return (
                <div
                  key={pool.pool_code}
                  className="ai-panel ai-pool-section"
                  style={{ animationDelay: `${pi * 0.1}s`, borderColor: `${poolColor}35` }}
                >
                  <div className="flex items-center gap-3 mb-4 pb-2" style={{ borderBottom: `1px solid ${poolColor}25` }}>
                    <Link
                      href="/ranking?view=pools"
                      className="ai-bot-link font-bold text-sm uppercase tracking-widest"
                      style={{ color: poolColor }}
                    >
                      ◈ {pool.pool_code}
                    </Link>
                    <span className="text-xs text-gray-500 font-mono">2 bots</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pool.bots.map((bot) => {
                      const color = colorFromAddress(bot.wallet);
                      return (
                        <div
                          key={bot.wallet}
                          className="ai-bot-card"
                          style={{ background: `${color}08`, border: `1px solid ${color}25` }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${color}60`; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${color}25`; }}
                        >
                          <div className="mb-3">
                            <Link
                              href={`/ranking?wallet=${bot.wallet}`}
                              className="ai-bot-link font-bold"
                              style={{ color }}
                              title={bot.wallet}
                            >
                              {shortWallet(bot.wallet)}
                            </Link>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {bot.tags.map((tag) => (
                              <span key={tag} className="ai-bot-tag" style={{ background: `${color}12`, color }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* FreakingAI CTA */}
          <div className="ai-panel text-center mb-4">
            <h2 className="text-sm font-bold text-[#22d3ee] uppercase tracking-widest mb-2">
              {t('aiTeam.freakingAI')}
            </h2>
            <p className="text-xs text-gray-400 mb-3">{t('aiTeam.freakingAIDesc')}</p>
            <a
              href="https://www.youtube.com/@FreakingAI"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-5 py-2 text-sm font-bold transition-colors"
              style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.08)', borderRadius: 4 }}
            >
              {t('aiTeam.subscribe')}
            </a>
          </div>

          {/* Built with */}
          <div className="ai-panel">
            <p className="text-center text-[0.68rem] uppercase tracking-[0.28em] text-cyan-400/40 mb-3 font-mono">
              {t('aiTeam.builtWith')}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { href: 'https://www.anthropic.com', logo: 'https://www.anthropic.com/favicon.ico', name: 'Claude', company: 'Anthropic', alt: 'Anthropic', filter: '' },
                { href: 'https://openai.com', logo: 'https://openai.com/favicon.ico', name: 'Codex', company: 'OpenAI', alt: 'OpenAI', filter: 'invert(1) brightness(0.85)' },
                { href: 'https://github.com/features/copilot', logo: 'https://github.com/favicon.ico', name: 'Copilot', company: 'GitHub', alt: 'GitHub', filter: 'invert(1) brightness(0.85)' },
              ].map(({ href, logo, name, company, alt, filter }) => (
                <a key={name} href={href} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-3 p-3 transition-opacity hover:opacity-75">
                  <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <img src={logo} alt={alt} width={18} height={18} loading="lazy" className="rounded-sm" style={{ filter }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-white">{name}</div>
                    <div className="text-[0.62rem] font-mono uppercase tracking-widest text-gray-500">{company}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

        </div>
      </section>
    </>
  );
}
