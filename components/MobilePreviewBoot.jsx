'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  applyForcedMobileViewport,
  isMobilePreviewBuild,
  isMobilePreviewDevAllowed,
  isMobilePreviewQuerySearch,
  isMobilePreviewQualityQuerySearch,
  readMobilePreviewSession,
  setMobilePreviewSession,
  setMobilePreviewQualitySession,
  MM3_MOBILE_QUERY,
  MM3_QUALITY_QUERY,
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
    let cleanedUrl = false
    if (isMobilePreviewQuerySearch(search)) {
      setMobilePreviewSession(true)
      cleanedUrl = true
    }
    if (isMobilePreviewQualityQuerySearch(search)) {
      setMobilePreviewQualitySession(true)
      cleanedUrl = true
    }
    if (cleanedUrl && typeof window !== 'undefined' && window.history.replaceState) {
      const params = new URLSearchParams(searchParams?.toString() || '')
      params.delete(MM3_MOBILE_QUERY)
      params.delete(MM3_QUALITY_QUERY)
      const q = params.toString()
      const clean = pathname + (q ? `?${q}` : '') + window.location.hash
      window.history.replaceState(null, '', clean)
    }

    const active = isMobilePreviewBuild() || readMobilePreviewSession()
    syncMobilePreview(active)
    return () => syncMobilePreview(false)
  }, [pathname, searchParams])

  return null
}
