'use client';

import dynamic from 'next/dynamic';
import PageLoading from '@/components/PageLoading';
import SectionFrame from '@/components/SectionFrame';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { useMm3Accent } from '@/lib/use-mm3-accent';

const MarketBoard = dynamic(() => import('@/components/MarketBoard'), {
  ssr: false,
  loading: () => <PageLoading label="market" />,
});

export default function MarketPageClient() {
  const { account, isVirtualWallet } = useActiveWallet();
  const { frameAccent } = useMm3Accent();

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="market-section">
        <MarketBoard account={account} isVirtualWallet={isVirtualWallet} />
      </SectionFrame>
    </main>
  );
}
