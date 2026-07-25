import type { Address } from 'viem'

const ZERO = '0x0000000000000000000000000000000000000000' as Address

export const env = {
  protocolAddress: (import.meta.env.VITE_PROTOCOL_ADDRESS || ZERO) as Address,
  tokenAddress: (import.meta.env.VITE_TOKEN_ADDRESS || ZERO) as Address,
  demoMode: String(import.meta.env.VITE_DEMO_MODE ?? 'true') === 'true',
}

export const hasDeployment = env.protocolAddress !== ZERO && env.tokenAddress !== ZERO
