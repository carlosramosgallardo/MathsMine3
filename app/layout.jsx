import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'MathsMine3',
  description: 'Master Math, Mine MM3, and Shape the Future with PoV & PoA.',
  metadataBase: new URL('https://mathsmine3.xyz'),
  openGraph: {
    title: 'MathsMine3',
    description: 'Master Math, Mine MM3, and Shape the Future with PoV & PoA.',
    url: 'https://mathsmine3.xyz',
    siteName: 'MathsMine3',
    images: [
      {
        url: '/og-image.jpg',
        width: 800,
        height: 600,
        alt: 'MathsMine3 Logo',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@FreakingAI',
    title: 'MathsMine3',
    description: 'Master Math, Mine MM3, and Shape the Future with PoV & PoA.',
    images: ['/og-image.jpg'],
  },
  verification: {
    google: 'gDZ6YsrEQmEOyw0G5obPXV1HX5uPD0LTtAaltZNPhFk',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://mathsmine3.xyz/" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-black text-white font-mono">
        <Header />
        <main>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
