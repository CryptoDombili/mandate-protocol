import { createPublicClient, http, type Address } from 'viem'
import { soneiumMinato } from 'viem/chains'
import {
  MandateClient,
  mandateMinatoDeployment,
  type AccessDecision,
  type MandateClientConfig,
} from '@mandate/sdk'

function createReadClient(): MandateClient {
  const publicClient = createPublicClient({
    chain: soneiumMinato,
    transport: http(mandateMinatoDeployment.rpcUrl),
  })

  // Workspace installs may expose compatible viem clients from different type copies.
  // The runtime API is identical, so this adapter keeps the example portable.
  return new MandateClient({
    protocolAddress: mandateMinatoDeployment.protocolAddress,
    publicClient: publicClient as unknown as MandateClientConfig['publicClient'],
  })
}

/**
 * Use this at the boundary of a premium feature.
 * Access is granted only while a confirmed paid period is still active.
 */
export async function checkGamePass(
  subscriptionId: bigint,
  connectedAccount?: Address,
): Promise<AccessDecision> {
  return createReadClient().checkAccess(subscriptionId, connectedAccount)
}

export async function canEnterPremiumTournament(
  subscriptionId: bigint,
  connectedAccount?: Address,
): Promise<boolean> {
  const decision = await checkGamePass(subscriptionId, connectedAccount)
  return decision.granted
}
