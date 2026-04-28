// app/layout.jsx
import './globals.css';
import Script from 'next/script';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CookieBanner from '@/components/CookieBanner';
import GlobalRouteLoading from '@/components/GlobalRouteLoading';
import RouteShell from '@/components/RouteShell';
import WalletBootstrap from '@/components/WalletBootstrap';
import WalletCoreProvider from '@/components/WalletCoreProvider';
import Web3ModalInit from '@/components/Web3ModalInit';
import { I18nProvider } from '@/lib/i18n-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { SoundProvider } from '@/lib/sound-context';
import { GoogleAuthProvider } from '@/lib/google-auth-context';
import { DiceProvider } from '@/lib/dice-context';
import { IrcPresenceProvider } from '@/lib/irc-presence-context';

export const metadata = {
  title: { default: 'MathsMine3', template: '%s · MathsMine3' },
  description: 'Solve math problems to mine MM3 tokens, climb the ranking, and watch your impact on a live token chart. A crypto-freak game powered by @FreakingAI.',
  metadataBase: new URL('https://mathsmine3.xyz'),
  alternates: { canonical: '/' },
  authors: [{ name: 'FreakingAI', url: 'https://mathsmine3.xyz' }],
};

export default function RootLayout({ children }) {
  const GTM_ID = 'GTM-5Z3RTKX9';
  const ADS_CLIENT = 'ca-pub-1022737864838438';
  const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-SWPCXV7YF5';

  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/mm3-token.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://verify.walletconnect.com" />
        <link rel="dns-prefetch" href="https://relay.walletconnect.com" />
        <Script id="adsbygoogle" strategy="afterInteractive" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`} crossOrigin="anonymous" async />
        <Script id="gtm-init" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}</Script>
        {GA_ID && <><Script id="ga4-src" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" /><Script id="ga4-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{page_path:window.location.pathname});`}</Script></>}
      </head>
      <body className="h-full bg-black text-white font-mono">
        <noscript dangerouslySetInnerHTML={{ __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>` }} />
        <I18nProvider>
          <CurrencyProvider>
            <SoundProvider>
              <WalletCoreProvider>
                <Web3ModalInit />
                <GoogleAuthProvider>
                  <DiceProvider>
                    <IrcPresenceProvider>
                    <WalletBootstrap />
                    <RouteShell>
                      <Header />
                      <GlobalRouteLoading />
                      <main className="mm3-shell-main pt-[164px] sm:pt-[170px] lg:pt-[192px] pb-[32px] h-screen overflow-y-auto">{children}</main>
                      <Footer />
                      <CookieBanner />
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
