import type { Address } from 'viem'

export interface MandateDeployment {
  chainId: number
  chainName: string
  rpcUrl: string
  explorerUrl: string
  protocolAddress: Address
  tokenAddress: Address
  tokenLabel: string
  tokenDecimals: number
  deploymentBlock: bigint
}

export const mandateMinatoDeployment: MandateDeployment = {
  chainId: 1946,
  chainName: 'Soneium Minato',
  rpcUrl: 'https://rpc.minato.soneium.org/',
  explorerUrl: 'https://soneium-minato.blockscout.com',
  protocolAddress: '0x59CCA55ad8F4AEd1460dCd0356c4B682B986b408',
  tokenAddress: '0x5cB83Dfd39205E9A0697BD0a1d51874c481bdC9f',
  tokenLabel: 'Test USDSC',
  tokenDecimals: 6,
  deploymentBlock: 30_931_467n,
}
