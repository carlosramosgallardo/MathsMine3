'use client';

import dynamic from 'next/dynamic';

// ssr: false must live in a client component — layout.jsx is a server component.
const ConnectAndPlay = dynamic(() => import('@/components/ConnectAndPlay'), { ssr: false });

export default function Web3ModalInit() {
  return <ConnectAndPlay />;
}
