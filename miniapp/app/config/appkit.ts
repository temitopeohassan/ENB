import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { base, type AppKitNetwork } from '@reown/appkit/networks'
import { QueryClient } from '@tanstack/react-query'

// 1. Get projectId from https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || '3fbb6bba6f1de962d911bb5b5c9ddd26'

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// 2. Set up Wagmi adapter
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [base]

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true
})

// 3. Create modal
export const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: 'ENB Mini App',
    description: 'ENB Mining App',
    url: 'https://test-flight-six.vercel.app',
    icons: ['https://test-flight-six.vercel.app/header-logo.png']
  },
  features: {
    analytics: true,
  }
})

export const queryClient = new QueryClient()

