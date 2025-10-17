'use client'

import { useState, useEffect, useMemo } from 'react'
import { createWeb3Modal, useWeb3Modal } from '@web3modal/wagmi/react'
import { WagmiConfig, createConfig, useAccount, useWalletClient, useDisconnect, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { BrowserProvider, parseEther } from 'ethers'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import supabase from '@/lib/supabaseClient'

// === Configuración base ===
const queryClient = new QueryClient()
const chains = [mainnet]
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

const wagmiConfig = createConfig({
  chains,
  transports: { [mainnet.id]: http() }
})

// === Web3Modal con tema acorde al estilo MM3 ===
createWeb3Modal({
  wagmiConfig,
  projectId,
  chains,
  enableAnalytics: false,
  disableTelemetry: true,
  enableOnramp: false,
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#6366F1',
    '--w3m-accent-fill': '#FFFFFF',
    '--w3m-background': '#0b0f1a',
    '--w3m-font-family':
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"',
    '--w3m-border-radius-master': '999px',
    '--w3m-button-border-radius': '999px'
  }
})

// === Hook para abreviar dirección ===
function useShortAddress(addr) {
  return useMemo(() => {
    if (!addr) return ''
    return addr.slice(0, 6) + '…' + addr.slice(-4)
  }, [addr])
}

// === Botón unificado estilo pill (toggle real) ===
function PillConnectButton() {
  const { isConnected, address } = useAccount()
  const { open } = useWeb3Modal()
  const { disconnect } = useDisconnect()
  const short = useShortAddress(address)

  const handleClick = () => {
    if (isConnected) {
      // Toggle: desconectar en un clic
      disconnect()
    } else {
      // Abrir modal de conexión
      open({ view: 'Connect' })
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center px-5 py-2 rounded-full font-semibold
                 bg-indigo-500 text-white hover:bg-indigo-400 active:bg-indigo-600
                 transition-colors duration-200 shadow-sm focus:outline-none
                 focus:ring-2 focus:ring-indigo-300"
      title={isConnected ? 'Disconnect wallet' : 'Connect wallet'}
      aria-label={isConnected ? 'Disconnect wallet' : 'Connect wallet'}
    >
      {isConnected ? short : 'Connect Wallet'}
    </button>
  )
}

function ConnectAndPlayContent({ gameCompleted, gameData, account, setAccount }) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [statusMessage, setStatusMessage] = useState(null)
  const [isDonating, setIsDonating] = useState(false)
  const [isFading, setIsFading] = useState(false)

  // Sincroniza el estado de la cuenta sin alterar tu lógica
  useEffect(() => {
    if (setAccount) setAccount(isConnected && address ? address : null)
  }, [isConnected, address, setAccount])

  useEffect(() => {
    if (!statusMessage) return
    setIsFading(false)
    const fadeTimer = setTimeout(() => setIsFading(true), 3500)
    const removeTimer = setTimeout(() => setStatusMessage(null), 4000)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [statusMessage])

  const showToast = (msg, type = 'info') => setStatusMessage({ msg, type })

  const handleDonation = async (e) => {
    e.preventDefault()
    if (!isConnected || !address) {
      showToast('Connect your wallet before donating.', 'error')
      return
    }

    try {
      setIsDonating(true)

      if (!walletClient?.transport?.request) {
        showToast('This wallet does not support symbolic donations.', 'error')
        return
      }

      const provider = new BrowserProvider(walletClient)
      const signer = await provider.getSigner()

      await signer.sendTransaction({
        to: process.env.NEXT_PUBLIC_ADMIN_WALLET,
        value: parseEther(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE)
      })

      showToast('Signal received. A ripple echoes through the field.', 'success')
    } catch (err) {
      console.error('Donation failed:', err)
      showToast('Even hesitation shapes the system. Donation aborted.', 'error')
    } finally {
      setIsDonating(false)
    }
  }

  return (
    <>
      <div className="my-4 flex items-center justify-center gap-4 flex-wrap">
        {/* Botón unificado (toggle real) */}
        <PillConnectButton />

        {/* Botón de donación (opcional) */}
        {isConnected && (
          <button
            type="button"
            onClick={handleDonation}
            disabled={isDonating}
            className={`inline-flex items-center px-5 py-2 rounded-full font-semibold
                        transition-colors duration-200 shadow-sm focus:outline-none
                        focus:ring-2 focus:ring-emerald-300 ${
                          isDonating
                            ? 'bg-emerald-600/60 text-white cursor-wait'
                            : 'bg-emerald-500 text-white hover:bg-emerald-400 active:bg-emerald-600'
                        }`}
            aria-label="donate (optional)"
          >
            {isDonating ? 'Donating…' : 'donate (optional)'}
          </button>
        )}
      </div>

      {statusMessage && (
        <div
          className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-xl font-mono text-sm z-50 shadow-xl transition-all duration-500 ${
            isFading ? 'opacity-0 translate-y-2' : 'opacity-100'
          } ${
            statusMessage.type === 'success'
              ? 'bg-green-800 border border-green-400 text-green-200'
              : statusMessage.type === 'error'
              ? 'bg-red-800 border border-red-400 text-red-200'
              : 'bg-[#0f172a] border border-yellow-400 text-yellow-300'
          }`}
        >
          <span className="mr-2">
            {statusMessage.type === 'success' ? '✅' : statusMessage.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          {statusMessage.msg}
        </div>
      )}
    </>
  )
}

export default function ConnectAndPlay(props) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectAndPlayContent {...props} />
      </QueryClientProvider>
    </WagmiConfig>
  )
}
