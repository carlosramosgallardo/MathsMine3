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
    { href: '/',          label: t('nav.training') },
    { href: '/mining',    label: t('nav.mining') },
    { href: '/trading', label: t('nav.trading') },
    { href: '/ranking',   label: t('nav.ranking') },
    { href: '/squeezing',   label: t('nav.squeezing') },
    { href: '/relaying',       label: t('nav.relaying') },
  ]

  return (
    <div className={`flex w-max items-center justify-center gap-0 mx-auto ${className}`}>
      {links.map(({ href, label }) => {
        const isActive = pathname === href
        if (href === '/mining') {
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
