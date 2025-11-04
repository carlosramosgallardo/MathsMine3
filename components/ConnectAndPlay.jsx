'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createWeb3Modal, useWeb3Modal } from '@web3modal/wagmi/react'
import { WagmiConfig, createConfig, useAccount, useWalletClient, useDisconnect, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { BrowserProvider, parseEther } from 'ethers'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/* ================== Setup ================== */
const queryClient = new QueryClient()
const chains = [mainnet]
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

const wagmiConfig = createConfig({
  chains,
  transports: { [mainnet.id]: http() }
})

createWeb3Modal({
  wagmiConfig,
  projectId,
  chains,
  enableAnalytics: false,
  disableTelemetry: true,
  enableOnramp: false,
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#06b6d4',
    '--w3m-accent-fill': '#FFFFFF',
    '--w3m-background': '#0b0f1a',
    '--w3m-font-family':
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"',
    '--w3m-border-radius-master': '999px',
    '--w3m-button-border-radius': '999px'
  }
})

export function useShortAddress(addr) {
  return useMemo(() => (!addr ? '' : addr.slice(0, 6) + '...' + addr.slice(-4)), [addr])
}

/* ================== Helpers ================== */
const DEFAULT_ACCENT = '#22d3ee' // azul base MM3

const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  const bigint = parseInt(h, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return { r, g, b }
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

/* ================== Retro Button Base (con tooltip móvil) ================== */
function RetroButtonBase({
  children,
  title,
  ariaLabel,
  disabled,
  onClick,
  className = '',
  accent = DEFAULT_ACCENT,
  mobileTooltip,            // string opcional; si existe, se muestra con long-press en móviles
  mobileTooltipMs = 2500,   // duración visible del tooltip móvil
  longPressMs = 500         // tiempo para activar long-press
}) {
  const { r, g, b } = hexToRgb(accent)
  const accentSoft = `rgba(${r}, ${g}, ${b}, 0.35)`
  const accentBorder = `rgba(${r}, ${g}, ${b}, 0.75)`
  const accentBorderDisabled = `rgba(${r}, ${g}, ${b}, 0.35)`
  const scanlineHex = accent
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
    if (!isCoarse || !mobileTooltip || disabled) return
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
    // Si venimos de un long-press, no ejecutamos el click
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      e.preventDefault()
      e.stopPropagation()
      return
    }
    onClick?.(e)
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        onTouchStart={startLongPress}
        onTouchEnd={endLongPress}
        onTouchCancel={endLongPress}
        disabled={disabled}
        title={title}               // tooltip nativo en desktop
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
        {/* Scanlines */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(180deg, ${scanlineHex} 0, ${scanlineHex} 1px, transparent 2px, transparent 4px)`
          }}
        />
        {/* Inner glow */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl"
          style={{ boxShadow: innerGlow }}
        />
        <span className="relative z-10 font-semibold tracking-wide whitespace-nowrap">
          {children}
        </span>
      </button>

      {/* Tooltip móvil (solo si pointer: coarse) */}
      {isCoarse && mobileTooltip && showTip && (
        <div
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 mt-2 max-w-[88vw] z-50
                     rounded-md border px-3 py-2 text-xs font-mono
                     shadow-lg"
          style={{
            backgroundColor: 'rgba(0,0,0,0.85)',
            borderColor: accentBorder,
            color: accent
          }}
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
  const handleClick = () => (isConnected ? disconnect() : open({ view: 'Connect' }))

  const title = isConnected
    ? 'Disconnect your wallet safely.'
    : 'Create a free wallet on MetaMask or Ronin and play for free without buying any tokens. This way, you can play, learn how to use a crypto wallet, and bring MathsMine3 to life!'

  return (
    <RetroButtonBase
      onClick={handleClick}
      title={title}
      ariaLabel={title}
      accent={DEFAULT_ACCENT}
      mobileTooltip={title}
    >
      {isConnected ? 'Disconnect' : 'Connect'}
    </RetroButtonBase>
  )
}

/* ================== Donate (solo botón) ================== */
function RetroDonateButton({ total, disabled, onClick, isConnected, isProcessing }) {
  const amountDisplay = Number(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE || '0.00001').toFixed(6)
  const totalDisplay = Number(total || 0).toFixed(6)

  const ttConnected =
    `Real on-chain donation of ${amountDisplay} ETH to power MM3 into reality. Total Donations = ${totalDisplay} ETH.`
  const ttDisconnected =
    `Connect wallet to donate ${amountDisplay} ETH. Total Donations = ${totalDisplay} ETH.`

  const tooltip = isConnected ? ttConnected : ttDisconnected

  return (
    <RetroButtonBase
      onClick={onClick}
      disabled={disabled || !isConnected}
      title={tooltip}            // desktop hover
      ariaLabel={tooltip}        // lectores de pantalla
      accent={DEFAULT_ACCENT}
      mobileTooltip={tooltip}    // tooltip por long-press en móvil
    >
      {isProcessing ? 'Processing…' : 'Donate'}
    </RetroButtonBase>
  )
}

/* ================== Wallet Actions (dos botones visibles) ================== */
export function WalletActions({ afterToast }) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [isProcessing, setIsProcessing] = useState(false)
  const [donationsTotal, setDonationsTotal] = useState(0)

  const notify = (msg, type = 'info') => {
    if (typeof afterToast === 'function') afterToast(msg, type)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type } }))
    }
  }

  // Refresh total every 15s
  useEffect(() => {
    let timer
    const load = async () => {
      try {
        const res = await fetch('/api/donations-total', { cache: 'no-store' })
        const json = await res.json()
        if (res.ok && typeof json.total === 'number') setDonationsTotal(json.total)
      } catch {} // eslint-disable-line no-empty
      finally { timer = setTimeout(load, 15000) }
    }
    load()
    return () => timer && clearTimeout(timer)
  }, [])

  // Insert donation; return boolean
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
    if (!isConnected || !address) {
      notify('Connect your wallet before donating.', 'error')
      return
    }

    if (!walletClient?.transport?.request) {
      notify('This wallet does not support symbolic donations.', 'error')
      return
    }

    try {
      setIsProcessing(true)
      const provider = new BrowserProvider(walletClient)
      const signer = await provider.getSigner()

      await signer.sendTransaction({
        to: process.env.NEXT_PUBLIC_ADMIN_WALLET,
        value: parseEther(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE)
      })

      // Sólo agradece si /api/donate-log confirma insert
      const ok = await logSuccess()
      if (!ok) {
        notify('On-chain ok, but logging failed. Please contact support.', 'error')
        return
      }

      notify('Thanks! You powered MM3 Real.', 'success')

      // refresh total
      try {
        const res = await fetch('/api/donations-total', { cache: 'no-store' })
        const json = await res.json()
        if (res.ok && typeof json.total === 'number') setDonationsTotal(json.total)
      } catch {} // eslint-disable-line no-empty
    } catch (err) {
      console.error('Donation failed:', err)
      notify('Transaction cancelled or failed.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <RetroConnectButton />
      <RetroDonateButton
        total={donationsTotal}
        onClick={onDonateClick}
        disabled={false}
        isConnected={isConnected}
        isProcessing={isProcessing}
      />
    </div>
  )
}

/* ================== Provider ================== */
export default function ConnectAndPlayProvider({ children }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiConfig>
  )
}
