"use client";

import { type ReactNode, useEffect, useState } from "react";
import { base } from "wagmi/chains";
import { farcasterFrame as miniAppConnector } from '@farcaster/frame-wagmi-connector';
import { http, createConfig, WagmiProvider } from 'wagmi';
import { FrameProvider } from './farcaster-provider';
import { wagmiAdapter, queryClient } from './config/appkit';
import { QueryClientProvider } from '@tanstack/react-query'

// Farcaster-specific config
const farcasterConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors: [
    miniAppConnector()
  ]
});

export function Providers(props: { children: ReactNode }) {
  const [isFarcasterEnv, setIsFarcasterEnv] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Detect if we're in a Farcaster environment
    const checkFarcasterEnv = () => {
      // Check for Farcaster user agent or SDK availability
      const userAgent = navigator.userAgent.toLowerCase();
      const isFarcaster = userAgent.includes('farcaster') || 
                         userAgent.includes('warpcast') ||
                         window.location.ancestorOrigins?.length > 0 || // In an iframe
                         document.referrer.includes('warpcast') ||
                         document.referrer.includes('farcaster');
      
      console.log('🔍 Environment detection:', {
        userAgent,
        isFarcaster,
        hasAncestors: window.location.ancestorOrigins?.length > 0,
        referrer: document.referrer
      });
      
      setIsFarcasterEnv(isFarcaster);
    };

    checkFarcasterEnv();
  }, []);

  // Use appropriate config based on environment
  const config = isFarcasterEnv ? farcasterConfig : wagmiAdapter.wagmiConfig;

  if (!isClient) {
    // Return loading state on server side
    return <div>Loading...</div>;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <FrameProvider>
          {props.children}
        </FrameProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
