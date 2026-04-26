import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy · MathsMine3',
  description: 'Privacy Policy for MathsMine3 — how we handle data, cookies, and third-party services.',
};

export default function PrivacyPage() {
  return (
    <main className="w-full max-w-2xl mx-auto px-4 py-6 font-mono text-sm text-gray-300">
      <h1 className="text-xl font-black uppercase tracking-widest text-[#22d3ee] mb-1">Privacy Policy</h1>
      <p className="text-[0.65rem] text-slate-600 mb-6">Last updated: April 2025 · Controller: FreakingAI · <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400">botsandpods@gmail.com</a></p>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">1. Data We Collect</h2>
        <ul className="list-none space-y-2 text-[0.78rem] leading-relaxed text-gray-400">
          <li><span className="text-cyan-600">// wallet addresses</span> — stored pseudonymously for gameplay tracking, leaderboards, NFTmoji ownership and trade balances. Not linked to any real identity.</li>
          <li><span className="text-cyan-600">// IRC messages</span> — text, timestamp, wallet address, tone. Stored permanently in our database (Supabase). Visible to all users on the IRC channel.</li>
          <li><span className="text-cyan-600">// IP addresses</span> — collected temporarily for rate limiting and abuse prevention only. Not stored long-term or shared.</li>
          <li><span className="text-cyan-600">// gameplay events</span> — math answers, solve times, penalties, market transactions. Public by design — all leaderboard data is visible to all users.</li>
          <li><span className="text-cyan-600">// Google account (optional)</span> — if you sign in with Google, your Google email is used as a soft wallet identifier. Governed by Google's Privacy Policy.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">2. How We Use Your Data</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          Gameplay data is used exclusively to operate the game — leaderboards, token mining, market mechanics, and IRC communication. We do not sell, rent, or share personal data with third parties for commercial purposes beyond the analytics services listed below.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">3. Third-Party Services</h2>
        <ul className="list-none space-y-2 text-[0.78rem] leading-relaxed text-gray-400">
          <li><span className="text-cyan-600">Supabase</span> — database and realtime backend. Data stored on EU or US servers per Supabase infrastructure. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">Supabase Privacy Policy</a>.</li>
          <li><span className="text-cyan-600">Google Analytics (GA4) + Google Tag Manager</span> — collects anonymized usage statistics (page views, session duration, events). May use cookies. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">Google Privacy Policy</a>. Opt out: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">GA Opt-out</a>.</li>
          <li><span className="text-cyan-600">Google AdSense</span> — may serve personalized ads using cookies and device identifiers. <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">Ad Technology Policy</a>. Opt out via <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">Ad Settings</a>.</li>
          <li><span className="text-cyan-600">WalletConnect / Wagmi</span> — Web3 wallet connection infrastructure. Wallet addresses shared only as required to sign transactions. No private keys ever transmitted.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">4. Cookies</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          We use cookies for analytics (GA4), tag management (GTM), and advertising (AdSense). A consent banner is shown on first visit. Your preference is stored in <code className="text-cyan-600">localStorage</code> under the key <code className="text-cyan-600">mm3_cookies_accepted</code>. You can withdraw consent at any time by clearing your browser storage or using your browser&apos;s cookie settings.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">5. Your Rights (GDPR / CCPA)</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          You have the right to access, correct, or request deletion of any data linked to your wallet address or Google account. Since wallet addresses are pseudonymous, we cannot verify identity without the wallet itself. Submit deletion requests to <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400 underline">botsandpods@gmail.com</a> — include your wallet address. IRC messages can be removed upon verified request.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">6. Data Retention</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          Gameplay data and leaderboard records are retained indefinitely as they form the core of the game state. IRC messages are stored permanently. IP-based rate-limiting data is purged automatically after the limiting window expires.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">7. Children</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          MathsMine3 is not directed at children under 16. We do not knowingly collect data from minors. Cryptocurrency-related features require users to be of legal age in their jurisdiction.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">8. Changes to This Policy</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          We may update this policy. Material changes will be announced on the <Link href="/manifesto" className="text-cyan-700 hover:text-cyan-400 underline">Manifesto</Link> page. The &quot;Last updated&quot; date at the top of this page reflects the most recent revision.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">9. Contact</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          Privacy inquiries: <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400 underline">botsandpods@gmail.com</a>
        </p>
      </section>

      <div className="mt-8 border-t border-cyan-900/30 pt-4 text-[0.62rem] text-slate-700">
        <Link href="/terms" className="hover:text-cyan-600 mr-4">Terms of Use</Link>
        <Link href="/manifesto" className="hover:text-cyan-600">Manifesto</Link>
      </div>
    </main>
  );
}
