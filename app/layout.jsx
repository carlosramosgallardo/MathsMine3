// app/layout.jsx
import './globals.css';
import Script from 'next/script';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'MathsMine3',
  description:
    'Fast Math, Mine MM3, and Shape the Future with PoV & PoA. Staffed by an all-AI team with a questionable sense of humor.',
  metadataBase: new URL('https://mathsmine3.xyz'),
  openGraph: {
    title: 'MathsMine3',
    description:
      'Fast Math, Mine MM3, and Shape the Future with PoV & PoA — proudly run by an all-AI crew that blames bugs on humans.',
    url: 'https://mathsmine3.xyz',
    siteName: 'MathsMine3',
    images: [{ url: '/og-image.jpg', width: 800, height: 600, alt: 'MathsMine3 Logo' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@FreakingAI',
    title: 'MathsMine3',
    description:
      'An all-AI team mines ideas while you mine math. If it’s funny, the humans wrote it; if it works, the AIs did.',
    images: ['/og-image.jpg'],
  },
  verification: { google: 'gDZ6YsrEQmEOyw0G5obPXV1HX5uPD0LTtAaltZNPhFk' },
};

export default function RootLayout({ children }) {
  // You can move these to .env as NEXT_PUBLIC_* if you prefer.
  const GTM_ID = 'GTM-5Z3RTKX9';
  const ADS_CLIENT = 'ca-pub-1022737864838438';
  const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-SWPCXV7YF5';

  return (
    <html lang="en">
      <head>
        {/* Canonical + favicon */}
        <link rel="canonical" href="https://mathsmine3.xyz/" />
        <link rel="icon" href="/favicon.ico" />

        {/* Recommended preconnects */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" />
        <link rel="preconnect" href="https://googleads.g.doubleclick.net" />

        {/* AdSense (non-AMP). Make sure your CSP allows these domains. */}
        <Script
          id="adsbygoogle"
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`}
          crossOrigin="anonymous"
          async
        />

        {/* GTM loader as high as possible */}
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

        {/* GA4 direct snippet (use this OR GA inside GTM, not both) */}
        {GA_ID && (
          <>
            <Script
              id="ga4-src"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  page_path: window.location.pathname
                });
              `}
            </Script>
          </>
        )}
      </head>

      <body className="bg-black text-white font-mono">
        {/* NoScript GTM right after <body> */}
        <noscript
          dangerouslySetInnerHTML={{
            __html: `
              <iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
                      height="0" width="0"
                      style="display:none;visibility:hidden"></iframe>
            `,
          }}
        />

        {/* Page content */}
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
