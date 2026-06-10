'use client';

import Link from 'next/link';
import SectionFrame from '@/components/SectionFrame';
import { useI18n } from '@/lib/i18n-context';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function PrivacyPage() {
  const { language } = useI18n();
  const { frameAccent } = useMm3Accent();
  const es = language === 'es';

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="privacy-section">
        <div className="mm3-readable-scroll max-w-2xl mx-auto px-1 py-1 font-mono text-sm text-gray-400">
          <style>{`
            #privacy-section h1, #privacy-section h2 {
              letter-spacing: 0.12em;
              text-transform: uppercase;
              text-shadow: 0 0 12px rgba(34,211,238,0.24);
            }
          `}</style>

          <h1 className="text-xl font-black text-[#22d3ee] mb-1">
            {es ? 'Política de Privacidad' : 'Privacy Policy'}
          </h1>
          <p className="text-[0.88rem] text-slate-600 mb-6">
            {es ? 'Última actualización: abril 2026' : 'Last updated: April 2026'} · Controller: FreakingAI ·{' '}
            <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400">botsandpods@gmail.com</a>
          </p>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '1. Datos que Recopilamos' : '1. Data We Collect'}
            </h2>
            <ul className="list-none space-y-2 leading-relaxed text-gray-400">
              <li>
                <span className="text-cyan-600">// wallet addresses</span> —{' '}
                {es
                  ? 'almacenadas de forma seudónima para el seguimiento de juego, leaderboards, propiedad de NFTJI y balances de trade. No vinculadas a ninguna identidad real.'
                  : 'stored pseudonymously for gameplay tracking, leaderboards, NFTJI ownership and trade balances. Not linked to any real identity.'}
              </li>
              <li>
                <span className="text-cyan-600">// IRC messages</span> —{' '}
                {es
                  ? 'texto, marca de tiempo, dirección de wallet y tono. Almacenados permanentemente en nuestra base de datos (Supabase). Visibles para todos los usuarios en el canal IRC.'
                  : 'text, timestamp, wallet address, tone. Stored permanently in our database (Supabase). Visible to all users on the IRC channel.'}
              </li>
              <li>
                <span className="text-cyan-600">// IP addresses</span> —{' '}
                {es
                  ? 'recopiladas temporalmente solo para limitación de velocidad y prevención de abusos. No se almacenan a largo plazo ni se comparten.'
                  : 'collected temporarily for rate limiting and abuse prevention only. Not stored long-term or shared.'}
              </li>
              <li>
                <span className="text-cyan-600">// gameplay events</span> —{' '}
                {es
                  ? 'respuestas matemáticas, tiempos de resolución, penalizaciones, transacciones de mercado. Públicos por diseño — todos los datos del leaderboard son visibles para todos los usuarios.'
                  : 'math answers, solve times, penalties, market transactions. Public by design — all leaderboard data is visible to all users.'}
              </li>
              <li>
                <span className="text-cyan-600">// Google account (optional)</span> —{' '}
                {es
                  ? 'si inicias sesión con Google, tu email se usa como identificador de wallet suave. Regulado por la Política de Privacidad de Google.'
                  : "if you sign in with Google, your Google email is used as a soft wallet identifier. Governed by Google's Privacy Policy."}
              </li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '2. Cómo Usamos tus Datos' : '2. How We Use Your Data'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? 'Los datos de juego se usan exclusivamente para operar el juego: leaderboards, minería de tokens, mecánicas de mercado y comunicación IRC. No vendemos, alquilamos ni compartimos datos personales con terceros para fines comerciales más allá de los servicios de analítica listados a continuación.'
                : 'Gameplay data is used exclusively to operate the game — leaderboards, token mining, market mechanics, and IRC communication. We do not sell, rent, or share personal data with third parties for commercial purposes beyond the analytics services listed below.'}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '3. Servicios de Terceros' : '3. Third-Party Services'}
            </h2>
            <ul className="list-none space-y-2 leading-relaxed text-gray-400">
              <li>
                <span className="text-cyan-600">Supabase</span> —{' '}
                {es ? 'base de datos y backend en tiempo real. Datos almacenados en servidores de la UE o EE.UU. según la infraestructura de Supabase.' : 'database and realtime backend. Data stored on EU or US servers per Supabase infrastructure.'}{' '}
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">
                  {es ? 'Política de Privacidad de Supabase' : 'Supabase Privacy Policy'}
                </a>.
              </li>
              <li>
                <span className="text-cyan-600">Google Analytics (GA4) + GTM</span> —{' '}
                {es
                  ? 'recopila estadísticas de uso anonimizadas (páginas vistas, duración de sesión, eventos). Puede usar cookies.'
                  : 'collects anonymized usage statistics (page views, session duration, events). May use cookies.'}{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">
                  {es ? 'Política de Google' : 'Google Privacy Policy'}
                </a>.{' '}
                {es ? 'Cancelar:' : 'Opt out:'}{' '}
                <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">GA Opt-out</a>.
              </li>
              <li>
                <span className="text-cyan-600">Google AdSense</span> —{' '}
                {es
                  ? 'puede mostrar anuncios personalizados usando cookies e identificadores de dispositivo.'
                  : 'may serve personalized ads using cookies and device identifiers.'}{' '}
                <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">
                  {es ? 'Gestionar anuncios' : 'Ad Settings'}
                </a>.
              </li>
              <li>
                <span className="text-cyan-600">WalletConnect / Wagmi</span> —{' '}
                {es
                  ? 'infraestructura de conexión de wallets Web3. Las direcciones de wallet se comparten solo según sea necesario. Nunca se transmiten claves privadas.'
                  : 'Web3 wallet connection infrastructure. Wallet addresses shared only as required. No private keys ever transmitted.'}
              </li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '4. Cookies' : '4. Cookies'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? <>Usamos cookies para analítica (GA4), gestión de etiquetas (GTM) y publicidad (AdSense). Se muestra un banner de consentimiento en la primera visita. Tu preferencia se guarda en <code className="text-cyan-600">localStorage</code> bajo la clave <code className="text-cyan-600">mm3_cookies_accepted</code>. Puedes retirar el consentimiento borrando el almacenamiento de tu navegador.</>
                : <>We use cookies for analytics (GA4), tag management (GTM), and advertising (AdSense). A consent banner is shown on first visit. Your preference is stored in <code className="text-cyan-600">localStorage</code> under <code className="text-cyan-600">mm3_cookies_accepted</code>. Withdraw consent at any time by clearing your browser storage.</>}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '5. Tus Derechos (GDPR / CCPA)' : '5. Your Rights (GDPR / CCPA)'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? <>Tienes derecho a acceder, corregir o solicitar la eliminación de cualquier dato vinculado a tu wallet. Envía solicitudes a <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400 underline">botsandpods@gmail.com</a> — incluye tu dirección de wallet. Los mensajes IRC pueden eliminarse previa solicitud verificada.</>
                : <>You have the right to access, correct, or request deletion of any data linked to your wallet. Submit requests to <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400 underline">botsandpods@gmail.com</a> — include your wallet address. IRC messages can be removed upon verified request.</>}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '6. Retención de Datos' : '6. Data Retention'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? 'Los datos de juego y registros del leaderboard se conservan indefinidamente. Los mensajes IRC se almacenan de forma permanente. Los datos de limitación de velocidad basados en IP se purgan automáticamente al expirar la ventana.'
                : 'Gameplay data and leaderboard records are retained indefinitely as they form the core game state. IRC messages are stored permanently. IP-based rate-limiting data is purged automatically after the limiting window expires.'}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '7. Menores' : '7. Children'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? 'MathsMine3 no está dirigido a menores de 16 años. No recopilamos datos de menores de forma intencionada. Las funciones relacionadas con criptomonedas requieren que los usuarios tengan la edad legal en su jurisdicción.'
                : 'MathsMine3 is not directed at children under 16. We do not knowingly collect data from minors. Cryptocurrency-related features require users to be of legal age in their jurisdiction.'}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '8. Cambios en esta Política' : '8. Changes to This Policy'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? <>Los cambios relevantes se anunciarán en la página del <Link href="/manifesto" className="text-cyan-700 hover:text-cyan-400 underline">Manifiesto</Link>. La fecha de &quot;Última actualización&quot; refleja la revisión más reciente.</>
                : <>Material changes will be announced on the <Link href="/manifesto" className="text-cyan-700 hover:text-cyan-400 underline">Manifesto</Link> page. The &quot;Last updated&quot; date reflects the most recent revision.</>}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '9. Datos de la Auditoría de Seguridad' : '9. Security Audit Data'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es
                ? <>
                    El escáner de <a href="/security" className="text-cyan-700 hover:text-cyan-400 underline">/security</a> almacena en Supabase los resultados de cada ejecución:
                    puntuación, resumen de hallazgos, estado por comprobación y marca de tiempo.
                    Estos datos son accesibles desde la propia página de auditoría y exportables como PDF.
                    Las sondas del escáner <strong className="text-gray-300">no recopilan datos de usuarios</strong>; consisten únicamente en peticiones HTTP de solo lectura
                    y análisis estático dirigidos exclusivamente a <strong className="text-gray-300">mathsmine3.xyz</strong>.
                    No se transmite información de terceros ni se almacenan datos externos durante el proceso.
                    Los resultados de escaneo se conservan de forma indefinida como historial de auditoría.
                  </>
                : <>
                    The <a href="/security" className="text-cyan-700 hover:text-cyan-400 underline">/security</a> scanner stores each scan result in Supabase:
                    score, findings summary, per-check status, and timestamp.
                    These results are accessible from the audit page and exportable as PDF.
                    Scanner probes <strong className="text-gray-300">do not collect user data</strong>; they consist solely of read-only HTTP requests
                    and static analysis directed exclusively at <strong className="text-gray-300">mathsmine3.xyz</strong>.
                    No third-party data is transmitted or stored during scanning.
                    Scan results are retained indefinitely as an audit history.
                  </>}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-base font-bold text-[#22d3ee] mb-2">
              {es ? '10. Contacto' : '10. Contact'}
            </h2>
            <p className="leading-relaxed text-gray-400">
              {es ? 'Consultas de privacidad:' : 'Privacy inquiries:'}{' '}
              <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400 underline">botsandpods@gmail.com</a>
            </p>
          </section>

          <div className="mt-6 border-t border-cyan-900/30 pt-4 text-[0.75rem] text-slate-700">
            <Link href="/terms" className="hover:text-cyan-600 mr-4">
              {es ? 'Términos de Uso' : 'Terms of Use'}
            </Link>
            <Link href="/manifesto" className="hover:text-cyan-600">{es ? 'Manifiesto' : 'Manifesto'}</Link>
          </div>
        </div>
      </SectionFrame>
    </main>
  );
}
