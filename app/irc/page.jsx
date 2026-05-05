'use client';

import SectionFrame from '@/components/SectionFrame';
import IrcTerminal from '@/components/IrcTerminal';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function IrcPage() {
  const { frameAccent } = useMm3Accent();

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="irc-section">
        <IrcTerminal accent={frameAccent} />
      </SectionFrame>
    </main>
  );
}
