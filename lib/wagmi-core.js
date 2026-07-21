'use client';

import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { QueryClient } from '@tanstack/react-query';

// viem's bare http() falls back to eth.merkle.io, which now 401s ("invalid
// key") without an API key. Point at a free, no-key public RPC instead;
// NEXT_PUBLIC_MAINNET_RPC_URL overrides it if a dedicated provider is set up.
const MAINNET_RPC_URL = process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com';

export const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http(MAINNET_RPC_URL) },
});

export const queryClient = new QueryClient();
