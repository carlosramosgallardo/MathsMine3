'use client';

import dynamic from 'next/dynamic';

const HomeMiningWorld3D = dynamic(() => import('@/components/HomeMiningWorld3D'), { ssr: false });

export default function HomeMiningScene() {
  return (
    <div className="mm3-home-arena" aria-hidden="true">
      <HomeMiningWorld3D />
    </div>
  );
}
