'use client';

import Link from 'next/link';

export default function ManifestoPage() {
  return (
    <main className="flex flex-col items-center w-full px-4 pt-10 pb-20 text-sm font-mono text-gray-400 bg-black overflow-x-hidden">
      <div className="max-w-2xl w-full break-words overflow-x-hidden">
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white">Manifesto</h2>
          <p className="leading-relaxed">
            As the global economy teeters under scrutiny, the desire for personal financial sovereignty grows stronger.
            MathsMine3 offers a symbolic stage: here, anyone can "mine" a fake token and interact with the ecosystem using the only identity that truly matters in Web3: a wallet.
          </p>
        </section>

        <section className="mb-6">
          <p className="leading-relaxed">
            Participation is completely free.
            You can mine with a balance of zero and still affect the system.
            Donations are optional. Impact is not.
          </p>
        </section>

        <section className="mb-6">
          <p className="leading-relaxed">
            Join the <Link href="/pov" className="text-blue-400 underline">Proof of Vote</Link>: respond anonymously yet nomically (by wallet) to yes/no questions on global issues.
          </p>
        </section>

        <section className="mb-6">
          <p className="leading-relaxed">
            Create your own anonymous yes/no questions via <Link href="/poa" className="text-blue-400 underline">Proof of Ask</Link>: submit polls to the community anonymously and see how the world responds to your ideas.
          </p>
        </section>

        <section className="mb-6">
          <p className="leading-relaxed">
            The platform is completely transparent, providing a public <Link href="/api" className="text-blue-400 underline">API</Link> that lets you query, at any moment, real-time and historical data on the token’s value, wallet contributions, polls, and voting results.
          </p>
        </section>

        <section className="mb-6">
          <p className="leading-relaxed">
            Does one person have multiple wallets? Of course. So what? The wife of the Spanish Prime Minister has seven bank accounts and absolutely nothing happens.
          </p>
        </section>

        <section className="mb-6">
          <p className="leading-relaxed">
            This is not a financial product. This is a game. This is a rebellion.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white">About</h2>
          <p className="leading-relaxed">
            MathsMine3 is a social and educational experiment designed as a Web3-inspired game. Players solve math challenges under time pressure to simulate a fictional mining system. No real tokens, blockchain assets, or cryptocurrencies are involved or generated. The platform is 100% free to play and for educational purposes only.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white">Privacy Policy</h2>
          <p className="leading-relaxed">
            MathsMine3 does not collect personal data such as name, email, or passwords. Wallet addresses are stored anonymously for gameplay tracking and leaderboard purposes. We use Supabase to securely store public game data, and Google Analytics for anonymous usage analytics.
          </p>
          <p className="leading-relaxed">
            We also collect IP addresses for the purpose of rate limiting and controlling abusive behaviors like excessive API requests. These IP addresses are stored temporarily and are used to ensure fair access to the platform. The collected IP data is not used for any other purpose and is deleted after a short time.
          </p>
          <p className="leading-relaxed">
            Third-party services like Google AdSense may use cookies to deliver relevant ads. You can manage cookie settings via your browser.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white">Donation Disclaimer</h2>
          <p className="leading-relaxed">
            Donations made through wallet interaction are entirely voluntary and non-refundable. They do not represent a purchase or investment, and do not grant access to any exclusive features or tokens. They are used solely to support the continued development of the platform.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white">Terms of Use</h2>
          <p className="leading-relaxed">
            By using MathsMine3, you agree not to abuse the system through automation, scripting, or spammy interactions. All gameplay data is public and transparent. The site is provided as-is, with no guarantees regarding uptime, data retention, or gameplay outcomes. MathsMine3 reserves the right to remove any offensive or inappropriate content. Users are responsible for the content they publish.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white">Copyright</h2>
          <p className="leading-relaxed">
            MathsMine3 is an open-source project hosted on{' '}
            <a
              href="https://github.com/carlosramosgallardo/MathsMine3"
              className="underline text-blue-400 break-all"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://github.com/carlosramosgallardo/MathsMine3
            </a>
            . All original content, graphics, and game logic are licensed under MIT unless otherwise specified.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">Contact</h2>
          <p className="leading-relaxed">
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
