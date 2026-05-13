'use client';

import Head from 'next/head';
import Link from 'next/link';
import SectionFrame from '@/components/SectionFrame';
import { useI18n } from '@/lib/i18n-context';
import { useMm3Accent } from '@/lib/use-mm3-accent';
import { colorFromAddress } from '@/lib/wallet-colors';

// Bot pool assignments — fill pool_code once known (e.g. 'ALFA')
const BOT_PROFILES = [
  {
    key: 'bear',
    emoji: '🐻',
    wallet: '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
    strategy: 'sell_mm3',
    squeeze: '90%',
    pool_code: null,
    tags: ['sell_mm3', 'squeeze 90%', 'liquidator'],
  },
  {
    key: 'bull',
    emoji: '🐂',
    wallet: '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202',
    strategy: 'buy_mm3',
    squeeze: '15%',
    pool_code: null,
    tags: ['buy_mm3', 'squeeze 15%', 'accumulator'],
  },
  {
    key: 'collector',
    emoji: '🏛',
    wallet: '0xd6c6c15060b27406d956c7e99e520cc810b44233',
    strategy: 'market_buy',
    squeeze: '55%',
    pool_code: null,
    tags: ['market_buy', 'squeeze 55%', 'collector'],
  },
  {
    key: 'flipper',
    emoji: '⚡',
    wallet: '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab',
    strategy: 'market_sell',
    squeeze: '80%',
    pool_code: null,
    tags: ['market_sell', 'squeeze 80%', 'flipper'],
  },
];

function shortWallet(w) {
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

export default function AITeamPage() {
  const { t, language } = useI18n();
  const { frameAccent } = useMm3Accent();
  const pageTitle = 'MathsMine3 – AI Team';
  const pageDescription =
    'Four autonomous AI agents competing live inside MathsMine3: mining, trading, and launching Squeezes every tick.';
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
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .bot-card {
          animation: float-in 0.5s ease-out both;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .bot-card:hover { transform: translateY(-3px); }
        #ai-team-section .mm3-ai-panel {
          background: linear-gradient(180deg, rgba(5,8,16,0.96) 0%, rgba(2,6,23,0.9) 100%);
          border: 1px solid rgba(34,211,238,0.18);
        }
        .bot-tag {
          font-family: monospace;
          font-size: 0.70rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 2px 8px;
        }
        .bot-link {
          font-family: monospace;
          font-size: 0.75rem;
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .bot-link:hover { opacity: 0.7; }
      `}</style>

      <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="ai-team-section">
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

        {/* Bot cards 2×2 */}
        <section className="grid gap-3 grid-cols-1 md:grid-cols-2 mb-4">
          {BOT_PROFILES.map((bot, index) => {
            const color = colorFromAddress(bot.wallet);
            const name = t(`aiTeam.${bot.key}`);
            const role = t(`aiTeam.${bot.key}Role`);
            const desc = t(`aiTeam.${bot.key}Desc`);
            const spec = t(`aiTeam.${bot.key}Speciality`);

            return (
              <article
                key={bot.wallet}
                className="bot-card mm3-ai-panel p-4"
                style={{
                  animationDelay: `${index * 0.08}s`,
                  borderColor: `${color}35`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 22px ${color}25`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                {/* Name */}
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: '1.3rem', filter: `drop-shadow(0 0 6px ${color}50)` }}>
                    {bot.emoji}
                  </span>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color }}>{name}</h2>
                    <p className="text-[0.68rem] font-mono uppercase tracking-wider" style={{ color: `${color}90` }}>{role}</p>
                  </div>
                </div>

                {/* Wallet + Pool */}
                <div className="flex items-center gap-3 mb-3 pb-2" style={{ borderBottom: `1px solid ${color}18` }}>
                  <Link href={`/ranking?wallet=${bot.wallet}`} className="bot-link" style={{ color }} title={bot.wallet}>
                    ⬡ {shortWallet(bot.wallet)}
                  </Link>
                  {bot.pool_code
                    ? <Link href="/ranking?view=pools" className="bot-link" style={{ color: `${color}bb` }}>◈ {bot.pool_code}</Link>
                    : <span className="bot-link" style={{ color: `${color}35` }}>◈ —</span>
                  }
                </div>

                {/* Desc */}
                <p className="text-xs text-gray-400 leading-relaxed mb-3">{desc}</p>

                {/* Speciality */}
                <p className="text-xs font-mono mb-3" style={{ color: `${color}cc` }}>{spec}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {bot.tags.map((tag) => (
                    <span key={tag} className="bot-tag" style={{ background: `${color}15`, color }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </section>

        {/* FreakingAI CTA */}
        <section className="mm3-ai-panel p-4 text-center mb-3">
          <h2 className="text-base font-bold text-[#22d3ee] uppercase tracking-widest mb-2">
            {t('aiTeam.freakingAI')}
          </h2>
          <p className="text-xs text-gray-400 mb-4">{t('aiTeam.freakingAIDesc')}</p>
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
          <p className="text-center text-[0.72rem] uppercase tracking-[0.28em] text-cyan-400/40 mb-3 font-mono">
            {t('aiTeam.builtWith')}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a href="https://www.anthropic.com" target="_blank" rel="noopener noreferrer"
              className="group flex items-center gap-3 p-3 transition-all" style={{ background: 'rgba(201,115,85,0.04)' }}>
              <div className="shrink-0 flex h-8 w-8 items-center justify-center" style={{ background: 'rgba(201,115,85,0.12)' }}>
                <img src="https://www.anthropic.com/favicon.ico" alt="Anthropic" width={18} height={18} loading="lazy" className="rounded-sm" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-white group-hover:text-[#c97355] transition-colors">Claude</div>
                <div className="text-[0.65rem] font-mono uppercase tracking-widest text-gray-500">Anthropic · claude-sonnet-4-6</div>
              </div>
            </a>
            <a href="https://openai.com/codex" target="_blank" rel="noopener noreferrer"
              className="group flex items-center gap-3 p-3 transition-all" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="shrink-0 flex h-8 w-8 items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <img src="https://openai.com/favicon.ico" alt="OpenAI" width={18} height={18} loading="lazy" className="rounded-sm" style={{ filter: 'invert(1) brightness(0.85)' }} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-white group-hover:text-gray-300 transition-colors">Codex</div>
                <div className="text-[0.65rem] font-mono uppercase tracking-widest text-gray-500">OpenAI · Codex CLI</div>
              </div>
            </a>
          </div>
        </section>

      </div>
      </SectionFrame>
      </main>
    </>
  );
}
