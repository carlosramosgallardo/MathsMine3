'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createWeb3Modal, useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount, useWalletClient, useDisconnect } from 'wagmi'
import { parseEther } from 'viem'
import { useI18n } from '@/lib/i18n-context'
import { wagmiConfig } from '@/lib/wagmi-core'

/* ================== Setup ================== */
const chains = [wagmiConfig.chains[0]]
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

let _web3ModalReady = false
if (!_web3ModalReady) {
  createWeb3Modal({
    wagmiConfig,
    projectId,
    chains,
  enableAnalytics: false,
  disableTelemetry: true,
  enableOnramp: false,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#22d3ee',
    '--w3m-accent-fill': '#0b0f19',
    '--w3m-background': '#0b0f1a',
    '--w3m-surface': '#050810',
    '--w3m-font-family': 'Consolas, monospace',
    '--w3m-border-radius-master': '12px',
    '--w3m-button-border-radius': '8px',
    '--w3m-text': '#e2e8f0',
    '--w3m-secondary-button-bg-color': '#1e293b'
  },
  allWallets: 'SHOW'
  })
  _web3ModalReady = true
}

export function useShortAddress(addr) {
  return useMemo(() => (!addr ? '' : addr.slice(0, 6) + '...' + addr.slice(-4)), [addr])
}

/* ================== Helpers ================== */
const DEFAULT_ACCENT = '#22d3ee'

const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  const bigint = parseInt(h, 16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}

function useIsCoarsePointer() {
  const [isCoarse, setIsCoarse] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setIsCoarse(!!mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])
  return isCoarse
}

/* ================== Retro Button Base ================== */
function RetroButtonBase({
  children,
  title,
  ariaLabel,
  disabled,
  onClick,
  className = '',
  accent = DEFAULT_ACCENT,
  mobileTooltip,
  mobileTooltipMs = 2500,
  longPressMs = 500
}) {
  const { r, g, b } = hexToRgb(accent)
  const accentSoft = `rgba(${r}, ${g}, ${b}, 0.35)`
  const accentBorder = `rgba(${r}, ${g}, ${b}, 0.75)`
  const accentBorderDisabled = `rgba(${r}, ${g}, ${b}, 0.35)`
  const innerGlow = `inset 0 0 6px rgba(${r}, ${g}, ${b}, 0.45)`
  const isCoarse = useIsCoarsePointer()

  const [showTip, setShowTip] = useState(false)
  const longPressTimer = useRef(null)
  const hideTimer = useRef(null)
  const longPressTriggered = useRef(false)

  const clearTimers = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
  }

  const startLongPress = () => {
    if (!isCoarse || !mobileTooltip) return
    clearTimers()
    longPressTriggered.current = false
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      setShowTip(true)
      hideTimer.current = setTimeout(() => setShowTip(false), mobileTooltipMs)
    }, longPressMs)
  }

  const endLongPress = () => {
    if (!isCoarse || !mobileTooltip) return
    clearTimeout(longPressTimer.current)
  }

  useEffect(() => () => clearTimers(), [])

  const handleClick = (e) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      e.preventDefault()
      e.stopPropagation()
      return
    }
    onClick?.(e)
  }

  return (
    <div
      className="relative inline-block"
      onTouchStart={startLongPress}
      onTouchEnd={endLongPress}
      onTouchCancel={endLongPress}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel || title}
        className={`relative inline-flex items-center px-4 sm:px-5 py-2 rounded-2xl font-mono text-sm
                    border bg-black/70 transition-all duration-200
                    ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:bg-black/80 active:scale-[0.99]'}
                    ${className}`}
        style={{
          backdropFilter: 'blur(2px)',
          borderColor: disabled ? accentBorderDisabled : accentBorder,
          color: accent,
          boxShadow: disabled ? 'none' : `0 0 22px ${accentSoft}`
        }}
        aria-disabled={disabled ? 'true' : 'false'}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl opacity-10"
          style={{ backgroundImage: `repeating-linear-gradient(180deg, ${accent} 0, ${accent} 1px, transparent 2px, transparent 4px)` }}
        />
        <span aria-hidden="true" className="absolute inset-0 rounded-2xl" style={{ boxShadow: innerGlow }} />
        <span className="relative z-10 font-semibold tracking-wide whitespace-nowrap">{children}</span>
      </button>

      {isCoarse && mobileTooltip && showTip && (
        <div
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 mt-2 max-w-[88vw] z-50 rounded-md border px-3 py-2 text-xs font-mono shadow-lg"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', borderColor: accentBorder, color: accent }}
        >
          {mobileTooltip}
        </div>
      )}
    </div>
  )
}

/* ================== Connect / Disconnect ================== */
function RetroConnectButton() {
  const { isConnected } = useAccount()
  const { open } = useWeb3Modal()
  const { disconnect } = useDisconnect()
  const handleClick = () => (isConnected ? disconnect() : open?.({ view: 'Connect' }))

  const title = isConnected
    ? 'Disconnect your wallet safely.'
    : 'Create a free wallet on MetaMask or Ronin and play for free. Learn crypto and bring MathsMine3 to life!'

  return (
    <RetroButtonBase onClick={handleClick} title={title} ariaLabel={title} mobileTooltip={title}>
      {isConnected ? 'Disconnect' : 'Connect'}
    </RetroButtonBase>
  )
}

