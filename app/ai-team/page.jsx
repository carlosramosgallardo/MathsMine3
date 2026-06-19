'use client';

import Head from 'next/head';
import Link from 'next/link';
import SectionFrame from '@/components/SectionFrame';
import { useI18n } from '@/lib/i18n-context';
import { useMm3Accent } from '@/lib/use-mm3-accent';
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
  const { t } = useI18n();
  const { frameAccent } = useMm3Accent();
  const pageTitle = 'MathsMine3 – AI Team';
  const pageDescription =
    'Four autonomous AI agents competing live inside MathsMine3: mining, trading, launching Squeezes, and resolving MM3 Block Chain blocks every tick.';
  const canonicalUrl = 'https://mathsmine3.xyz/ai-team';
  const ogImage = 'https://mathsmine3.xyz/og-image.jpg';

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={ogImage} />
      </Head>

      <style>{`
        @keyframes float-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pool-section { animation: float-in 0.5s ease-out both; }
        .bot-card { transition: border-color 0.15s, background-color 0.15s; }
        .bot-card:hover { border-color: rgba(34,211,238,0.38); }
        #ai-team-section .mm3-ai-panel {
          background: rgba(2,6,11,0.96);
          border: 1px solid rgba(34,211,238,0.18);
        }
        .bot-tag {
          font-family: monospace;
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 2px 7px;
        }
        .bot-link {
          font-family: monospace;
          font-size: 0.72rem;
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .bot-link:hover { opacity: 0.65; }
      `}</style>

      <main className="w-full px-2 py-1 flex-1 flex flex-col" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="ai-team-section" stretch>
      <div className="mm3-readable-scroll max-w-3xl mx-auto px-1 py-1">

        {/* Header */}
        <header className="text-center mb-5">
          <h1 className="text-2xl font-bold mb-1 text-[#22d3ee] uppercase tracking-widest">
            {t('aiTeam.title')}
          </h1>
          <p className="text-xs text-gray-400 font-mono uppercase tracking-[0.2em]">
            {t('aiTeam.subtitle')}
          </p>
        </header>

        {/* Pools */}
        <div className="flex flex-col gap-4 mb-4">
          {BOT_POOLS.map((pool, pi) => {
            const poolColor = colorFromPool(pool.pool_code);
            return (
              <section
                key={pool.pool_code}
                className="pool-section mm3-ai-panel p-4"
                style={{ animationDelay: `${pi * 0.1}s`, borderColor: `${poolColor}35` }}
              >
                {/* Pool header */}
                <div className="flex items-center gap-3 mb-4 pb-2" style={{ borderBottom: `1px solid ${poolColor}25` }}>
                  <Link
                    href="/ranking?view=pools"
                    className="bot-link font-bold text-sm uppercase tracking-widest"
                    style={{ color: poolColor }}
                  >
                    ◈ {pool.pool_code}
                  </Link>
                  <span className="text-xs text-gray-500 font-mono">2 bots</span>
                </div>

                {/* Bots in this pool — side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pool.bots.map((bot) => {
                    const color = colorFromAddress(bot.wallet);

                    return (
                      <div
                        key={bot.wallet}
                        className="bot-card p-3"
                        style={{
                          background: `${color}08`,
                          border: `1px solid ${color}25`,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${color}60`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${color}25`; }}
                      >
                        {/* Wallet identity */}
                        <div className="mb-3">
                          <Link
                            href={`/ranking?wallet=${bot.wallet}`}
                            className="bot-link font-bold"
                            style={{ color }}
                            title={bot.wallet}
                          >
                            {shortWallet(bot.wallet)}
                          </Link>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1">
                          {bot.tags.map((tag) => (
                            <span key={tag} className="bot-tag" style={{ background: `${color}12`, color }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* FreakingAI CTA */}
        <section className="mm3-ai-panel p-4 text-center mb-3">
          <h2 className="text-sm font-bold text-[#22d3ee] uppercase tracking-widest mb-2">
            {t('aiTeam.freakingAI')}
          </h2>
          <p className="text-xs text-gray-400 mb-3">{t('aiTeam.freakingAIDesc')}</p>
          <a
            href="https://www.youtube.com/@FreakingAI"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-5 py-2 text-sm font-bold transition-colors"
            style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.08)' }}
          >
            {t('aiTeam.subscribe')}
          </a>
        </section>

        {/* Built with */}
        <section className="mm3-ai-panel p-3">
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
        </section>

      </div>
      </SectionFrame>
      </main>
    </>
  );
}
