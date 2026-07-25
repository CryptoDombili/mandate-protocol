import { createPublicClient, http, type Address } from 'viem'
import { soneiumMinato } from 'viem/chains'
import { MandateClient } from '@mandate/sdk'

export async function canEnterPremiumTournament(
  protocolAddress: Address,
  subscriptionId: bigint,
): Promise<boolean> {
  const publicClient = createPublicClient({
    chain: soneiumMinato,
    transport: http('https://rpc.minato.soneium.org/'),
  })

  const mandate = new MandateClient({ protocolAddress, publicClient })
  return mandate.hasActiveAccess(subscriptionId)
}
