'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  applyForcedMobileViewport,
  isMobilePreviewBuild,
  isMobilePreviewDevAllowed,
  isMobilePreviewQuerySearch,
  readMobilePreviewSession,
  setMobilePreviewSession,
  MM3_MOBILE_QUERY,
} from '@/lib/mobile-preview'

function syncMobilePreview(active) {
  const root = document.documentElement
  if (active) root.classList.add('mm3-mobile-preview')
  else root.classList.remove('mm3-mobile-preview')
  applyForcedMobileViewport(active)
}

export default function MobilePreviewBoot() {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isMobilePreviewDevAllowed() && !isMobilePreviewBuild()) return undefined

    if (pathname.startsWith('/dev/')) {
      syncMobilePreview(false)
      return undefined
    }

    const search = searchParams?.toString() ? `?${searchParams.toString()}` : ''
    if (isMobilePreviewQuerySearch(search)) {
      setMobilePreviewSession(true)
      if (typeof window !== 'undefined' && window.history.replaceState) {
        const params = new URLSearchParams(searchParams?.toString() || '')
        params.delete(MM3_MOBILE_QUERY)
        const q = params.toString()
        const clean = pathname + (q ? `?${q}` : '') + window.location.hash
        window.history.replaceState(null, '', clean)
      }
    }

    const active = isMobilePreviewBuild() || readMobilePreviewSession()
    syncMobilePreview(active)
    return () => syncMobilePreview(false)
  }, [pathname, searchParams])

  return null
}
