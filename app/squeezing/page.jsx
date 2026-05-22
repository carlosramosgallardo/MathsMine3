'use client';

import DisputesPanel from '@/components/DisputesPanel';
import SectionFrame from '@/components/SectionFrame';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { useI18n } from '@/lib/i18n-context';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function SqueezePage() {
  const { account } = useActiveWallet();
  const { language } = useI18n();
  const { frameAccent } = useMm3Accent();

  const handleWalletClick = (wallet) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('mm3_leaderboard_wallet', wallet.toLowerCase());
    window.location.href = '/ranking';
  };

  const handlePoolClick = (poolCode) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('mm3_leaderboard_pool', String(poolCode || '').toUpperCase());
    window.location.href = '/ranking';
  };

  const handleMarketBlockClick = (blockKey) => {
    if (typeof window === 'undefined' || !blockKey) return;
    window.location.href = `/mining?block=${encodeURIComponent(blockKey)}`;
  };

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <div className="mx-auto w-full max-w-4xl">
        <SectionFrame accent={frameAccent} id="squeeze-section">
          <DisputesPanel
            wallet={account?.toLowerCase() || ''}
            poolCode=""
            language={language}
            onWalletClick={handleWalletClick}
            onPoolClick={handlePoolClick}
            onMarketBlockClick={handleMarketBlockClick}
          />
        </SectionFrame>
      </div>
    </main>
  );
}
