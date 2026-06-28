'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CookieBanner from '@/components/CookieBanner'
import GlobalRouteLoading from '@/components/GlobalRouteLoading'
import NotificationChips from '@/components/NotificationChips'

export default function PortalShell({ children }) {
  const pathname = usePathname() || ''
  const isBareDev = pathname.startsWith('/dev/')

  if (isBareDev) {
    return (
      <>
        <GlobalRouteLoading />
        <main className="mm3-shell-main h-screen overflow-hidden p-0">{children}</main>
      </>
    )
  }

  return (
    <>
      <Header />
      <GlobalRouteLoading />
      <main className="mm3-shell-main pt-[104px] max-sm:portrait:pt-[196px] sm:pt-[118px] lg:pt-[140px] pb-[64px] max-sm:pb-[80px] h-screen overflow-y-auto">
        <NotificationChips />
        {children}
      </main>
      <Footer />
      <CookieBanner />
    </>
  )
}
