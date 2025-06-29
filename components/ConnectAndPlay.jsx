'use client'

import { useState, useEffect } from 'react'
import {
  createWeb3Modal,
  useWeb3Modal
} from '@web3modal/wagmi/react'
import {
  WagmiConfig,
  createConfig,
  useAccount,
  useConnect,
  useWalletClient,
  http
} from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { BrowserProvider, parseEther } from 'ethers'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import supabase from '@/lib/supabaseClient'

const queryClient = new QueryClient()
const chains = [mainnet]
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

const wagmiConfig = createConfig({
  chains,
  transports: {
    [mainnet.id]: http()
  }
})

createWeb3Modal({
  wagmiConfig,
  projectId,
  chains,
  enableAnalytics: false,
  disableTelemetry: true,
  enableOnramp: false,
  themeMode: 'light'
})

function ConnectAndPlayContent({ gameCompleted, gameData, account, setAccount }) {
  const { open } = useWeb3Modal()
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { data: walletClient } = useWalletClient()

  const [statusMessage, setStatusMessage] = useState(null)
  const [isDonating, setIsDonating] = useState(false)
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    if (isConnected && address && setAccount) {
      setAccount(address)
    }
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

  const showToast = (msg, type = 'info') => {
    setStatusMessage({ msg, type })
  }

  const handleMobileConnect = () => {
    const walletConnect = connectors.find(c => c.id === 'walletConnect')
    if (walletConnect) {
      connect({ connector: walletConnect })
    } else {
      open()
    }
  }

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

  const isAndroid =
    typeof window !== 'undefined' && /android/i.test(navigator.userAgent)

  return (
    <>
      <div className="text-center my-4 space-y-4">
        {!isConnected ? (
          <button
            onClick={isAndroid ? handleMobileConnect : open}
            className="px-4 py-2 mt-2 ml-2 rounded bg-black text-white hover:bg-gray-900 transition"
          >
            Connect Wallet
          </button>
        ) : (
          <a
            href="#disturbance"
            onClick={handleDonation}
            role="link"
            className={`px-0 py-0 mt-2 ml-2 font-medium underline transition-colors duration-200 whitespace-nowrap ${
              isDonating
                ? 'cursor-wait text-slate-500'
                : 'cursor-pointer text-slate-800 hover:text-slate-600'
            }`}
          >
            {isDonating ? 'Donating...' : 'Optional: donate a symbolic 0.00001 ETH to support the MM3 project.'}
          </a>
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
            {statusMessage.type === 'success'
              ? '✅'
              : statusMessage.type === 'error'
              ? '❌'
              : 'ℹ️'}
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
