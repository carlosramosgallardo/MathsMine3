'use client';

import Leaderboard from '@/components/Leaderboard';
import SectionFrame from '@/components/SectionFrame';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function RankingPage() {
  const { frameAccent } = useMm3Accent();

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <div className="mx-auto w-full max-w-6xl">
        <SectionFrame accent={frameAccent} id="ranking-section">
          <Leaderboard itemsPerPage={5} />
        </SectionFrame>
      </div>
    </main>
  );
}
