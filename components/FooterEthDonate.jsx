'use client'

import { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { parseEther } from 'viem'
import { useGoogleAuth } from '@/lib/google-auth-context'
import { useI18n } from '@/lib/i18n-context'

function notify(msg, type = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type } }))
  }
}

export default function FooterEthDonate() {
  const [isProcessing, setIsProcessing] = useState(false)
  const { t } = useI18n()
  const { isConnected, address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { googleWallet } = useGoogleAuth()

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
      await walletClient.sendTransaction({
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
    <button
      type="button"
      onClick={onDonate}
      title={donateTitle}
      aria-label={donateTitle}
      className="inline-flex min-h-[28px] min-w-[32px] items-center justify-center px-1 transition-colors duration-150 hover:text-cyan-400 focus:outline-none"
    >
      {isProcessing ? t('wallet.loading') : 'ETH'}
    </button>
  )
}
