'use client';

import SectionFrame from '@/components/SectionFrame';
import RelayingTerminal from '@/components/RelayingTerminal';
import DeadGate from '@/components/DeadGate';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function RelayingPage() {
  const { frameAccent } = useMm3Accent();

  return (
    <DeadGate>
      <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
        <SectionFrame accent={frameAccent} id="relaying-section">
          <RelayingTerminal accent={frameAccent} />
        </SectionFrame>
      </main>
    </DeadGate>
  );
}
