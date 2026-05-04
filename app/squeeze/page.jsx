'use client';

import DisputesPanel from '@/components/DisputesPanel';
import SectionFrame from '@/components/SectionFrame';
import { useMm3Accent } from '@/lib/use-mm3-accent';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { useI18n } from '@/lib/i18n-context';
import { useRouter } from 'next/navigation';

export default function SqueezePage() {
  const { frameAccent } = useMm3Accent();
  const { activeWallet, activeWalletPool } = useActiveWallet();
  const { language } = useI18n();
  const router = useRouter();

  function goToWallet(wallet) {
    router.push(`/ranking?wallet=${encodeURIComponent(wallet)}`);
  }

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <div className="mx-auto w-full max-w-6xl">
        <SectionFrame accent={frameAccent} id="squeeze-section">
          <DisputesPanel
            wallet={activeWallet}
            poolCode={activeWalletPool}
            language={language}
            onWalletClick={goToWallet}
          />
        </SectionFrame>
      </div>
    </main>
  );
}
