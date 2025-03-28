'use client';

import Link from 'next/link';

export default function LegalPage() {
  return (
    <main className="flex flex-col items-center min-h-screen w-full px-4 pt-10 pb-20 text-sm font-mono text-gray-200 bg-black">
      <div className="max-w-3xl w-full">
        <h1 className="text-3xl font-bold mb-6">Legal & Disclaimer</h1>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">About MathsMine3</h2>
          <p>
            MathsMine3 is a social and educational experiment designed as a Web3-inspired game. Players solve math
            challenges under time pressure to simulate a fictional mining system. No real tokens, blockchain assets,
            or cryptocurrencies are involved or generated. The platform is 100% free to play and for educational
            purposes only.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Privacy Policy</h2>
          <p>
            MathsMine3 does not collect personal data such as name, email, or passwords. Wallet addresses are stored
            anonymously for gameplay tracking and leaderboard purposes. We use Supabase to securely store public
            game data, and Google Analytics for anonymous usage analytics.
          </p>
          <p>
            We also collect IP addresses for the purpose of rate limiting and controlling abusive behaviors like
            excessive API requests. These IP addresses are stored temporarily and are used to ensure fair access to
            the platform. The collected IP data is not used for any other purpose and is deleted after a short time.
          </p>
          <p>
            Third-party services like Google AdSense may use cookies to deliver relevant ads. You can manage cookie
            settings via your browser.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Donation Disclaimer</h2>
          <p>
            Donations made through wallet interaction are entirely voluntary and non-refundable. They do not
            represent a purchase or investment, and do not grant access to any exclusive features or tokens. They
            are used solely to support the continued development of the platform.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Terms of Use</h2>
          <p>
            By using MathsMine3, you agree not to abuse the system through automation, scripting, or spammy
            interactions. All gameplay data is public and transparent. The site is provided as-is, with no guarantees
            regarding uptime, data retention, or gameplay outcomes.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Copyright</h2>
          <p>
            MathsMine3 is an open-source project hosted on{' '}
            <a
              href="https://github.com/carlosramosgallardo/MathsMine3"
              className="underline text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            . All original content, graphics, and game logic are licensed under MIT unless otherwise specified.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Contact</h2>
          <p>
            For inquiries or issues, please email us at:{' '}
            <a href="mailto:botsandpods@gmail.com" className="underline text-blue-400">
              botsandpods@gmail.com
            </a>
          </p>
        </section>

      </div>
    </main>
  );
}
