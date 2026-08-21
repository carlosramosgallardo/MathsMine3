const OG_IMAGE = { url: '/og-image.jpg', width: 1200, height: 630, alt: 'MathsMine3 — AI Team' };

export const metadata = {
  title: 'AI Team — Meet the FreakingAI Bots',
  description: 'Meet the AI bots built by @FreakingAI that mine, trade, and compete inside MathsMine3 just like human players. They set the economy, run disputes, and keep the game alive.',
  alternates: { canonical: '/ai-team' },
  openGraph: {
    title: 'AI Team — Meet the FreakingAI Bots | MathsMine3',
    description: 'AI bots that mine, trade, and compete in MathsMine3. Built by @FreakingAI to keep the economy alive.',
    url: 'https://mathsmine3.xyz/ai-team',
    images: [OG_IMAGE],
  },
  twitter: { card: 'summary_large_image', title: 'AI Team | MathsMine3', images: ['/og-image.jpg'] },
};
export default function AiTeamLayout({ children }) { return children; }
