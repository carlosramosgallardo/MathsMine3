'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavLinks({ className = '' }) {
  const pathname = usePathname()
  const linkClass = (href) => `underline hover:text-white ${pathname === href ? 'text-white font-semibold' : ''}`
  const ariaCurrent = (href) => (pathname === href ? 'page' : undefined)

  return (
    <div className={`flex flex-wrap justify-center text-base text-gray-400 space-x-3 ${className}`}>
      <Link href="/" className={linkClass('/')} aria-current={ariaCurrent('/')}>MM3</Link>
      <Link href="/pov" className={linkClass('/pov')} aria-current={ariaCurrent('/pov')}>PoV</Link>
      <Link href="/poa" className={linkClass('/poa')} aria-current={ariaCurrent('/poa')}>PoA</Link>
      <Link href="/api" className={linkClass('/api')} aria-current={ariaCurrent('/api')}>API</Link>
      <Link href="/manifesto" className={linkClass('/manifesto')} aria-current={ariaCurrent('/manifesto')}>Manifesto</Link>
      <Link href="/ai-team" className={linkClass('/ai-team')} aria-current={ariaCurrent('/ai-team')}>AI Team</Link>
    </div>
  )
}
