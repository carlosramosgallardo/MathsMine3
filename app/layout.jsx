// app/layout.jsx
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CookieBanner from '@/components/CookieBanner';
import ThirdPartyScripts from '@/components/ThirdPartyScripts';
import GlobalRouteLoading from '@/components/GlobalRouteLoading';
import RouteShell from '@/components/RouteShell';
import NotificationChips from '@/components/NotificationChips';
import WalletBootstrap from '@/components/WalletBootstrap';
import WalletCoreProvider from '@/components/WalletCoreProvider';
import { I18nProvider } from '@/lib/i18n-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { SoundProvider } from '@/lib/sound-context';
import { GoogleAuthProvider } from '@/lib/google-auth-context';
import { DiceProvider } from '@/lib/dice-context';
import { IrcPresenceProvider } from '@/lib/relaying-presence-context';

const OG_IMAGE = { url: '/og-image.jpg', width: 1200, height: 630, alt: 'MathsMine3 — Timed math. Fictional mining. Wallet identity. Terminal economy. Real-time 3D multiplayer world.' };

export const metadata = {
  title: {
    default: 'MathsMine3 — Timed math. Fictional mining. Wallet identity. Terminal economy. Real-time 3D multiplayer world. | Free Browser Game',
    template: '%s | MathsMine3',
  },
  description: 'Free browser game where you earn MM3 tokens by solving math problems in real time. No download, no gas fees — play as guest or connect your wallet. Live rankings, pool battles, and NFT rewards.',
  metadataBase: new URL('https://mathsmine3.xyz'),
  alternates: { canonical: '/' },
  authors: [{ name: 'FreakingAI', url: 'https://mathsmine3.xyz' }],
  keywords: ['math game earn crypto', 'earn tokens solving math', 'crypto mining math puzzle', 'play to earn math game', 'free browser crypto game', 'math quiz blockchain', 'MM3 token game', 'math mining game'],
  openGraph: {
    type: 'website',
    url: 'https://mathsmine3.xyz',
    title: 'MathsMine3 — Timed math. Fictional mining. Wallet identity. Terminal economy. Real-time 3D multiplayer world.',
    description: 'Earn MM3 tokens by solving math problems in real time. Free browser game — no download, no gas fees. Live rankings & NFT rewards.',
    siteName: 'MathsMine3',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MathsMine3 — Timed math. Fictional mining. Wallet identity. Terminal economy. Real-time 3D multiplayer world.',
    description: 'Earn MM3 tokens by solving math problems in real time. Free browser game — no download needed.',
    images: ['/og-image.jpg'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

export default function RootLayout({ children }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/mm3-token.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#070b0f" />
        {supabaseUrl ? <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" /> : null}
        <link rel="dns-prefetch" href="https://verify.walletconnect.com" />
        <link rel="dns-prefetch" href="https://relay.walletconnect.com" />
        <link rel="dns-prefetch" href="https://www.anthropic.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'VideoGame',
            name: 'MathsMine3',
            description: 'Free browser game where you earn MM3 tokens by solving math problems in real time. No download, no gas fees — play as guest or connect your wallet.',
            url: 'https://mathsmine3.xyz',
            genre: ['Puzzle', 'Educational', 'Casual'],
            applicationCategory: 'Game',
            operatingSystem: 'Any (browser-based)',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            author: { '@type': 'Organization', name: 'FreakingAI', url: 'https://mathsmine3.xyz' },
            image: 'https://mathsmine3.xyz/og-image.jpg',
          }) }}
        />
      </head>
      <body className="h-full bg-[#070b0f] text-white font-mono">
        <I18nProvider>
          <CurrencyProvider>
            <SoundProvider>
              <WalletCoreProvider>
                <GoogleAuthProvider>
                  <DiceProvider>
                    <IrcPresenceProvider>
                    <WalletBootstrap />
                    <RouteShell>
                      <Header />
                      <GlobalRouteLoading />
                      <main className="mm3-shell-main pt-[104px] max-sm:portrait:pt-[196px] sm:pt-[118px] lg:pt-[140px] pb-[64px] max-sm:pb-[80px] h-screen overflow-y-auto">
                        <NotificationChips />
                        {children}
                      </main>
                      <Footer />
                      <CookieBanner />
                      <ThirdPartyScripts />
                    </RouteShell>
                    </IrcPresenceProvider>
                  </DiceProvider>
                </GoogleAuthProvider>
              </WalletCoreProvider>
            </SoundProvider>
          </CurrencyProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
