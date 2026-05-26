const OG_IMAGE = { url: '/og-image.jpg', width: 1200, height: 630, alt: 'MathsMine3 — Pool Squeezing' };

export const metadata = {
  title: 'Squeezing — Pool Disputes',
  description: 'Challenge rival mining pools and squeeze their MM3 tokens. Propose disputes, vote with your pool, and fight for dominance on the leaderboard. The winning pool takes the spoils.',
  alternates: { canonical: '/squeezing' },
  openGraph: {
    title: 'Squeezing — Pool Disputes | MathsMine3',
    description: 'Challenge rival mining pools, vote on disputes, and squeeze their MM3. The winning pool takes the spoils.',
    url: 'https://mathsmine3.xyz/squeezing',
    images: [OG_IMAGE],
  },
  twitter: { card: 'summary_large_image', title: 'Squeezing — Pool Disputes | MathsMine3', images: ['/og-image.jpg'] },
};
export default function SqueezingLayout({ children }) { return children; }
