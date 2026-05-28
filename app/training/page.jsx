import HomePageClient from '@/components/HomePageClient';

export const metadata = {
  title: 'Training — Solve Math, Earn MM3',
  description: 'Solve math problems against the clock. 100 problems per day, 13 types. Speed earns more MM3. Connect your wallet or play as guest.',
  alternates: { canonical: '/training' },
  openGraph: {
    title: 'Training — MathsMine3',
    description: 'Solve math problems against the clock and earn MM3 tokens. Free browser game.',
    url: 'https://mathsmine3.xyz/training',
  },
};

export default function TrainingPage() {
  return <HomePageClient />;
}
