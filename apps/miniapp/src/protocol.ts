import { parseAbiItem, type Address } from 'viem'
import { mandateProtocolAbi } from '@mandate/sdk'

export const DEPLOYMENT_BLOCK = 30_931_467n

export const subscriptionCreatedEvent = parseAbiItem(
  'event SubscriptionCreated(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber, uint256 chargeLimit, uint256 spendCap)',
)

export const protocolReadAbi = mandateProtocolAbi

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
