// app/layout.jsx
import './globals.css';
import Script from 'next/script';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'MathsMine3',
  description: 'Fast Math, Mine MM3, and Shape the Future with PoV & PoA.',
  metadataBase: new URL('https://mathsmine3.xyz'),
  openGraph: {
    title: 'MathsMine3',
    description: 'Fast Math, Mine MM3, and Shape the Future with PoV & PoA.',
    url: 'https://mathsmine3.xyz',
    siteName: 'MathsMine3',
    images: [{ url: '/og-image.jpg', width: 800, height: 600, alt: 'MathsMine3 Logo' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@FreakingAI',
    title: 'MathsMine3',
    description: 'Fast Math, Mine MM3, and Shape the Future with PoV & PoA.',
    images: ['/og-image.jpg'],
  },
  verification: { google: 'gDZ6YsrEQmEOyw0G5obPXV1HX5uPD0LTtAaltZNPhFk' },
};

export default function RootLayout({ children }) {
  // (si prefieres .env) const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID
  const GTM_ID = 'GTM-5Z3RTKX9';
  const ADS_CLIENT = 'ca-pub-1022737864838438';

  return (
    <html lang="en">
      <head>
        {/* Canonical + favicon */}
        <link rel="canonical" href="https://mathsmine3.xyz/" />
        <link rel="icon" href="/favicon.ico" />

        {/* Preconnects recomendados */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" />
        <link rel="preconnect" href="https://googleads.g.doubleclick.net" />

        {/* AdSense (no AMP). Activa Auto ads en AdSense si quieres que Google coloque anuncios automáticamente */}
        <Script
          id="adsbygoogle"
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`}
          crossOrigin="anonymous"
          async
        />

        {/* GTM loader lo más arriba posible */}
        <Script id="gtm-init" strategy="beforeInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];
              w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0], j=d.createElement(s), dl=l!='dataLayer'?'&l='+l:'';
              j.async=true; j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
              f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          `}
        </Script>
      </head>

      <body className="bg-black text-white font-mono">
        {/* Noscript GTM inmediatamente tras <body> */}
        <noscript
          dangerouslySetInnerHTML={{
            __html: `
              <iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
                      height="0" width="0"
                      style="display:none;visibility:hidden"></iframe>
            `,
          }}
        />

        {/* ❌ Eliminado: <amp-auto-ads> y scripts AMP (no aplican en App Router) */}

        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
