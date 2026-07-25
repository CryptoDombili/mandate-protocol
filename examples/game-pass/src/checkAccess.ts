import { createPublicClient, http, type Address } from 'viem'
import { soneiumMinato } from 'viem/chains'
import { MandateClient } from '@mandate/sdk'

type MandateClientConfig = ConstructorParameters<typeof MandateClient>[0]

export async function canEnterPremiumTournament(
  protocolAddress: Address,
  subscriptionId: bigint,
): Promise<boolean> {
  const publicClient = createPublicClient({
    chain: soneiumMinato,
    transport: http('https://rpc.minato.soneium.org/'),
  })

  // npm workspaces can resolve more than one compatible viem type copy.
  // Both clients have the same runtime API; this explicit adapter prevents
  // TypeScript from treating the duplicate type declarations as incompatible.
  const mandate = new MandateClient({
    protocolAddress,
    publicClient: publicClient as unknown as MandateClientConfig['publicClient'],
  })

  return mandate.hasActiveAccess(subscriptionId)
}
