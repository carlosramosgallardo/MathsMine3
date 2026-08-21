const OG_IMAGE = { url: '/og-image.jpg', width: 1200, height: 630, alt: 'MathsMine3 — Relaying Terminal' };

export const metadata = {
  title: 'Relaying — Chain Command Terminal',
  description: 'Broadcast mining commands to connected wallets in your relay chain. Coordinate pool strategy, trigger chain mines, and track relay activity in real time.',
  alternates: { canonical: '/relaying' },
  openGraph: {
    title: 'Relaying — Chain Command Terminal | MathsMine3',
    description: 'Broadcast commands across your relay chain. Coordinate pool strategy and trigger chain mines in real time.',
    url: 'https://mathsmine3.xyz/relaying',
    images: [OG_IMAGE],
  },
  twitter: { card: 'summary_large_image', title: 'Relaying — Chain Command Terminal | MathsMine3', images: ['/og-image.jpg'] },
};
export default function RelayingLayout({ children }) { return children; }
