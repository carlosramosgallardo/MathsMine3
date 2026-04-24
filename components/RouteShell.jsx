'use client';

import { usePathname } from 'next/navigation';

export default function RouteShell({ children }) {
  const pathname = usePathname() || '';
  const isTradeRoute = pathname === '/trade-mm3';

  return (
    <div className={isTradeRoute ? 'mm3-portal-shell mm3-trade-route min-h-full' : 'mm3-portal-shell min-h-full'}>
      {children}
    </div>
  );
}
