import { parseAbiItem, type Hash } from 'viem'

export const depositedEvent = parseAbiItem(
  'event Deposited(address indexed account, address indexed token, uint256 amount)',
)

export const withdrawnEvent = parseAbiItem(
  'event Withdrawn(address indexed account, address indexed token, uint256 amount)',
)

export const subscriptionPausedEvent = parseAbiItem(
  'event SubscriptionPaused(uint256 indexed subscriptionId)',
)

export const subscriptionResumedEvent = parseAbiItem(
  'event SubscriptionResumed(uint256 indexed subscriptionId, uint64 nextChargeAt)',
)

export const subscriptionCancelledEvent = parseAbiItem(
  'event SubscriptionCancelled(uint256 indexed subscriptionId)',
)

export const chargedEvent = parseAbiItem(
  'event Charged(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber, address merchant, address token, uint256 amount, uint32 chargeNumber, uint64 paidUntil)',
)

export const refundedEvent = parseAbiItem(
  'event Refunded(uint256 indexed subscriptionId, address indexed merchant, address indexed subscriber, address token, uint256 amount)',
)

export type ProofKind =
  | 'Vault funded'
  | 'Vault withdrawal'
  | 'Membership created'
  | 'Membership paused'
  | 'Membership resumed'
  | 'Membership cancelled'
  | 'Payment settled'
  | 'Payment refunded'

export interface ProofRecord {
  id: string
  kind: ProofKind
  detail: string
  amount?: bigint
  subscriptionId?: bigint
  blockNumber: bigint
  logIndex: number
  transactionHash: Hash
  timestamp?: bigint
}
