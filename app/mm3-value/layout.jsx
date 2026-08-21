const OG_IMAGE = { url: '/og-image.jpg', width: 1200, height: 630, alt: 'MathsMine3 — MM3 Token Live Chart' };

export const metadata = {
  title: 'MM3 Token Live Chart',
  description: 'Track the real-time value of MM3 tokens. Hourly and minute-level charts showing how mining activity, trade commissions, NFTJI drops, and market events move the global token price.',
  alternates: { canonical: '/mm3-value' },
  openGraph: {
    title: 'MM3 Token Live Chart | MathsMine3',
    description: 'Real-time MM3 token value driven by player mining, trades, NFT events, and market activity.',
    url: 'https://mathsmine3.xyz/mm3-value',
    images: [OG_IMAGE],
  },
  twitter: { card: 'summary_large_image', title: 'MM3 Token Live Chart | MathsMine3', images: ['/og-image.jpg'] },
};
export default function Mm3ValueLayout({ children }) { return children; }
