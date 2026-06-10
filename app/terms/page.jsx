'use client';

import Link from 'next/link';
import SectionFrame from '@/components/SectionFrame';
import { useI18n } from '@/lib/i18n-context';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function TermsPage() {
  const { language } = useI18n();
  const { frameAccent } = useMm3Accent();
  const es = language === 'es';

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="terms-section">
        <div className="mm3-readable-scroll max-w-2xl mx-auto px-1 py-1 font-mono text-sm text-gray-400">
          <style>{`
            #terms-section h1, #terms-section h2 {
              letter-spacing: 0.12em;
              text-transform: uppercase;
              text-shadow: 0 0 12px rgba(34,211,238,0.24);
            }
          `}</style>

          <h1 className="text-xl font-black text-[#22d3ee] mb-1">
            {es ? 'Términos de Uso' : 'Terms of Use'}
          </h1>
          <p className="text-[0.88rem] text-slate-600 mb-6">
            {es ? 'Última actualización: abril 2026' : 'Last updated: April 2026'} · MathsMine3 / FreakingAI ·{' '}
            <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400">botsandpods@gmail.com</a>
          </p>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '1. Aceptación' : '1. Acceptance'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? <>Al acceder o usar MathsMine3 (<strong className="text-gray-300">mathsmine3.xyz</strong>), aceptas estos Términos de Uso. Si no estás de acuerdo, no uses la plataforma.</>
                : <>By accessing or using MathsMine3 (<strong className="text-gray-300">mathsmine3.xyz</strong>), you agree to these Terms of Use. If you do not agree, do not use the platform.</>}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '2. Requisitos' : '2. Eligibility'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? 'Debes tener al menos 18 años (o la mayoría de edad legal en tu jurisdicción, la que sea mayor) para usar MathsMine3. Al conectar una wallet o participar en cualquier mecánica de juego, declaras cumplir este requisito.'
                : 'You must be at least 18 years old (or the legal age of majority in your jurisdiction, whichever is higher) to use MathsMine3. By connecting a wallet or participating in any game mechanic, you represent that you meet this requirement.'}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '3. Uso Permitido' : '3. Permitted Use'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es ? 'MathsMine3 es un juego. Aceptas:' : 'MathsMine3 is a game. You agree to:'}
            </p>
            <ul className="list-none mt-2 space-y-1 leading-relaxed text-gray-400">
              <li>
                <span className="text-cyan-600">// play fairly</span> —{' '}
                {es
                  ? 'no usar automatización, bots, scripts o exploits para obtener ventaja injusta.'
                  : 'no automation, bots, scripts, or exploits to gain unfair advantage.'}
              </li>
              <li>
                <span className="text-cyan-600">// respect other players</span> —{' '}
                {es
                  ? 'el chat IRC no debe contener discurso de odio, acoso, spam o contenido ilegal.'
                  : 'IRC chat must not contain hate speech, harassment, spam, or illegal content.'}
              </li>
              <li>
                <span className="text-cyan-600">// secure your wallet</span> —{' '}
                {es
                  ? 'eres el único responsable de las claves privadas y fondos de tu wallet. Nunca solicitamos claves privadas.'
                  : 'you are solely responsible for your wallet private keys and funds. We never request private keys.'}
              </li>
              <li>
                <span className="text-cyan-600">// comply with local laws</span> —{' '}
                {es
                  ? 'es tu responsabilidad asegurarte de que el uso de criptomonedas está permitido en tu jurisdicción.'
                  : 'it is your responsibility to ensure cryptocurrency use is permitted in your jurisdiction.'}
              </li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '4. Resultados de Juego' : '4. Gameplay Outcomes'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? <>Todos los resultados de juego — saldos de tokens MM3, penalizaciones de nivel, drops de NFTJI, compras de bloques de Market, reventas y penalizaciones por comandos IRC — son <strong className="text-gray-300">permanentes</strong> salvo cuando el propio juego ofrece una vía de reintegro o recuperación. Nos reservamos el derecho de corregir resultados causados por errores verificados del sistema.</>
                : <>All gameplay results — MM3 token balances, level penalties, NFTJI drops, Market block purchases, resells, and IRC command penalties — are <strong className="text-gray-300">permanent</strong> unless the game explicitly provides a refund or recovery path. We reserve the right to correct outcomes caused by verified system errors.</>}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '5. Donaciones y Sin Reembolsos' : '5. Donations & No Refunds'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? <>Las donaciones voluntarias en ETH enviadas a través del portal son <strong className="text-gray-300">irrembolsables</strong>. Las transacciones blockchain son irreversibles. Las donaciones no otorgan acceso exclusivo, funciones ni derechos adicionales.</>
                : <>Voluntary on-chain ETH donations sent via the portal are <strong className="text-gray-300">non-refundable</strong>. Blockchain transactions are irreversible. Donations do not grant any exclusive access, features, or rights.</>}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '6. Aviso sobre el Token MM3' : '6. MM3 Token Disclaimer'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? 'Los tokens MM3 minados en el juego son unidades de juego sin valor monetario real garantizado. Solo pueden intercambiarse dentro de las mecánicas de la plataforma. MathsMine3 no hace ninguna declaración sobre su valor futuro. Esta plataforma no constituye asesoramiento financiero.'
                : 'MM3 tokens mined in the game are in-game units with no guaranteed real-world monetary value. They can be traded within the platform mechanics only. MathsMine3 makes no representation regarding their future value. This platform does not constitute financial advice.'}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '7. Datos Públicos' : '7. Public Data'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? 'Todos los datos de juego — direcciones de wallet, posiciones en el leaderboard, saldos de tokens, historial de trades, propiedad de Market y mensajes IRC — son públicos y visibles para todos los usuarios. No compartas información por IRC que desees mantener privada.'
                : 'All gameplay data — wallet addresses, leaderboard positions, token balances, trade history, market ownership, and IRC messages — is public and visible to all users. Do not share information via IRC that you wish to keep private.'}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '8. Propiedad Intelectual' : '8. Intellectual Property'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? <>El código fuente de MathsMine3 es open-source bajo la <strong className="text-gray-300">Licencia MIT</strong> y está alojado en <a href="https://github.com/carlosramosgallardo/MathsMine3" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">GitHub</a>. El nombre MathsMine3, el logotipo y la identidad visual son &copy; 2026 FreakingAI. Todos los derechos reservados.</>
                : <>The MathsMine3 source code is open-source under the <strong className="text-gray-300">MIT License</strong> and hosted on <a href="https://github.com/carlosramosgallardo/MathsMine3" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">GitHub</a>. The MathsMine3 name, logo, and visual identity are &copy; 2026 FreakingAI. All rights reserved.</>}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '9. Exenciones y Limitación de Responsabilidad' : '9. Disclaimers & Limitation of Liability'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? <>La plataforma se proporciona <strong className="text-gray-300">&quot;tal cual&quot;</strong> sin garantía de ningún tipo. FreakingAI no es responsable de: pérdida de fondos por mala gestión de la wallet, fallos en transacciones blockchain, tiempo de inactividad, pérdida de datos ni ningún daño indirecto derivado del uso de la plataforma. Úsala bajo tu propio riesgo.</>
                : <>The platform is provided <strong className="text-gray-300">&quot;as is&quot;</strong> without warranty of any kind. FreakingAI is not liable for: loss of funds due to wallet mismanagement, blockchain transaction failures, downtime, data loss, or any indirect damages arising from use of the platform. Use at your own risk.</>}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '10. Terminación' : '10. Termination'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? 'Nos reservamos el derecho de restringir o cancelar el acceso a cualquier wallet o usuario que incumpla estos términos, especialmente por abuso, automatización o comportamiento disruptivo en el IRC, sin previo aviso.'
                : 'We reserve the right to restrict or terminate access for any wallet or user found to be in violation of these terms, particularly for abuse, automation, or disruptive IRC behavior, without prior notice.'}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '11. Ley Aplicable' : '11. Governing Law'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? 'Estos términos se rigen por las leyes de España. Cualquier disputa se resolverá ante los tribunales de España, sin perjuicio de los derechos obligatorios de protección al consumidor aplicables bajo la legislación de la UE.'
                : 'These terms are governed by the laws of Spain. Any disputes shall be resolved in the courts of Spain, without prejudice to mandatory consumer protection rights under applicable EU law.'}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '12. Herramienta de Auditoría de Seguridad' : '12. Security Audit Tool'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? <>
                    El escáner de seguridad disponible en <a href="https://mathsmine3.xyz/security" className="text-cyan-700 hover:text-cyan-400 underline">/security</a> realiza pruebas automatizadas
                    exclusivamente sobre <strong className="text-gray-300">mathsmine3.xyz</strong> y su código fuente público en{' '}
                    <a href="https://github.com/carlosramosgallardo/MathsMine3" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">github.com/carlosramosgallardo/MathsMine3</a>.
                    Todas las comprobaciones consisten en peticiones HTTP de solo lectura, handshakes TLS y análisis estático.
                    No se realizan acciones destructivas, ataques de fuerza bruta, ataques de denegación de servicio ni pruebas sobre sistemas de terceros.
                    Los resultados se almacenan en nuestra base de datos con carácter informativo y son accesibles desde la propia página de auditoría.
                    El uso de esta herramienta está sujeto a estos Términos; queda prohibido cualquier intento de usar o modificar la herramienta
                    para atacar sistemas externos al alcance definido.
                  </>
                : <>
                    The security scanner available at <a href="https://mathsmine3.xyz/security" className="text-cyan-700 hover:text-cyan-400 underline">/security</a> runs automated checks
                    exclusively against <strong className="text-gray-300">mathsmine3.xyz</strong> and its public codebase at{' '}
                    <a href="https://github.com/carlosramosgallardo/MathsMine3" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">github.com/carlosramosgallardo/MathsMine3</a>.
                    All checks consist of read-only HTTP requests, TLS handshakes, and static analysis.
                    No destructive actions, brute-force attacks, denial-of-service attempts, or probes against third-party systems are performed at any point.
                    Scan results are stored in our database for informational purposes and are accessible from the audit page.
                    Use of this tool is subject to these Terms; any attempt to repurpose or modify the tool
                    to target systems outside the defined scope is strictly prohibited.
                  </>}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '13. Contacto' : '13. Contact'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es ? 'Consultas sobre estos términos:' : 'Questions about these terms:'}{' '}
              <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400 underline">botsandpods@gmail.com</a>
            </p>
          </section>

          <div className="mt-6 border-t border-cyan-900/30 pt-4 text-[0.75rem] text-slate-700">
            <Link href="/privacy" className="hover:text-cyan-600 mr-4">
              {es ? 'Política de Privacidad' : 'Privacy Policy'}
            </Link>
            <Link href="/manifesto" className="hover:text-cyan-600">{es ? 'Manifiesto' : 'Manifesto'}</Link>
          </div>
        </div>
      </SectionFrame>
    </main>
  );
}
