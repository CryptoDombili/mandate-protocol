import { parseAbiItem, type Address } from 'viem'

export const DEPLOYMENT_BLOCK = 30_931_467n

export const subscriptionCreatedEvent = parseAbiItem(
  'event SubscriptionCreated(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber, uint256 chargeLimit, uint256 spendCap)',
)

export const protocolReadAbi = [
  {
    type: 'function',
    name: 'subscriptions',
    stateMutability: 'view',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [
      { name: 'planId', type: 'uint256' },
      { name: 'subscriber', type: 'address' },
      { name: 'spendCap', type: 'uint128' },
      { name: 'totalSpent', type: 'uint128' },
      { name: 'totalRefunded', type: 'uint128' },
      { name: 'nextChargeAt', type: 'uint64' },
      { name: 'paidUntil', type: 'uint64' },
      { name: 'chargeLimit', type: 'uint32' },
      { name: 'charges', type: 'uint32' },
      { name: 'status', type: 'uint8' },
    ],
  },
  {
    type: 'function',
    name: 'plans',
    stateMutability: 'view',
    inputs: [{ name: 'planId', type: 'uint256' }],
    outputs: [
      { name: 'merchant', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amountPerPeriod', type: 'uint128' },
      { name: 'periodSeconds', type: 'uint64' },
      { name: 'merchantChargeLimit', type: 'uint32' },
      { name: 'enabled', type: 'bool' },
      { name: 'metadataURI', type: 'string' },
    ],
  },
  {
    type: 'function',
    name: 'vaultBalance',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'pauseSubscription',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'resumeSubscription',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelSubscription',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

export const tokenReadAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export type SubscriptionTuple = readonly [
  bigint,
  Address,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  number,
  number,
  number,
]

export type PlanTuple = readonly [Address, Address, bigint, bigint, number, boolean, string]
