'use client'

import { useState, useEffect, useMemo } from 'react'
import { createWeb3Modal, useWeb3Modal } from '@web3modal/wagmi/react'
import { WagmiConfig, createConfig, useAccount, useWalletClient, useDisconnect, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { BrowserProvider, parseEther } from 'ethers'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Si usas Supabase u otros, puedes importarlos aquí si los necesitas
// import supabase from '@/lib/supabaseClient'

// === Configuración base ===
const queryClient = new QueryClient()
const chains = [mainnet]
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

const wagmiConfig = createConfig({
  chains,
  transports: { [mainnet.id]: http() }
})

// === Web3Modal con tema alineado al gráfico (cyan) ===
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

// === Utilidad abreviar address (por si la reutilizas)
export function useShortAddress(addr) {
  return useMemo(() => (!addr ? '' : addr.slice(0, 6) + '…' + addr.slice(-4)), [addr])
}

// === Botón pill toggle Connect/Disconnect ===
function PillConnectButton() {
  const { isConnected } = useAccount()
  const { open } = useWeb3Modal()
  const { disconnect } = useDisconnect()

  const handleClick = () => (isConnected ? disconnect() : open({ view: 'Connect' }))

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center px-4 sm:px-5 py-2 rounded-full font-semibold
                 bg-cyan-500 text-white hover:bg-cyan-400 active:bg-cyan-600
                 transition-colors duration-200 shadow-sm focus:outline-none
                 focus:ring-2 focus:ring-cyan-300"
      title={isConnected ? 'Disconnect wallet' : 'Connect wallet'}
      aria-label={isConnected ? 'Disconnect wallet' : 'Connect wallet'}
    >
      {isConnected ? 'Disconnect Wallet' : 'Connect Wallet'}
    </button>
  )
}

/**
 * WalletActions
 * - Colócalo donde quieras (p. ej., en el header del carrusel con rightSlot)
 * - Si quieres atarlo al resultado del Board, sustituye donateEnabled por tu condición
 */
export function WalletActions({
  gameCompleted,          // opcional
  gameData,               // opcional
  afterToast,             // opcional: (msg, type) => void
}) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [isDonating, setIsDonating] = useState(false)

  // Condición de habilitado de DONATE (si quieres atarlo al Board, descomenta):
  // const donateEnabled = isConnected && gameCompleted && gameData?.is_correct === true
  const donateEnabled = isConnected

  const notify = (msg, type = 'info') => {
    if (typeof afterToast === 'function') afterToast(msg, type)
    // Si usas un sistema de toasts global, dispara aquí
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type } }))
    }
  }

  const handleDonation = async (e) => {
    e.preventDefault()
    if (!isConnected || !address) {
      notify('Connect your wallet before donating.', 'error')
      return
    }

    try {
      setIsDonating(true)

      if (!walletClient?.transport?.request) {
        notify('This wallet does not support symbolic donations.', 'error')
        return
      }

      const provider = new BrowserProvider(walletClient)
      const signer = await provider.getSigner()

      await signer.sendTransaction({
        to: process.env.NEXT_PUBLIC_ADMIN_WALLET,
        value: parseEther(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE)
      })

      notify('Signal received. A ripple echoes through the field.', 'success')
    } catch (err) {
      console.error('Donation failed:', err)
      notify('Even hesitation shapes the system. Donation aborted.', 'error')
    } finally {
      setIsDonating(false)
    }
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <PillConnectButton />
      {isConnected && (
        <button
          type="button"
          onClick={handleDonation}
          disabled={!donateEnabled || isDonating}
          className={`inline-flex items-center px-4 sm:px-5 py-2 rounded-full font-semibold
                      transition-colors duration-200 shadow-sm focus:outline-none
                      focus:ring-2 focus:ring-emerald-300 ${
                        isDonating || !donateEnabled
                          ? 'bg-emerald-600/60 text-white cursor-wait'
                          : 'bg-emerald-500 text-white hover:bg-emerald-400 active:bg-emerald-600'
                      }`}
          aria-label="Donate"
        >
          {isDonating ? 'Donating…' : 'Donate'}
        </button>
      )}
    </div>
  )
}

/**
 * Provider wrapper (si necesitas contexto Wagmi/Web3Modal en la página completa)
 * No renderiza UI por sí mismo.
 */
export default function ConnectAndPlayProvider({ children }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiConfig>
  )
}
