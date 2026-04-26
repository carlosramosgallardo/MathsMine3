// app/layout.jsx
/**
 * Root layout component for MathsMine3
 *
 * TRACKING & COOKIES:
 * - Google Tag Manager (GTM) injected via Script (beforeInteractive strategy)
 * - Google Analytics 4 (GA) injected via Script (afterInteractive strategy)
 * - Google AdSense injected via Script for ad serving
 * - CookieBanner component shows consent prompt if user hasn't accepted cookies yet
 * - Cookie preference stored in localStorage ('mm3_cookies_accepted')
 *
 * All third-party tracking requires user consent via CookieBanner.
 * See components/CookieBanner.jsx for implementation.
 */
import './globals.css';
import Script from 'next/script';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CookieBanner from '@/components/CookieBanner';
import GlobalRouteLoading from '@/components/GlobalRouteLoading';
import RouteShell from '@/components/RouteShell';
import { I18nProvider } from '@/lib/i18n-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { SoundProvider } from '@/lib/sound-context';
import ConnectAndPlayProvider from '@/components/ConnectAndPlay';
import { GoogleAuthProvider } from '@/lib/google-auth-context'
import { DiceProvider } from '@/lib/dice-context';

export const metadata = {
  title: { default: 'MathsMine3', template: '%s · MathsMine3' },
  description:
    'Solve math problems to mine MM3 tokens, climb the prestige ranking, and watch your impact on a live token chart. A crypto-freak game powered entirely by an AI team.',
  metadataBase: new URL('https://mathsmine3.xyz'),
  alternates: {
    canonical: '/',
  },
  keywords: ['math game', 'crypto game', 'mine tokens', 'MM3', 'blockchain game', 'math mining', 'NFT game', 'web3 game'],
  authors: [{ name: 'MathsMine3 AI Team', url: 'https://mathsmine3.xyz/ai-team' }],
  openGraph: {
    title: 'MathsMine3 — Mine Math. Earn MM3.',
    description:
      'Solve math to mine MM3 tokens. Trade them, collect NFT power-ups, and compete on the prestige leaderboard. Run by an all-AI team.',
    url: 'https://mathsmine3.xyz',
    siteName: 'MathsMine3',
    images: [{ url: '/og-image.jpg', width: 500, height: 500, alt: 'MathsMine3 — Mine Math. Earn MM3.' }],
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@FreakingAI',
    title: 'MathsMine3 — Mine Math. Earn MM3.',
    description:
      'Solve math → mine MM3 → trade & climb the prestige board. A retro crypto-freak game built by AIs.',
    images: ['/og-image.jpg'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  verification: { google: 'gDZ6YsrEQmEOyw0G5obPXV1HX5uPD0LTtAaltZNPhFk' },
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
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" />
        <link rel="preconnect" href="https://googleads.g.doubleclick.net" />

        <Script
          id="adsbygoogle"
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`}
          crossOrigin="anonymous"
          async
        />
        <Script id="gtm-init" strategy="beforeInteractive">{`
          (function(w,d,s,l,i){w[l]=w[l]||[];
            w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
            var f=d.getElementsByTagName(s)[0], j=d.createElement(s), dl=l!='dataLayer'?'&l='+l:'';
            j.async=true; j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
            f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');
        `}</Script>
        {GA_ID && (
          <>
            <Script id="ga4-src" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { page_path: window.location.pathname });
              gtag('event', 'page_view', {
                page_path: window.location.pathname,
                page_title: document.title,
                engagement_time_msec: 100
              });
            `}</Script>
          </>
        )}
      </head>

      <body className="h-full bg-black text-white font-mono">
        <noscript dangerouslySetInnerHTML={{ __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>` }} />
        <I18nProvider>
          <CurrencyProvider>
            <SoundProvider>
              <ConnectAndPlayProvider>
                <GoogleAuthProvider>
                  <DiceProvider>
                    <RouteShell>
                      <Header />
                      <GlobalRouteLoading />
                      <main className="mm3-shell-main pt-[148px] sm:pt-[170px] lg:pt-[192px] pb-[32px] h-screen overflow-y-auto">
                        {children}
                      </main>
                      <Footer />
                      <CookieBanner />
                    </RouteShell>
                  </DiceProvider>
                </GoogleAuthProvider>
              </ConnectAndPlayProvider>
            </SoundProvider>
          </CurrencyProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
