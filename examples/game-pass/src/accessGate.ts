import type { Address } from 'viem'
import { checkGamePass } from './checkAccess.js'

export interface GateResponse {
  status: 200 | 402 | 403 | 404
  body: {
    access: 'granted' | 'denied'
    reason: string
    paidUntil?: string
  }
}

/**
 * Framework-neutral example. The same function can sit behind an API route,
 * premium game lobby, private download, creator post, or member chat.
 */
export async function openPremiumFeature(
  subscriptionId: bigint,
  connectedAccount: Address,
): Promise<GateResponse> {
  const decision = await checkGamePass(subscriptionId, connectedAccount)

  if (decision.granted) {
    return {
      status: 200,
      body: {
        access: 'granted',
        reason: decision.reason,
        paidUntil: decision.subscription
          ? new Date(Number(decision.subscription.paidUntil) * 1000).toISOString()
          : undefined,
      },
    }
  }

  const status = decision.reason === 'subscription-not-found'
    ? 404
    : decision.reason === 'subscriber-mismatch'
      ? 403
      : 402

  return {
    status,
    body: {
      access: 'denied',
      reason: decision.reason,
    },
  }
}
