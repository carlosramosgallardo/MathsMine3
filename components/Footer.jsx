'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount, useWalletClient } from 'wagmi'
import { BrowserProvider, parseEther } from 'ethers'
import { useGoogleAuth } from '@/lib/google-auth-context'
import { useI18n } from '@/lib/i18n-context'

function notify(msg, type = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type } }))
  }
}

const SUPPORT_LINKS = [
  { key: 'eth', label: 'ETH', href: null },
  { key: 'coffee', label: 'BMC', href: 'https://buymeacoffee.com/freakingai' },
  { key: 'patreon', label: 'PAT', href: 'https://patreon.com/FreakingAI' },
]

export default function Footer() {
  const pathname = usePathname()
  const [revealed, setRevealed] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const { t } = useI18n()
  const { isConnected, address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { googleWallet } = useGoogleAuth()

  const socials = [
    { label: 'YT', href: 'https://www.youtube.com/@FreakingAI' },
    { label: 'TT', href: 'https://www.tiktok.com/@freakingai' },
    { label: 'IG', href: 'https://www.instagram.com/freakingai' },
    { label: 'X', href: 'https://x.com/freakingai' },
    { label: 'GH', href: 'https://github.com/carlosramosgallardo/MathsMine3' },
  ]

  const donateAmount = Number(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE || '0.00001').toFixed(6)
  const donateTitle = isConnected
    ? t('wallet.donationTitle').replace('{amount}', donateAmount)
    : googleWallet
      ? t('wallet.donationNeedsRealWallet')
      : t('wallet.connectDonationTitle').replace('{amount}', donateAmount)

  const onDonate = async (event) => {
    event.preventDefault()
    if (!isConnected || !walletClient?.transport?.request) {
      notify(isConnected ? t('wallet.donationUnsupported') : t('wallet.connectBeforeDonation'), 'error')
      return
    }
    try {
      setIsProcessing(true)
      const provider = new BrowserProvider(walletClient)
      const signer = await provider.getSigner()
      await signer.sendTransaction({
        to: process.env.NEXT_PUBLIC_ADMIN_WALLET,
        value: parseEther(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE),
      })
      const res = await fetch('/api/donate-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address?.toLowerCase() }),
      })
      if (!res.ok || !(await res.json().catch(() => ({}))).ok) {
        notify(t('wallet.donationLogFailed'), 'error')
        return
      }
      notify(t('wallet.donationThanks'), 'success')
    } catch {
      notify(t('wallet.donationFailed'), 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <footer className={`fixed bottom-0 left-0 right-0 z-40 h-[32px] overflow-x-auto whitespace-nowrap border-t border-cyan-900/20 bg-black/97 px-3 text-[0.75rem] font-mono text-gray-600 backdrop-blur-sm no-scrollbar ${pathname === '/trade-mm3' ? 'mm3-trade-footer' : ''}`}>
      <div className="mx-auto flex h-full min-w-max items-center justify-center gap-3">
        {socials.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-150 hover:text-cyan-400"
          >
            {label}
          </a>
        ))}
        <span className="select-none text-gray-800">|</span>
        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="transition-colors duration-150 hover:text-cyan-400 focus:outline-none"
            aria-label="Show contact email"
          >
            {t('manifesto.contact')}
          </button>
        ) : (
          <a
            href="mailto:botsandpods@gmail.com"
            className="transition-colors duration-150 hover:text-cyan-400"
          >
            botsandpods@gmail.com
          </a>
        )}
        <span className="select-none text-gray-800">|</span>
        <span>{t('wallet.donate')}:</span>
        {SUPPORT_LINKS.map((item) =>
          item.key === 'eth' ? (
            <button
              key={item.key}
              type="button"
              onClick={onDonate}
              title={donateTitle}
              aria-label={donateTitle}
              className="transition-colors duration-150 hover:text-cyan-400 focus:outline-none"
            >
              {isProcessing ? t('wallet.loading') : item.label}
            </button>
          ) : (
            <a
              key={item.key}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              title={t(`wallet.${item.key}Title`)}
              aria-label={t(`wallet.${item.key}Title`)}
              className="transition-colors duration-150 hover:text-cyan-400"
            >
              {item.label}
            </a>
          )
        )}
        <span className="select-none text-gray-800">|</span>
        <Link href="/privacy" className="transition-colors duration-150 hover:text-cyan-400">Privacy</Link>
        <Link href="/terms" className="transition-colors duration-150 hover:text-cyan-400">Terms</Link>
        <span className="select-none text-gray-800">|</span>
        <span className="text-gray-700 select-none">&copy; 2026 FreakingAI</span>
      </div>
    </footer>
  )
}
