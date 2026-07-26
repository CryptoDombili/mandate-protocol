import { startaleConnector } from '@startale/app-sdk'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { soneiumMinato } from 'wagmi/chains'

export const wagmiConfig = createConfig({
  chains: [soneiumMinato],
  connectors: [
    startaleConnector({ appName: 'Mandate' }),
    // Generic injected detection is more reliable across MetaMask versions
    // and browsers than forcing a single provider target.
    injected(),
  ],
  transports: {
    [soneiumMinato.id]: http('https://rpc.minato.soneium.org/'),
  },
})
