import type { Address } from 'viem'

const ZERO = '0x0000000000000000000000000000000000000000' as Address
const DEFAULT_PROTOCOL = '0x59CCA55ad8F4AEd1460dCd0356c4B682B986b408' as Address
const DEFAULT_TOKEN = '0x5cB83Dfd39205E9A0697BD0a1d51874c481bdC9f' as Address

export const env = {
  protocolAddress: (import.meta.env.VITE_PROTOCOL_ADDRESS || DEFAULT_PROTOCOL) as Address,
  tokenAddress: (import.meta.env.VITE_TOKEN_ADDRESS || DEFAULT_TOKEN) as Address,
  demoMode: String(import.meta.env.VITE_DEMO_MODE ?? 'false') === 'true',
}

export const hasDeployment = env.protocolAddress !== ZERO && env.tokenAddress !== ZERO