/* ================== Donate button ================== */
function RetroDonateButton({ disabled, onClick, isConnected, isProcessing }) {
  const { t } = useI18n()
  const amountDisplay = Number(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE || '0.00001').toFixed(6)
  const tooltip = isConnected
    ? t('wallet.donationTitle').replace('{amount}', amountDisplay)
    : t('wallet.connectDonationTitle').replace('{amount}', amountDisplay)

  return (
    <RetroButtonBase
      onClick={onClick}
      disabled={disabled || !isConnected}
      title={tooltip}
      ariaLabel={tooltip}
      mobileTooltip={tooltip}
    >
      {isProcessing ? t('wallet.donationProcessing') : t('wallet.donate')}
    </RetroButtonBase>
  )
}

/* ================== Wallet Actions (full, legacy export) ================== */
export function WalletActions({ afterToast }) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { t } = useI18n()
  const [isProcessing, setIsProcessing] = useState(false)
  const notify = (msg, type = 'info') => {
    if (typeof afterToast === 'function') afterToast(msg, type)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type } }))
    }
  }

  const logSuccess = async () => {
    try {
      const res = await fetch('/api/donate-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address?.toLowerCase() })
      })
      if (!res.ok) return false
      const json = await res.json().catch(() => ({}))
      return !!json?.ok
    } catch (e) {
      console.error('donate-log error:', e)
      return false
    }
  }

  const onDonateClick = async (e) => {
    e.preventDefault()
    if (!isConnected || !address) { notify(t('wallet.connectBeforeDonation'), 'error'); return }
    if (!walletClient?.transport?.request) { notify(t('wallet.donationSymbolicUnsupported'), 'error'); return }
    try {
      setIsProcessing(true)
      await walletClient.sendTransaction({
        to: process.env.NEXT_PUBLIC_ADMIN_WALLET,
        value: parseEther(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE)
      })
      const ok = await logSuccess()
      if (!ok) { notify(t('wallet.donationLogFailedContact'), 'error'); return }
      notify(t('wallet.donationThanks'), 'success')
    } catch (err) {
      console.error('Donation failed:', err)
      notify(t('wallet.donationFailed'), 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <RetroConnectButton />
      <RetroDonateButton
        onClick={onDonateClick}
        isConnected={isConnected}
        isProcessing={isProcessing}
      />
    </div>
  )
}

/* ================== Compact Wallet Bar (topbar) ================== */
export function CompactWalletBar() {
  const { address, isConnected } = useAccount()
  const { open } = useWeb3Modal()
  const { disconnect } = useDisconnect()
  const { data: walletClient } = useWalletClient()
  const { t } = useI18n()
  const shortAddr = useShortAddress(address)
  const [isProcessing, setIsProcessing] = useState(false)
  const notify = (msg, type = 'info') => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type } }))
    }
  }

  const logSuccess = async () => {
    try {
      const res = await fetch('/api/donate-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address?.toLowerCase() })
      })
      if (!res.ok) return false
      return !!(await res.json().catch(() => ({}))).ok
    } catch { return false }
  }

  const onDonate = async (e) => {
    e.preventDefault()
    if (!isConnected || !address) { notify(t('wallet.connectBeforeDonation'), 'error'); return }
    if (!walletClient?.transport?.request) { notify(t('wallet.donationUnsupported'), 'error'); return }
    try {
      setIsProcessing(true)
      await walletClient.sendTransaction({
        to: process.env.NEXT_PUBLIC_ADMIN_WALLET,
        value: parseEther(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE)
      })
      const ok = await logSuccess()
      if (!ok) { notify(t('wallet.donationLogFailed'), 'error'); return }
      notify(t('wallet.donationThanks'), 'success')
    } catch {
      notify(t('wallet.donationFailed'), 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const btnBase = `px-2 py-1 rounded text-[0.90rem] font-mono font-semibold border transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500 whitespace-nowrap`
  const btnCyan = `border-cyan-500/50 text-cyan-400 bg-black hover:border-cyan-400 hover:bg-cyan-950/40 hover:shadow-[0_0_8px_rgba(34,211,238,0.3)]`
  const btnDisabled = `border-cyan-900/40 text-cyan-900 bg-black cursor-not-allowed`

  const donateTitle = isConnected
    ? t('wallet.donationTitle').replace('{amount}', Number(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE || '0.00001').toFixed(6))
    : t('wallet.connectDonationTitle').replace('{amount}', Number(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE || '0.00001').toFixed(6))

  return (
    <div className="flex items-center gap-1.5">
      {isConnected && (
        <span
          className="hidden lg:inline text-[0.75rem] font-mono text-cyan-500/55 tracking-wide select-none"
          title={address}
        >
          {shortAddr}
        </span>
      )}
      <button
        onClick={isConnected ? () => disconnect() : () => open?.({ view: 'Connect' })}
        title={isConnected ? t('wallet.disconnect') : t('wallet.connect')}
        aria-label={isConnected ? t('wallet.disconnect') : t('wallet.connect')}
        className={`${btnBase} ${btnCyan}`}
      >
        {isConnected ? t('wallet.disconnect') : t('wallet.connect')}
      </button>
      <button
        onClick={onDonate}
        disabled={!isConnected || isProcessing}
        title={donateTitle}
        aria-label={donateTitle}
        className={`${btnBase} ${!isConnected || isProcessing ? btnDisabled : btnCyan}`}
      >
        {isProcessing ? t('wallet.loading') : t('wallet.donate')}
      </button>
    </div>
  )
}

/* ================== Web3Modal initializer (dynamically imported) ================== */
export default function ConnectAndPlayProvider() {
  // web3modal is initialized at module scope above; this component
  // exists only so layout.jsx can dynamically import this module.
  return null
}
