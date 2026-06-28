import { Suspense } from 'react'
import DevMobileFramePage from './DevMobileFrameClient'

export const metadata = {
  title: 'Mobile preview (dev)',
  robots: { index: false, follow: false },
}

export default function MobileFramePage() {
  return (
    <Suspense fallback={null}>
      <DevMobileFramePage />
    </Suspense>
  )
}
