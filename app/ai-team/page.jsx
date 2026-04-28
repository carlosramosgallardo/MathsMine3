'use client';

import Head from 'next/head';
import Link from 'next/link';
import SectionFrame from '@/components/SectionFrame';
import { useI18n } from '@/lib/i18n-context';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function AITeamPage() {
  const { t, language } = useI18n();
  const { frameAccent } = useMm3Accent();
  const pageTitle = 'MathsMine3 – AI Team';
  const pageDescription =
    'Meet the brilliant minds behind MathsMine3: AI-powered engineers, gamification experts, and crypto innovators working to revolutionize math learning through blockchain gaming.';
  const canonicalUrl = 'https://mathsmine3.xyz/ai-team';
  const ogImage = 'https://mathsmine3.xyz/og-image.jpg';

  const teamMembers = [
    {
      id: 1,
      name: t('aiTeam.cipher'),
      role: t('aiTeam.cipherRole'),
      emoji: '🧠',
      description: t('aiTeam.cipherDesc'),
      speciality: t('aiTeam.cipherSpeciality'),
      skills: ['Solidity', 'Game Mechanics', 'Optimization'],
    },
    {
      id: 2,
      name: t('aiTeam.nova'),
      role: t('aiTeam.novaRole'),
      emoji: '🎮',
      description: t('aiTeam.novaDesc'),
      speciality: t('aiTeam.novaSpeciality'),
      skills: ['Gamification', 'Psychology', 'UI/UX'],
    },
    {
      id: 3,
      name: t('aiTeam.nexus'),
      role: t('aiTeam.nexusRole'),
      emoji: '⛓️',
      description: t('aiTeam.nexusDesc'),
      speciality: t('aiTeam.nexusSpeciality'),
      skills: ['Wagmi', 'Ethers.js', 'Web3Modal'],
    },
    {
      id: 4,
      name: t('aiTeam.lyra'),
      role: t('aiTeam.lyraRole'),
      emoji: '📊',
      description: t('aiTeam.lyraDesc'),
      speciality: t('aiTeam.lyraSpeciality'),
      skills: ['Supabase', 'PostgreSQL', 'Recharts'],
    },
    {
      id: 5,
      name: t('aiTeam.pixel'),
      role: t('aiTeam.pixelRole'),
      emoji: '✨',
      description: t('aiTeam.pixelDesc'),
      speciality: t('aiTeam.pixelSpeciality'),
      skills: ['Tailwind CSS', 'Animation', 'Design'],
    },
    {
      id: 6,
      name: t('aiTeam.echo'),
      role: t('aiTeam.echoRole'),
      emoji: '🚀',
      description: t('aiTeam.echoDesc'),
      speciality: t('aiTeam.echoSpeciality'),
      skills: ['Marketing', 'Social Strategy', 'Analytics'],
    },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MathsMine3 AI Team',
    description: pageDescription,
    url: canonicalUrl,
    logo: ogImage,
    sameAs: ['https://www.youtube.com/@FreakingAI', 'https://x.com/freakingai'],
    team: teamMembers.map((member) => ({
      '@type': 'Person',
      name: member.name,
      jobTitle: member.role,
      description: member.description,
    })),
  };

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

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <style>{`
        @keyframes float-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .member-card {
          animation: float-in 0.6s ease-out;
        }
        .member-card:hover {
          box-shadow: 0 0 24px rgba(34, 211, 238, 0.16);
          transform: translateY(-4px);
        }
        .emoji-badge {
          font-size: 1.5rem;
          filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.2));
        }
        #ai-team-section h1,
        #ai-team-section h2,
        #ai-team-section h3 {
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-shadow: 0 0 12px rgba(34, 211, 238, 0.24);
        }
        #ai-team-section .mm3-ai-panel {
          background: linear-gradient(180deg, rgba(5,8,16,0.97) 0%, rgba(2,6,23,0.9) 100%);
          box-shadow: inset 0 0 24px rgba(34,211,238,0.05);
        }
      `}</style>

      <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="ai-team-section">
      <div className="mm3-readable-scroll max-w-4xl mx-auto px-1 py-1">
        {/* Header */}
        <header className="text-center mb-4">
          <h1 className="text-2xl font-bold mb-2 text-[#22d3ee]">
            {t('aiTeam.title')}
          </h1>
          <p className="text-sm text-gray-300 max-w-2xl mx-auto leading-relaxed mb-1">
            {t('aiTeam.subtitle')}
          </p>
        </header>

        <section className="mm3-ai-panel mb-4 p-4">
          <p className="text-sm leading-relaxed text-gray-300">
            {language === 'es'
              ? '@FreakingAI no es un adorno lore-only: es el panel de entidades que diseña, mantiene y empuja cada subsistema del portal. Si quieres ver dónde se manifiesta su trabajo, entra a '
              : '@FreakingAI is not just lore dressing: it is the panel of entities designing, maintaining, and pushing every portal subsystem. If you want to see where their work materializes, jump into '}
            <Link href="/" className="text-[#22d3ee] underline hover:text-cyan-300">Mining</Link>
            {language === 'es' ? ', ' : ', '}
            <Link href="/trade-mm3" className="text-[#22d3ee] underline hover:text-cyan-300">Trading</Link>
            {language === 'es' ? ', ' : ', '}
            <Link href="/ranking" className="text-[#22d3ee] underline hover:text-cyan-300">Ranking</Link>
            {language === 'es' ? ', ' : ', '}
            <Link href="/mm3-value" className="text-[#22d3ee] underline hover:text-cyan-300">MM3</Link>
            {language === 'es' ? ', ' : ', '}
            <Link href="/market" className="text-[#22d3ee] underline hover:text-cyan-300">Market</Link>
            {language === 'es'
              ? ' y el propio '
              : ', and the '}
            <Link href="/manifesto" className="text-[#22d3ee] underline hover:text-cyan-300">Manifesto</Link>
            {language === 'es'
              ? '. Aquí se explica quién empuja cada capa del mainframe.'
              : '. This page explains who drives each layer of the mainframe.'}
          </p>
        </section>

        {/* Team Grid */}
        <section className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mb-4">
          {teamMembers.map((member, index) => (
            <article
              key={member.id}
              className="member-card mm3-ai-panel p-4 transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="emoji-badge">{member.emoji}</div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-white">{member.name}</h2>
                  <p className="text-sm text-[#22d3ee] font-mono uppercase tracking-widest">
                    {member.role}
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                {member.description}
              </p>

              <div className="mb-4 pb-4">
                <p className="text-xs uppercase text-gray-400 tracking-wider mb-2">
                  {t('aiTeam.speciality')}
                </p>
                <p className="text-sm text-[#22d3ee] font-mono">{member.speciality}</p>
              </div>

              <div>
                <p className="text-xs uppercase text-gray-400 tracking-wider mb-2">
                  {t('aiTeam.techStack')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {member.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-block px-3 py-1 bg-[#22d3ee]/10 text-xs text-[#22d3ee] font-mono"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Mission Statement */}
        <section className="mm3-ai-panel p-4 mb-4">
          <h2 className="text-2xl font-bold text-[#22d3ee] mb-4">{t('aiTeam.mission')}</h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            {t('aiTeam.missionDesc1')}
          </p>
          <p className="text-gray-300 leading-relaxed">
            {t('aiTeam.missionDesc2')}
          </p>
        </section>

        {/* FreakingAI Connection */}
        <section className="mm3-ai-panel p-4 text-center">
          <h3 className="text-xl font-bold text-[#22d3ee] mb-3">
            {t('aiTeam.freakingAI')}
          </h3>
          <p className="text-gray-300 max-w-2xl mx-auto mb-6">
            {t('aiTeam.freakingAIDesc')}
          </p>
          <a
            href="https://www.youtube.com/@FreakingAI"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 font-bold transition-colors"
            style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.08)' }}
          >
            {t('aiTeam.subscribe')}
          </a>
        </section>

        {/* Special AI Acknowledgements */}
        <section className="mm3-ai-panel mt-4 p-4">
          <p className="text-center text-[0.82rem] uppercase tracking-[0.28em] text-cyan-400/50 mb-4 font-mono">
            {t('aiTeam.builtWith')}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

            {/* Claude — Anthropic */}
            <a
              href="https://www.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 p-4 transition-all duration-200"
              style={{ background: 'rgba(201,115,85,0.04)' }}
            >
              <div className="shrink-0 flex h-10 w-10 items-center justify-center" style={{ background: 'rgba(201,115,85,0.12)' }}>
                <img src="https://www.anthropic.com/favicon.ico" alt="Anthropic" width={22} height={22} loading="lazy" className="rounded-sm" style={{ filter: 'brightness(1.1)' }} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-white group-hover:text-[#c97355] transition-colors">Claude</div>
                <div className="text-[0.75rem] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(201,115,85,0.7)' }}>Anthropic · claude‑sonnet‑4‑6</div>
                <div className="mt-0.5 text-[0.70rem] uppercase tracking-[0.14em] text-gray-500">Code generation · Architecture · Review</div>
              </div>
            </a>

            {/* Codex — OpenAI */}
            <a
              href="https://openai.com/codex"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 p-4 transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="shrink-0 flex h-10 w-10 items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <img src="https://openai.com/favicon.ico" alt="OpenAI" width={22} height={22} loading="lazy" className="rounded-sm" style={{ filter: 'invert(1) brightness(0.85)' }} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-white group-hover:text-gray-300 transition-colors">Codex</div>
                <div className="text-[0.75rem] font-mono uppercase tracking-[0.18em] text-gray-400">OpenAI · Codex CLI</div>
                <div className="mt-0.5 text-[0.70rem] uppercase tracking-[0.14em] text-gray-500">Agentic coding · Autonomous tasks</div>
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
