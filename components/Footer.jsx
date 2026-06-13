'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useI18n } from '@/lib/i18n-context'

const FooterEthDonate = dynamic(() => import('@/components/FooterEthDonate'), { ssr: false })

const SUPPORT_LINKS = [
  { key: 'eth', label: 'ETH', href: null },
  { key: 'coffee', label: 'BMC', href: 'https://buymeacoffee.com/freakingai' },
  { key: 'patreon', label: 'PAT', href: 'https://patreon.com/FreakingAI' },
]

export default function Footer() {
  const pathname = usePathname()
  const [revealed, setRevealed] = useState(false)
  const [loadEthDonate, setLoadEthDonate] = useState(false)
  const { t, language } = useI18n()
  const es = language === 'es'

  const socials = [
    { label: 'YT', href: 'https://www.youtube.com/@FreakingAI' },
    { label: 'TT', href: 'https://www.tiktok.com/@freakingai' },
    { label: 'IG', href: 'https://www.instagram.com/freakingai' },
    { label: 'X', href: 'https://x.com/freakingai' },
    { label: 'GH', href: 'https://github.com/carlosramosgallardo/MathsMine3' },
  ]

  useEffect(() => {
    const timer = window.setTimeout(() => setLoadEthDonate(true), 15000)
    return () => window.clearTimeout(timer)
  }, [])

  const touchClass = 'inline-flex min-h-[28px] min-w-[32px] items-center justify-center px-1 transition-colors duration-150 hover:text-cyan-400'

  return (
    <footer className={`fixed bottom-0 left-0 right-0 z-40 h-[32px] overflow-x-auto whitespace-nowrap border-t border-cyan-900/20 bg-black/97 px-3 text-[0.75rem] font-mono text-gray-600 backdrop-blur-sm no-scrollbar ${pathname === '/trading' ? 'mm3-trade-footer' : ''}`}>
      <div className="mx-auto flex h-full min-w-max items-center justify-center gap-3">
        {socials.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={touchClass}
          >
            {label}
          </a>
        ))}
        <span className="select-none text-gray-800">|</span>
        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className={`${touchClass} focus:outline-none`}
            aria-label="Show contact email"
          >
            {t('manifesto.contact')}
          </button>
        ) : (
          <a
            href="mailto:botsandpods@gmail.com"
            className={touchClass}
          >
            botsandpods@gmail.com
          </a>
        )}
        <span className="select-none text-gray-800">|</span>
        <span>{t('wallet.donate')}:</span>
        {SUPPORT_LINKS.map((item) =>
          item.key === 'eth' ? (
            loadEthDonate ? (
              <FooterEthDonate key={item.key} />
            ) : (
              <button
                key={item.key}
                type="button"
                onClick={() => setLoadEthDonate(true)}
                onPointerEnter={() => setLoadEthDonate(true)}
                onTouchStart={() => setLoadEthDonate(true)}
                className={`${touchClass} focus:outline-none`}
                aria-label={t('wallet.donate')}
              >
                {item.label}
              </button>
            )
          ) : (
            <a
              key={item.key}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              title={t(`wallet.${item.key}Title`)}
              aria-label={t(`wallet.${item.key}Title`)}
              className={touchClass}
            >
              {item.label}
            </a>
          )
        )}
        <span className="select-none text-gray-800">|</span>
        <Link href="/api" className={touchClass}>API</Link>
        <Link href="/security" className={touchClass} title={es ? 'Seguridad' : 'Security'}>SEC</Link>
        <Link href="/privacy" className={touchClass}>{es ? 'Privacidad' : 'Privacy'}</Link>
        <Link href="/terms" className={touchClass}>{es ? 'Términos' : 'Terms'}</Link>
        <span className="select-none text-gray-800">|</span>
        <span className="text-gray-700 select-none">&copy; 2026 FreakingAI</span>
      </div>
    </footer>
  )
}
