'use client'

import Image from 'next/image'
import Link from 'next/link'
import NavLinks from '@/components/NavLinks'

export default function Header() {
  return (
    <>
      <header className="w-full flex flex-col items-center py-8 space-y-4">
        <Link href="/" aria-label="Go to homepage">
          <Image
            src="/og-image.jpg"
            alt="MathsMine3 Logo"
            width={160}
            height={160}
            className="rounded-full shadow-2xl hover:scale-105 transition-transform duration-300"
            priority
          />
        </Link>
        <NavLinks className="mt-2" />
      </header>
    </>
  )
}
