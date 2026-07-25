export const mandateProtocolAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
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
  {
    type: 'function',
    name: 'subscribe',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'planId', type: 'uint256' },
      { name: 'chargeLimit', type: 'uint32' },
      { name: 'spendCap', type: 'uint128' },
    ],
    outputs: [{ name: 'subscriptionId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'charge',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [],
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
    name: 'hasActiveAccess',
    stateMutability: 'view',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
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
] as const

export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
