'use client';

import TokenChart from '@/components/TokenChart';
import SectionFrame from '@/components/SectionFrame';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function MM3ValuePage() {
  const { frameAccent } = useMm3Accent();

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <div className="mx-auto w-full max-w-6xl">
        <SectionFrame accent={frameAccent} id="value-section">
          <TokenChart />
        </SectionFrame>
      </div>
    </main>
  );
}
