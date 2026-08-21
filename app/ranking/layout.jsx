const OG_IMAGE = { url: '/og-image.jpg', width: 1200, height: 630, alt: 'MathsMine3 — Live Rankings' };

export const metadata = {
  title: 'Live Rankings — Top MM3 Miners',
  description: 'Real-time leaderboard showing the top MM3 token miners. Stats include level, token balance, mining blocks, pool membership, disputes, and NFT badges. Who rules the mainframe?',
  alternates: { canonical: '/ranking' },
  openGraph: {
    title: 'Live Rankings — Top MM3 Miners | MathsMine3',
    description: 'Real-time leaderboard: level, MM3 balance, mining blocks, pool disputes, and NFT badges. Who rules the mainframe?',
    url: 'https://mathsmine3.xyz/ranking',
    images: [OG_IMAGE],
  },
  twitter: { card: 'summary_large_image', title: 'Live Rankings | MathsMine3', images: ['/og-image.jpg'] },
};
export default function RankingLayout({ children }) { return children; }
