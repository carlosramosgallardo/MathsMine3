import MiningPageClient from '@/components/MiningPageClient';
import DeadGate from '@/components/DeadGate';

export const metadata = {
  title: 'Mining — MM3 Block Chain 3D',
  description: 'Explore the MM3 block chain in 3D FPV. Find blocks to mine, buy NFTJIs, and fight enemy wallets in real-time multiplayer. No download, no gas fees.',
  alternates: { canonical: '/mining' },
  openGraph: {
    title: 'Mining — MM3 Block Chain 3D | MathsMine3',
    description: 'Explore the MM3 block chain in 3D. Find blocks, mine NFTJIs, and battle enemy wallets live.',
    url: 'https://mathsmine3.xyz/mining',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'MathsMine3 — Mining 3D' }],
  },
  twitter: { card: 'summary_large_image', title: 'Mining 3D | MathsMine3', images: ['/og-image.jpg'] },
};

export default function MiningPage() {
  return <DeadGate><MiningPageClient /></DeadGate>;
}
