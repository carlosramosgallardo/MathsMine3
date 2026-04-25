'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n-context'
import supabase from '@/lib/supabaseClient'

function triggerRouteLoading(href, pathname, label) {
  if (typeof window === 'undefined' || href === pathname) return
  window.dispatchEvent(new CustomEvent('mm3-route-loading', { detail: { href, label } }))
}

function formatNavMm3(value) {
  const safe = Number(value) || 0
  return safe.toFixed(8)
}

export default function NavLinks({ className = '' }) {
  const pathname = usePathname()
  const { t } = useI18n()
  const [mm3Value, setMm3Value] = useState(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('token_value')
          .select('total_eth')
          .limit(1)
          .maybeSingle()
        if (error) throw error
        if (mounted) setMm3Value(Number(data?.total_eth) || 0)
      } catch {}
    }

    load()
    const timer = setInterval(load, 15000)
    window.addEventListener('focus', load)
    window.addEventListener('mm3-db-updated', load)

    const channel = supabase
      .channel('mm3-nav-total-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_sell_transactions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_market_events' }, load)
      .subscribe()

    return () => {
      mounted = false
      clearInterval(timer)
      window.removeEventListener('focus', load)
      window.removeEventListener('mm3-db-updated', load)
      supabase.removeChannel(channel)
    }
  }, [])

  const links = [
    { href: '/',          label: t('nav.play') },
    { href: '/trade-mm3', label: t('nav.trade') },
    { href: '/ranking',   label: t('nav.leaderboard') },
    {
      href: '/mm3-value',
      label:
        mm3Value == null ? (
          t('nav.value')
        ) : (
          <span className="inline-flex items-baseline gap-1">
            <span>{formatNavMm3(mm3Value)}</span>
            <span className="text-[0.5rem] uppercase tracking-[0.18em] text-cyan-300/60">MM3</span>
          </span>
        ),
    },
    { href: '/market',    label: t('nav.podcast') },
    { href: '/irc',       label: t('nav.irc') },
    { href: '/manifesto', label: t('nav.manifesto') },
    { href: '/ai-team',   label: t('nav.aiTeam') },
    { href: '/api',       label: 'API' },
  ]

  return (
    <div className={`flex w-max items-center justify-center gap-0 mx-auto ${className}`}>
      {links.map(({ href, label }) => {
        const isActive = pathname === href
        const isValueLink = href === '/mm3-value'
        return (
          <Link
            key={href}
            href={href}
            onClick={() => triggerRouteLoading(href, pathname, isValueLink ? t('nav.value') : label)}
            className={`nav-link${isActive ? ' active' : ''}${isValueLink ? ' nav-link-mm3-total' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
