'use client';

import TradeBoard from '@/components/TradeBoard';
import SectionFrame from '@/components/SectionFrame';
import DeadGate from '@/components/DeadGate';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function TradeMM3Page() {
  const { account, isVirtualWallet } = useActiveWallet();
  const { frameAccent } = useMm3Accent();

  return (
    <DeadGate>
      <main className="mm3-trade-page w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
        <SectionFrame accent={frameAccent} id="trade-mm3-section">
          <TradeBoard account={account} isVirtualWallet={isVirtualWallet} />
        </SectionFrame>
      </main>
    </DeadGate>
  );
}
