'use client';

import Link from 'next/link';
import SectionFrame from '@/components/SectionFrame';
import { useI18n } from '@/lib/i18n-context';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function ManifestoPage() {
  const { t, language } = useI18n();
  const { frameAccent } = useMm3Accent();
  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="manifesto-section">
        <div className="max-w-2xl mx-auto px-1 py-1 text-sm font-mono text-gray-400 break-words overflow-x-hidden">
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">{t('manifesto.title')}</h2>
          <p className="leading-relaxed">
            {t('manifesto.intro1')}
          </p>
          <p className="leading-relaxed mt-3">
            {t('manifesto.intro2')}
          </p>
          <p className="leading-relaxed mt-3">
            {t('manifesto.intro3')}
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">{t('manifesto.howItWorks')}</h2>
          <p className="leading-relaxed">
            <strong>{t('manifesto.game')}</strong> {t('manifesto.gameDesc')}
          </p>
          <p className="leading-relaxed mt-3">
            <strong>{t('manifesto.ranks')}</strong> {t('manifesto.ranksDesc')}
          </p>
          <p className="leading-relaxed mt-3">
            <strong>{t('manifesto.economy')}</strong> {t('manifesto.economyDesc')}
          </p>
          <p className="leading-relaxed mt-3">
            <strong>{t('manifesto.community')}</strong> {t('manifesto.communityDesc')}
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">{t('manifesto.whyMathsMine3')}</h2>
          <ul className="list-disc list-inside space-y-2 leading-relaxed">
            <li>
              <strong>{t('manifesto.addictiveLearning')}</strong> {t('manifesto.addictiveLearningDesc')}
            </li>
            <li>
              <strong>{t('manifesto.fairTransparent')}</strong> {t('manifesto.fairTransparentDesc')}
            </li>
            <li>
              <strong>{t('manifesto.web3Native')}</strong> {t('manifesto.web3NativeDesc')}
            </li>
            <li>
              <strong>{t('manifesto.freeToPlay')}</strong> {t('manifesto.freeToPlayDesc')}
            </li>
            <li>
              <strong>{t('manifesto.educational')}</strong> {t('manifesto.educationalDesc')}
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <p className="leading-relaxed">
            {t('manifesto.participation')}
          </p>
        </section>

        <section className="mb-6">
          <p className="leading-relaxed">
            {language === 'es' ? 'Explora el terminal de ' : 'Explore the '}
            <Link href="/trade-mm3" className="text-[#22d3ee] underline hover:text-cyan-300">
              Trade MM3
            </Link>
            {language === 'es'
              ? ' para ver el estado ficticio de intercambio de tu wallet en CNY, EUR o USD.'
              : ' terminal to see the fictional trade state for your wallet in CNY, EUR, or USD.'}
          </p>
        </section>

        <section className="mb-6">
          <p className="leading-relaxed">
            {t('manifesto.apiIntro')}{' '}
            <Link href="/api" className="text-[#22d3ee] underline hover:text-cyan-300">
              REST API
            </Link>
            {' '}{t('manifesto.apiDesc')}
          </p>
        </section>

        <section className="mb-6">
          <p className="leading-relaxed">
            <strong>{t('manifesto.disclaimer')}</strong>
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">{t('manifesto.about')}</h2>
          <p className="leading-relaxed">
            {t('manifesto.aboutDesc')}
          </p>
          <p className="leading-relaxed mt-3">
            {t('manifesto.developedBy')}{' '}
            <a
              href="https://www.youtube.com/@FreakingAI"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#22d3ee] underline hover:text-cyan-300"
            >
              {t('manifesto.team')}
            </a>
            {' '}{t('manifesto.teamDesc')}
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">{t('manifesto.privacy')}</h2>
          <p className="leading-relaxed">
            {t('manifesto.privacyDesc1')}
          </p>
          <p className="leading-relaxed mt-3">
            {t('manifesto.privacyDesc2')}
          </p>
          <p className="leading-relaxed mt-3">
            {t('manifesto.privacyDesc3')}
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">{t('manifesto.donation')}</h2>
          <p className="leading-relaxed">
            {t('manifesto.donationDesc')}
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">{t('manifesto.terms')}</h2>
          <p className="leading-relaxed">
            {t('manifesto.termsDesc1')}
          </p>
          <p className="leading-relaxed mt-3">
            <strong>{t('manifesto.noRefunds')}</strong> {t('manifesto.termsDesc2')}
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">{t('manifesto.openSource')}</h2>
          <p className="leading-relaxed">
            {t('manifesto.openSourceDesc')}{' '}
            <a
              href="https://github.com/carlosramosgallardo/MathsMine3"
              className="underline text-[#22d3ee] hover:text-cyan-300 break-all"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            {t('manifesto.license')}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">{t('manifesto.contact')}</h2>
          <p className="leading-relaxed">
            {t('manifesto.contactDesc')}{' '}
            <a href="mailto:botsandpods@gmail.com" className="underline text-[#22d3ee] hover:text-cyan-300">
              botsandpods@gmail.com
            </a>
          </p>
          <p className="leading-relaxed mt-3">
            {t('manifesto.followUs')}{' '}
            <a
              href="https://x.com/freakingai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#22d3ee] underline hover:text-cyan-300"
            >
              @freakingai
            </a>
            {' '}{t('manifesto.on')} X (Twitter) {t('manifesto.on')}{' '}
            <a
              href="https://www.youtube.com/@FreakingAI"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#22d3ee] underline hover:text-cyan-300"
            >
              FreakingAI
            </a>
            {' '}on YouTube.
          </p>
        </section>
        </div>
      </SectionFrame>
    </main>
  );
}
