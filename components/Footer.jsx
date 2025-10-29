'use client'

import { useState } from 'react'
import NavLinks from '@/components/NavLinks'
import Image from 'next/image'
import Link from 'next/link'

export default function Footer() {
  const [revealed, setRevealed] = useState(false)

  return (
    <>

      <footer className="text-center text-sm text-gray-400 py-4 space-y-4">

        <Link href="/" aria-label="Go to homepage">
          <div className="flex justify-center mt-4">
            <Image
              src="/og-image.jpg"
              alt="MathsMine3 Logo"
              width={160}
              height={160}
              className="rounded-full shadow-2xl hover:scale-105 transition-transform duration-300"
              priority
            />
          </div>
        </Link>
     
        <div className="flex justify-center gap-4 text-blue-500 underline">
          <a href="https://www.youtube.com/@FreakingAI" target="_blank" rel="noopener noreferrer">YouTube</a>
          <a href="https://www.tiktok.com/@freakingai" target="_blank" rel="noopener noreferrer">TikTok</a>
          <a href="https://www.instagram.com/freakingai" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="https://x.com/freakingai" target="_blank" rel="noopener noreferrer">X</a>
          <a href="https://github.com/carlosramosgallardo/MathsMine3" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        <div>
          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="underline text-blue-400 focus:outline-none"
              aria-label="Reveal email"
            >
              Contact {/* Texto a externalizar */}
            </button>
          ) : (
            <a href="mailto:botsandpods@gmail.com" className="underline text-blue-400">
              botsandpods@gmail.com
            </a>
          )}
        </div>
      </footer>
    </>
  )
}
