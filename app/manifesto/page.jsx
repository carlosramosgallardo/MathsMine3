'use client';

import Link from 'next/link';
import SectionFrame from '@/components/SectionFrame';
import { useI18n } from '@/lib/i18n-context';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function ManifestoPage() {
  const { t, language } = useI18n();
  const { frameAccent } = useMm3Accent();

  const menuLinks = [
    {
      href: '/',
      label: 'Mining',
      desc: language === 'es'
        ? 'el núcleo del juego: resolver, minar, fallar, sobrevivir y volver a inyectar MM3 en la cadena'
        : 'the game core: solve, mine, fail, survive, and inject MM3 back into the chain',
    },
    {
      href: '/trade-mm3',
      label: 'Trading',
      desc: language === 'es'
        ? 'la tty ficticia donde la wallet convierte MM3 en EUR, USD o CNY bajo comisiones, macros y Nftmojis'
        : 'the fictional tty where the wallet converts MM3 into EUR, USD, or CNY under commissions, macros, and Nftmojis',
    },
    {
      href: '/ranking',
      label: 'Prestige',
      desc: language === 'es'
        ? 'la tabla pública donde se ordena quién manda en el mainframe por nivel, saldo y señales de wallet'
        : 'the public table where the mainframe hierarchy is ordered by level, balance, and wallet signals',
    },
    {
      href: '/mm3-value',
      label: 'MM3',
      desc: language === 'es'
        ? 'el gráfico vivo que enseña cómo mining, trade, heart y Nftmojis deforman el valor global del sistema'
        : 'the live chart that shows how mining, trade, heart, and Nftmojis distort the system-wide value',
    },
    {
      href: '/market',
      label: 'Market',
      desc: language === 'es'
        ? 'el tablero de bloques donde cada bloque puede ocultar una shell, un short o un Nftmoji reclamable'
        : 'the block board where each block can hide a shell, a short, or a claimable Nftmoji',
    },
    {
      href: '/irc',
      label: 'IRC',
      desc: language === 'es'
        ? 'el relay social del portal: una terminal compartida donde las wallets conectadas hablan en vivo y muestran sus Nftmojis de Market'
        : 'the portal social relay: a shared terminal where connected wallets talk live and show their Market NFTmojis',
    },
    {
      href: '/manifesto',
      label: language === 'es' ? 'Manifiesto' : 'Manifesto',
      desc: language === 'es'
        ? 'el archivo ideológico del portal: por qué existe, qué pretende y cómo leer el resto del menú'
        : 'the ideological archive of the portal: why it exists, what it wants, and how to read the rest of the menu',
    },
    {
      href: '/ai-team',
      label: language === 'es' ? 'Equipo IA' : 'AI Team',
      desc: language === 'es'
        ? 'la cámara de máquinas: quién diseña el comportamiento, la economía, la estética y la narrativa del portal'
        : 'the machine room: who designs the behavior, the economy, the aesthetics, and the narrative of the portal',
    },
    {
      href: '/api',
      label: 'API',
      desc: language === 'es'
        ? 'la salida pública para inspeccionar datos, comprobar estados y leer el pulso del sistema sin maquillaje'
        : 'the public outlet to inspect data, check states, and read the system pulse without makeup',
    },
  ];

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="manifesto-section">
        <div className="max-w-2xl mx-auto px-1 py-1 text-sm font-mono text-gray-400 break-words overflow-x-hidden">
        <style>{`
          #manifesto-section .mm3-manifesto-panel {
            background: linear-gradient(180deg, rgba(5,8,16,0.96) 0%, rgba(2,6,23,0.9) 100%);
            box-shadow: inset 0 0 24px rgba(34,211,238,0.05);
          }
          #manifesto-section h2 {
            letter-spacing: 0.12em;
            text-transform: uppercase;
            text-shadow: 0 0 12px rgba(34,211,238,0.24);
          }
        `}</style>
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

        <section className="mm3-manifesto-panel mb-6 p-4">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">
            {language === 'es' ? 'Propósito del Mainframe' : 'Mainframe Purpose'}
          </h2>
          <p className="leading-relaxed">
            {language === 'es'
              ? 'MathsMine3 existe para convertir aprendizaje matemático, identidad wallet y estética crypto-freak en un único circuito de tensión. No quiere parecer una academia. Quiere parecer un terminal vivo que te obliga a pensar rápido, arriesgar, volver y recordar. Una respuesta incorrecta rompe todo. Una tirada de suerte lo cambia.'
              : 'MathsMine3 exists to fuse mathematical learning, wallet identity, and crypto-freak aesthetics into a single tension circuit. It does not want to feel like an academy. It wants to feel like a live terminal that forces you to think fast, risk, return, and remember. One wrong answer breaks everything. One lucky roll changes it.'}
          </p>
          <p className="leading-relaxed mt-3">
            {language === 'es'
              ? 'El Manifiesto existe para decodificar ese sistema. Explica la intención detrás del portal, enlaza sus módulos y te da una lectura de por qué cada pantalla existe dentro del ritual: Mining, Trading, Prestige, Market, IRC, la cadena de valor MM3.'
              : 'The Manifesto exists to decode that system. It explains the intention behind the portal, links its modules, and gives you a reading of why each screen exists inside the ritual: Mining, Trading, Prestige, Market, IRC, the MM3 value chain.'}
          </p>
          <p className="leading-relaxed mt-3">
            {language === 'es'
              ? 'El circuito también incluye conversación y economía de minado. MM3 se mina, se tradea, se exhibe, se habla y se reclama en el Market. Cada EXEC de trade suma combustible de minado permanente. El relay IRC convierte las wallets en presencia social real sobre el mismo mainframe.'
              : 'The circuit also includes conversation and mining fuel. MM3 is mined, traded, displayed, spoken, and claimed in the Market. Every trade EXEC permanently adds mining fuel. The IRC relay turns wallets into real social presence on the same mainframe.'}
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
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">
            {language === 'es' ? 'Relay Social · IRC' : 'Social Relay · IRC'}
          </h2>
          <p className="leading-relaxed">
            {language === 'es'
              ? 'El canal IRC es la capa social de MathsMine3. No es una red social ni un chat archivado para siempre: es una terminal viva y efímera conectada al pulso real del portal. Las wallets activas entran, su presencia aparece, se ven sus NFTmojis de Market y la conversación solo dura mientras la sesión existe. Sin archivo permanente. Sin rastro.'
              : 'The IRC channel is the social layer of MathsMine3. Not a social network, not a forever-archived chat — a live, ephemeral terminal wired to the real pulse of the portal. Active wallets enter, their presence appears, their Market NFTmojis are visible, and conversation lasts only as long as the session exists. No permanent archive. No trace.'}
          </p>
          <p className="leading-relaxed mt-3">
            {language === 'es'
              ? 'El relay convierte el portal en un espacio compartido sin convertirlo en un vertedero de datos. Mining, trading, ranking, coleccionar y hablar ocurren dentro de la misma cultura terminal. La presencia de wallet es también presencia social.'
              : 'The relay turns the portal into a shared space without turning it into a data dump. Mining, trading, ranking, collecting, and talking all happen inside the same terminal culture. Wallet presence is social presence.'}
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">
            {language === 'es' ? 'Mapa del Menú' : 'Menu Map'}
          </h2>
          <div className="space-y-3">
            {menuLinks.map((entry) => (
              <p key={entry.href} className="leading-relaxed">
                <Link href={entry.href} className="text-[#22d3ee] underline hover:text-cyan-300">
                  {entry.label}
                </Link>
                {language === 'es' ? ' — ' : ' — '}
                {entry.desc}
              </p>
            ))}
          </div>
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
          <p className="leading-relaxed mt-3">
            {language === 'es' ? 'Y entra en el ' : 'And enter the '}
            <Link href="/irc" className="text-[#22d3ee] underline hover:text-cyan-300">
              IRC relay
            </Link>
            {language === 'es'
              ? ' para hablar con otras wallets conectadas, reforzar la comunidad MM3 y ver en tiempo real quién ocupa el mainframe contigo.'
              : ' to talk with other connected wallets, reinforce the MM3 community, and see in real time who is occupying the mainframe with you.'}
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
