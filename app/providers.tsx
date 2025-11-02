'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'wagmi/chains';

// Get projectId from environment or use a default for development
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

const config = getDefaultConfig({
  appName: 'x402 URL Shortener',
  projectId: projectId,
  chains: [baseSepolia],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
