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
  const allBots = BOT_POOLS.flatMap((pool) => pool.bots);

  return (
    <main className="ai-team-world">
      <section className="ai-team-hero">
        <div className="ai-team-grid" aria-hidden="true" />
        <div className="ai-team-hero-inner">
          <div className="ai-team-hero-copy">
            <div className="ai-team-kicker"><span /> AUTONOMOUS WALLET NETWORK</div>
            <h1>AI TEAM</h1>
            <p>{t('aiTeam.subtitle')}</p>
            <div className="ai-team-live-strip">
              <b>04</b> {es ? 'WALLETS ACTIVAS' : 'ACTIVE WALLETS'}
              <i>24 / 7</i>
            </div>
          </div>
          <div className="ai-team-forge" aria-hidden="true">
            <div className="ai-team-forge-floor" />
            {allBots.map((bot, index) => (
              <span
                className="ai-team-forge-bot"
                key={bot.wallet}
                style={{
                  '--bot-color': colorFromAddress(bot.wallet),
                  '--bot-left': `${11 + index * 22}%`,
                  '--bot-rise': `${index % 2 ? -13 : 0}px`,
                }}
              >
                <span className="ai-team-forge-head"><i /></span>
                <span className="ai-team-forge-body" />
                <span className="ai-team-forge-shadow" />
              </span>
            ))}
            <span className="ai-team-forge-core">AI</span>
          </div>
        </div>
      </section>

      <section className="ai-team-content">
        <div className="ai-team-content-inner">
          <div className="ai-team-pool-grid">
            {BOT_POOLS.map((pool, pi) => {
              const poolColor = colorFromPool(pool.pool_code);
              return (
                <article
                  key={pool.pool_code}
                  className="ai-team-pool-block"
                  style={{ '--pool-color': poolColor, '--pool-delay': `${pi * 0.1}s` }}
                >
                  <header className="ai-team-pool-head">
                    <span className="ai-team-pool-cube" aria-hidden="true"><i>◈</i></span>
                    <Link
                      href="/ranking?view=pools"
                      className="ai-team-pool-link"
                    >
                      POOL {pool.pool_code}
                    </Link>
                    <span className="ai-team-pool-count">02 NODES</span>
                  </header>
                  <div className="ai-team-bot-grid">
                    {pool.bots.map((bot) => {
                      const color = colorFromAddress(bot.wallet);
                      return (
                        <div className="ai-team-bot-block"
                          key={bot.wallet}
                          style={{ '--bot-color': color }}
                        >
                          <div className="ai-team-bot-face">
                            <span className="ai-team-bot-avatar" aria-hidden="true"><i /></span>
                            <div>
                              <strong>{bot.key}</strong>
                            <Link
                              href={`/ranking?wallet=${bot.wallet}`}
                                className="ai-team-bot-link"
                              title={bot.wallet}
                            >
                              {shortWallet(bot.wallet)}
                            </Link>
                            </div>
                          </div>
                          <div className="ai-team-tag-grid">
                            {bot.tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="ai-team-feature-block">
            <div className="ai-team-feature-core" aria-hidden="true">F</div>
            <div className="ai-team-feature-copy">
              <h2>{t('aiTeam.freakingAI')}</h2>
              <p>{t('aiTeam.freakingAIDesc')}</p>
            </div>
            <a
              href="https://www.youtube.com/@FreakingAI"
              target="_blank"
              rel="noopener noreferrer"
              className="ai-team-feature-cta"
            >
              {t('aiTeam.subscribe')}
            </a>
          </div>

          <div className="ai-team-tools-block">
            <p className="ai-team-tools-label">{t('aiTeam.builtWith')}</p>
            <div className="ai-team-tool-grid">
              {[
                { href: 'https://www.anthropic.com', mark: 'AN', name: 'Claude', company: 'Anthropic' },
                { href: 'https://openai.com', mark: 'OP', name: 'Codex', company: 'OpenAI' },
                { href: 'https://github.com/features/copilot', mark: 'GH', name: 'Copilot', company: 'GitHub' },
              ].map(({ href, mark, name, company }) => (
                <a key={name} href={href} target="_blank" rel="noopener noreferrer"
                  className="ai-team-tool-block">
                  <div className="ai-team-tool-icon" aria-hidden="true">{mark}</div>
                  <div>
                    <strong>{name}</strong>
                    <span>{company}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
