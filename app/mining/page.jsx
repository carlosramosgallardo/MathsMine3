import MiningPageClient from '@/components/MiningPageClient';

export const metadata = {
  title: 'Mining — Solve Math Problems',
  description: 'Mine MM3 tokens by solving math problems before time runs out. Each correct answer injects tokens into the global pool. No download, no gas fees — play as guest or connect your wallet.',
  alternates: { canonical: '/mining' },
  openGraph: {
    title: 'Mining — Solve Math Problems | MathsMine3',
    description: 'Solve math problems to earn MM3 tokens. Speed and accuracy both count.',
    url: 'https://mathsmine3.xyz/mining',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'MathsMine3 — Mining' }],
  },
  twitter: { card: 'summary_large_image', title: 'Mining | MathsMine3', images: ['/og-image.jpg'] },
};

export default function MiningPage() {
  return <MiningPageClient />;
}
