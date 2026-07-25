import { startaleConnector } from '@startale/app-sdk'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { soneiumMinato } from 'wagmi/chains'

export const wagmiConfig = createConfig({
  chains: [soneiumMinato],
  connectors: [
    startaleConnector({ appName: 'Mandate' }),
    injected({ target: 'metaMask' }),
  ],
  transports: {
    [soneiumMinato.id]: http('https://rpc.minato.soneium.org/'),
  },
})
