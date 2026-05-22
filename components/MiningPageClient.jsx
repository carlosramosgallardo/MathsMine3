'use client';

import MiningBoard from '@/components/MiningBoard';
import SectionFrame from '@/components/SectionFrame';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function MiningPageClient() {
  const { account, isVirtualWallet } = useActiveWallet();
  const { frameAccent } = useMm3Accent();

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="mining-section">
        <MiningBoard account={account} isVirtualWallet={isVirtualWallet} />
      </SectionFrame>
    </main>
  );
}
