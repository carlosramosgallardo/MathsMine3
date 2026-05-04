'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n-context'

function triggerRouteLoading(href, pathname, label) {
  if (typeof window === 'undefined' || href === pathname) return
  window.dispatchEvent(new CustomEvent('mm3-route-loading', { detail: { href, label } }))
}

export default function NavLinks({ className = '' }) {
  const pathname = usePathname()
  const { t } = useI18n()

  const links = [
    { href: '/',          label: t('nav.play') },
    { href: '/trade-mm3', label: t('nav.trade') },
    { href: '/ranking',   label: t('nav.leaderboard') },
    { href: '/squeeze',   label: t('nav.squeeze') },
    { href: '/market',    label: t('nav.podcast') },
    { href: '/irc',       label: t('nav.irc') },
  ]

  return (
    <div className={`flex w-max items-center justify-center gap-0 mx-auto ${className}`}>
      {links.map(({ href, label }) => {
        const isActive = pathname === href
        if (href === '/market') {
          return (
            <a
              key={href}
              href={href}
              onClick={() => triggerRouteLoading(href, pathname, label)}
              className={`nav-link${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {label}
            </a>
          )
        }

        return (
          <Link
            key={href}
            href={href}
            onClick={() => triggerRouteLoading(href, pathname, label)}
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
