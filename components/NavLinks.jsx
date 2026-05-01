'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n-context'

let marketPreloadPromise = null
let marketSnapshotPreloadPromise = null

function preloadMarketResources({ includeSnapshot = false, router = null } = {}) {
  if (typeof window === 'undefined') return

  router?.prefetch?.('/market')

  if (!marketPreloadPromise) {
    marketPreloadPromise = import('@/components/MarketBoard').catch((error) => {
      marketPreloadPromise = null
      console.debug?.('market preload failed', error)
    })
  }

  if (includeSnapshot && !marketSnapshotPreloadPromise) {
    marketSnapshotPreloadPromise = fetch('/api/market-snapshot?blockKey=mm3-023&details=1').catch((error) => {
      marketSnapshotPreloadPromise = null
      console.debug?.('market snapshot preload failed', error)
    })
  }
}

function triggerRouteLoading(href, pathname, label) {
  if (typeof window === 'undefined' || href === pathname) return
  window.dispatchEvent(new CustomEvent('mm3-route-loading', { detail: { href, label } }))
}

export default function NavLinks({ className = '' }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useI18n()

  useEffect(() => {
    if (pathname === '/market' || typeof window === 'undefined') return undefined

    const preload = () => preloadMarketResources({ includeSnapshot: true, router })
    const quickTimer = window.setTimeout(preload, 450)
    const scheduleIdle = window.requestIdleCallback
      ? (cb) => window.requestIdleCallback(cb, { timeout: 3000 })
      : (cb) => window.setTimeout(cb, 1200)
    const cancelIdle = window.cancelIdleCallback
      ? (id) => window.cancelIdleCallback(id)
      : (id) => window.clearTimeout(id)
    const idleId = scheduleIdle(preload, { timeout: 3000 })

    return () => {
      window.clearTimeout(quickTimer)
      cancelIdle(idleId)
    }
  }, [pathname, router])

  const links = [
    { href: '/',          label: t('nav.play') },
    { href: '/trade-mm3', label: t('nav.trade') },
    { href: '/ranking',   label: t('nav.leaderboard') },
    { href: '/market',    label: t('nav.podcast') },
    { href: '/irc',       label: t('nav.irc') },
  ]

  return (
    <div className={`flex w-max items-center justify-center gap-0 mx-auto ${className}`}>
      {links.map(({ href, label }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            prefetch={href === '/market' ? true : undefined}
            onMouseEnter={href === '/market' ? () => preloadMarketResources({ includeSnapshot: true, router }) : undefined}
            onFocus={href === '/market' ? () => preloadMarketResources({ includeSnapshot: true, router }) : undefined}
            onTouchStart={href === '/market' ? () => preloadMarketResources({ includeSnapshot: true, router }) : undefined}
            onClick={() => {
              if (href === '/market') preloadMarketResources({ includeSnapshot: true, router })
              triggerRouteLoading(href, pathname, label)
            }}
            className={`nav-link${isActive ? ' active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
