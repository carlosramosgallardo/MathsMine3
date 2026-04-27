'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';

export default function PrivacyPage() {
  const { language } = useI18n();
  const es = language === 'es';

  return (
    <main className="w-full max-w-2xl mx-auto px-4 py-6 font-mono text-sm text-gray-300">
      <h1 className="text-xl font-black uppercase tracking-widest text-[#22d3ee] mb-1">
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
        <ul className="list-none space-y-2 text-[1.00rem] leading-relaxed text-gray-400">
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
              : 'if you sign in with Google, your Google email is used as a soft wallet identifier. Governed by Google\'s Privacy Policy.'}
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">
          {es ? '2. Cómo Usamos tus Datos' : '2. How We Use Your Data'}
        </h2>
        <p className="text-[1.00rem] leading-relaxed text-gray-400">
          {es
            ? 'Los datos de juego se usan exclusivamente para operar el juego: leaderboards, minería de tokens, mecánicas de mercado y comunicación IRC. No vendemos, alquilamos ni compartimos datos personales con terceros para fines comerciales más allá de los servicios de analítica listados a continuación.'
            : 'Gameplay data is used exclusively to operate the game — leaderboards, token mining, market mechanics, and IRC communication. We do not sell, rent, or share personal data with third parties for commercial purposes beyond the analytics services listed below.'}
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">
          {es ? '3. Servicios de Terceros' : '3. Third-Party Services'}
        </h2>
        <ul className="list-none space-y-2 text-[1.00rem] leading-relaxed text-gray-400">
          <li>
            <span className="text-cyan-600">Supabase</span> —{' '}
            {es ? 'base de datos y backend en tiempo real. Datos almacenados en servidores de la UE o EE.UU. según la infraestructura de Supabase.' : 'database and realtime backend. Data stored on EU or US servers per Supabase infrastructure.'}{' '}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">
              {es ? 'Política de Privacidad de Supabase' : 'Supabase Privacy Policy'}
            </a>.
          </li>
          <li>
            <span className="text-cyan-600">Google Analytics (GA4) + Google Tag Manager</span> —{' '}
            {es
              ? 'recopila estadísticas de uso anonimizadas (páginas vistas, duración de sesión, eventos). Puede usar cookies.'
              : 'collects anonymized usage statistics (page views, session duration, events). May use cookies.'}{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">
              {es ? 'Política de Privacidad de Google' : 'Google Privacy Policy'}
            </a>.{' '}
            {es ? 'Cancelar suscripción:' : 'Opt out:'}{' '}
            <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">
              {es ? 'Desactivar GA' : 'GA Opt-out'}
            </a>.
          </li>
          <li>
            <span className="text-cyan-600">Google AdSense</span> —{' '}
            {es
              ? 'puede mostrar anuncios personalizados usando cookies e identificadores de dispositivo.'
              : 'may serve personalized ads using cookies and device identifiers.'}{' '}
            <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">
              {es ? 'Política de Tecnología Publicitaria' : 'Ad Technology Policy'}
            </a>.{' '}
            {es ? 'Gestionar en' : 'Opt out via'}{' '}
            <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">
              {es ? 'Configuración de Anuncios' : 'Ad Settings'}
            </a>.
          </li>
          <li>
            <span className="text-cyan-600">WalletConnect / Wagmi</span> —{' '}
            {es
              ? 'infraestructura de conexión de wallets Web3. Las direcciones de wallet se comparten solo según sea necesario para firmar transacciones. Nunca se transmiten claves privadas.'
              : 'Web3 wallet connection infrastructure. Wallet addresses shared only as required to sign transactions. No private keys ever transmitted.'}
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">
          {es ? '4. Cookies' : '4. Cookies'}
        </h2>
        <p className="text-[1.00rem] leading-relaxed text-gray-400">
          {es
            ? <>Usamos cookies para analítica (GA4), gestión de etiquetas (GTM) y publicidad (AdSense). Se muestra un banner de consentimiento en la primera visita. Tu preferencia se guarda en <code className="text-cyan-600">localStorage</code> bajo la clave <code className="text-cyan-600">mm3_cookies_accepted</code>. Puedes retirar el consentimiento en cualquier momento borrando el almacenamiento de tu navegador o usando la configuración de cookies de tu navegador.</>
            : <>We use cookies for analytics (GA4), tag management (GTM), and advertising (AdSense). A consent banner is shown on first visit. Your preference is stored in <code className="text-cyan-600">localStorage</code> under the key <code className="text-cyan-600">mm3_cookies_accepted</code>. You can withdraw consent at any time by clearing your browser storage or using your browser&apos;s cookie settings.</>}
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">
          {es ? '5. Tus Derechos (GDPR / CCPA)' : '5. Your Rights (GDPR / CCPA)'}
        </h2>
        <p className="text-[1.00rem] leading-relaxed text-gray-400">
          {es
            ? <>Tienes derecho a acceder, corregir o solicitar la eliminación de cualquier dato vinculado a tu dirección de wallet o cuenta de Google. Dado que las wallets son seudónimas, no podemos verificar identidad sin la propia wallet. Envía solicitudes de eliminación a <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400 underline">botsandpods@gmail.com</a> — incluye tu dirección de wallet. Los mensajes IRC pueden eliminarse previa solicitud verificada.</>
            : <>You have the right to access, correct, or request deletion of any data linked to your wallet address or Google account. Since wallet addresses are pseudonymous, we cannot verify identity without the wallet itself. Submit deletion requests to <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400 underline">botsandpods@gmail.com</a> — include your wallet address. IRC messages can be removed upon verified request.</>}
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">
          {es ? '6. Retención de Datos' : '6. Data Retention'}
        </h2>
        <p className="text-[1.00rem] leading-relaxed text-gray-400">
          {es
            ? 'Los datos de juego y los registros del leaderboard se conservan indefinidamente ya que forman el núcleo del estado del juego. Los mensajes IRC se almacenan de forma permanente. Los datos de limitación de velocidad basados en IP se purgan automáticamente al expirar la ventana de limitación.'
            : 'Gameplay data and leaderboard records are retained indefinitely as they form the core of the game state. IRC messages are stored permanently. IP-based rate-limiting data is purged automatically after the limiting window expires.'}
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">
          {es ? '7. Menores' : '7. Children'}
        </h2>
        <p className="text-[1.00rem] leading-relaxed text-gray-400">
          {es
            ? 'MathsMine3 no está dirigido a menores de 16 años. No recopilamos datos de menores de forma intencionada. Las funciones relacionadas con criptomonedas requieren que los usuarios tengan la edad legal en su jurisdicción.'
            : 'MathsMine3 is not directed at children under 16. We do not knowingly collect data from minors. Cryptocurrency-related features require users to be of legal age in their jurisdiction.'}
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">
          {es ? '8. Cambios en esta Política' : '8. Changes to This Policy'}
        </h2>
        <p className="text-[1.00rem] leading-relaxed text-gray-400">
          {es
            ? <>Podemos actualizar esta política. Los cambios relevantes se anunciarán en la página del <Link href="/manifesto" className="text-cyan-700 hover:text-cyan-400 underline">Manifiesto</Link>. La fecha de &quot;Última actualización&quot; en la parte superior refleja la revisión más reciente.</>
            : <>We may update this policy. Material changes will be announced on the <Link href="/manifesto" className="text-cyan-700 hover:text-cyan-400 underline">Manifesto</Link> page. The &quot;Last updated&quot; date at the top of this page reflects the most recent revision.</>}
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">
          {es ? '9. Contacto' : '9. Contact'}
        </h2>
        <p className="text-[1.00rem] leading-relaxed text-gray-400">
          {es ? 'Consultas de privacidad:' : 'Privacy inquiries:'}{' '}
          <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400 underline">botsandpods@gmail.com</a>
        </p>
      </section>

      <div className="mt-8 border-t border-cyan-900/30 pt-4 text-[0.75rem] text-slate-700">
        <Link href="/terms" className="hover:text-cyan-600 mr-4">
          {es ? 'Términos de Uso' : 'Terms of Use'}
        </Link>
        <Link href="/manifesto" className="hover:text-cyan-600">Manifesto</Link>
      </div>
    </main>
  );
}
