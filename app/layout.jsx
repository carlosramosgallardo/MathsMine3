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

export const metadata = {
  title: { default: 'MathsMine3', template: '%s · MathsMine3' },
  description: 'Solve math problems to mine MM3 tokens, climb the ranking, and watch your impact on a live token chart. A crypto-freak game powered by @FreakingAI.',
  metadataBase: new URL('https://mathsmine3.xyz'),
  alternates: { canonical: '/' },
  authors: [{ name: 'FreakingAI', url: 'https://mathsmine3.xyz' }],
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
                      <main className="mm3-shell-main pt-[148px] max-sm:portrait:pt-[200px] sm:pt-[170px] lg:pt-[192px] pb-[64px] max-sm:pb-[80px] h-screen overflow-y-auto">
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
