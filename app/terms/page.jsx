import Link from 'next/link';

export const metadata = {
  title: 'Terms of Use · MathsMine3',
  description: 'Terms of Use for MathsMine3 — rules, disclaimers, and conditions for using the platform.',
};

export default function TermsPage() {
  return (
    <main className="w-full max-w-2xl mx-auto px-4 py-6 font-mono text-sm text-gray-300">
      <h1 className="text-xl font-black uppercase tracking-widest text-[#22d3ee] mb-1">Terms of Use</h1>
      <p className="text-[0.65rem] text-slate-600 mb-6">Last updated: April 2025 · MathsMine3 / FreakingAI · <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400">botsandpods@gmail.com</a></p>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">1. Acceptance</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          By accessing or using MathsMine3 (<strong className="text-gray-300">mathsmine3.xyz</strong>), you agree to these Terms of Use. If you do not agree, do not use the platform.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">2. Eligibility</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          You must be at least 18 years old (or the legal age of majority in your jurisdiction, whichever is higher) to use MathsMine3. By connecting a wallet or participating in any game mechanic, you represent that you meet this requirement.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">3. Permitted Use</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          MathsMine3 is a game. You agree to:
        </p>
        <ul className="list-none mt-2 space-y-1 text-[0.78rem] leading-relaxed text-gray-400">
          <li><span className="text-cyan-600">// play fairly</span> — no automation, bots, scripts, or exploits to gain unfair advantage.</li>
          <li><span className="text-cyan-600">// respect other players</span> — IRC chat must not contain hate speech, harassment, spam, or illegal content.</li>
          <li><span className="text-cyan-600">// secure your wallet</span> — you are solely responsible for your wallet private keys and funds. We never request private keys.</li>
          <li><span className="text-cyan-600">// comply with local laws</span> — it is your responsibility to ensure cryptocurrency use is permitted in your jurisdiction.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">4. Gameplay Outcomes</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          All gameplay results — MM3 token balances, level penalties, NFTmoji drops, Market block purchases, resells, and IRC command penalties — are <strong className="text-gray-300">permanent</strong> unless the game explicitly provides a refund or recovery path. We reserve the right to correct outcomes caused by verified system errors.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">5. Donations &amp; No Refunds</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          Voluntary on-chain ETH donations sent via the portal are <strong className="text-gray-300">non-refundable</strong>. Blockchain transactions are irreversible. Donations do not grant any exclusive access, features, or rights. They support platform development.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">6. MM3 Token Disclaimer</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          MM3 tokens mined in the game are in-game units with no guaranteed real-world monetary value. They can be traded within the platform mechanics only. MathsMine3 makes no representation regarding their future value. This platform does not constitute financial advice.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">7. Public Data</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          All gameplay data — wallet addresses, leaderboard positions, token balances, trade history, market ownership, and IRC messages — is public and visible to all users. Do not share information via IRC that you wish to keep private.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">8. Intellectual Property</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          The MathsMine3 source code is open-source under the <strong className="text-gray-300">MIT License</strong> and hosted on <a href="https://github.com/carlosramosgallardo/MathsMine3" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 underline">GitHub</a>. The MathsMine3 name, logo, and visual identity are &copy; 2025 FreakingAI. All rights reserved.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">9. Disclaimers &amp; Limitation of Liability</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          The platform is provided <strong className="text-gray-300">&quot;as is&quot;</strong> without warranty of any kind. FreakingAI is not liable for: loss of funds due to wallet mismanagement, blockchain transaction failures, downtime, data loss, or any indirect damages arising from use of the platform. Use at your own risk.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">10. Termination</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          We reserve the right to restrict or terminate access for any wallet or user found to be in violation of these terms, particularly for abuse, automation, or disruptive IRC behavior, without prior notice.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">11. Governing Law</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          These terms are governed by the laws of Spain. Any disputes shall be resolved in the courts of Spain, without prejudice to mandatory consumer protection rights under applicable EU law.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#22d3ee] mb-2">12. Contact</h2>
        <p className="text-[0.78rem] leading-relaxed text-gray-400">
          Questions about these terms: <a href="mailto:botsandpods@gmail.com" className="text-cyan-700 hover:text-cyan-400 underline">botsandpods@gmail.com</a>
        </p>
      </section>

      <div className="mt-8 border-t border-cyan-900/30 pt-4 text-[0.62rem] text-slate-700">
        <Link href="/privacy" className="hover:text-cyan-600 mr-4">Privacy Policy</Link>
        <Link href="/manifesto" className="hover:text-cyan-600">Manifesto</Link>
      </div>
    </main>
  );
}
