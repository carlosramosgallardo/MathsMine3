import HomePageClient from '@/components/HomePageClient';
import LandingHero from '@/components/LandingHero';

export const metadata = {
  title: 'MathsMine3 — Solve Math, Mine Crypto | Free Browser Game',
  description: 'Free browser game where you earn MM3 tokens by solving math problems in real time. No download, no gas fees — play as guest or connect your wallet. Live rankings, pool battles, and NFT rewards.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'MathsMine3 — Solve Math, Mine Crypto',
    description: 'Earn MM3 tokens by solving math problems in real time. Free browser game — no download, no gas fees. Live rankings & NFT rewards.',
    url: 'https://mathsmine3.xyz',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'MathsMine3 — Solve Math, Mine Crypto' }],
  },
};

export default function Page() {
  return (
    <>
      <HomePageClient />
      <LandingHero />
    </>
  );
}
