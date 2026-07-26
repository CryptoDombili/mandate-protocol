import type { Address } from 'viem'

export enum SubscriptionStatus {
  None = 0,
  Active = 1,
  Paused = 2,
  Cancelled = 3,
  Completed = 4,
}

export interface MandatePlan {
  id: bigint
  merchant: Address
  token: Address
  amountPerPeriod: bigint
  periodSeconds: bigint
  merchantChargeLimit: number
  enabled: boolean
  metadataURI: string
}

export interface MandateSubscription {
  id: bigint
  planId: bigint
  subscriber: Address
  spendCap: bigint
  totalSpent: bigint
  totalRefunded: bigint
  nextChargeAt: bigint
  paidUntil: bigint
  chargeLimit: number
  charges: number
  status: SubscriptionStatus
}

export type AccessDenialReason =
  | 'subscription-not-found'
  | 'subscriber-mismatch'
  | 'awaiting-first-payment'
  | 'access-expired'
  | 'cancelled-and-expired'
  | 'completed-and-expired'

export interface AccessDecision {
  granted: boolean
  reason: 'paid-access-active' | AccessDenialReason
  checkedAt: bigint
  subscription: MandateSubscription | null
  plan: MandatePlan | null
}

export interface CreatePlanInput {
  token: Address
  amountPerPeriod: bigint
  periodSeconds: bigint
  merchantChargeLimit: number
  metadataURI: string
}
