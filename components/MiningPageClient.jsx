'use client';

import dynamic from 'next/dynamic';

const MiningChain3D = dynamic(() => import('@/components/MiningChain3D'), { ssr: false });

export default function MiningPageClient() {
  return <MiningChain3D />;
}
