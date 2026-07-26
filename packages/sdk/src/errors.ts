export type MandateErrorCode =
  | 'user-rejected'
  | 'wrong-network'
  | 'insufficient-gas'
  | 'insufficient-token-balance'
  | 'insufficient-vault-balance'
  | 'rpc-unavailable'
  | 'plan-disabled'
  | 'plan-not-found'
  | 'not-plan-merchant'
  | 'subscription-not-found'
  | 'not-subscriber'
  | 'invalid-subscription-status'
  | 'charge-not-due'
  | 'charge-limit-reached'
  | 'spend-cap-exceeded'
  | 'charges-paused'
  | 'invalid-plan-terms'
  | 'unsupported-token'
  | 'refund-too-large'
  | 'transaction-failed'

export interface MandateFriendlyError {
  code: MandateErrorCode
  title: string
  message: string
  retryable: boolean
  technicalMessage?: string
}

type ErrorRecord = Record<string, unknown>

function isRecord(value: unknown): value is ErrorRecord {
  return typeof value === 'object' && value !== null
}

function collectErrorText(error: unknown, visited = new Set<unknown>()): string[] {
  if (error === null || error === undefined || visited.has(error)) return []
  if (typeof error === 'string') return [error]
  if (typeof error === 'number' || typeof error === 'bigint') return [String(error)]
  if (!isRecord(error)) return []

  visited.add(error)
  const values: string[] = []
  for (const key of ['name', 'shortMessage', 'message', 'details', 'reason', 'errorName', 'code']) {
    const value = error[key]
    if (typeof value === 'string' || typeof value === 'number') values.push(String(value))
  }
  for (const key of ['cause', 'error', 'data']) {
    values.push(...collectErrorText(error[key], visited))
  }
  return values
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern))
}

function friendly(
  code: MandateErrorCode,
  title: string,
  message: string,
  retryable: boolean,
  technicalMessage?: string,
): MandateFriendlyError {
  return { code, title, message, retryable, technicalMessage }
}

/**
 * Converts wallet, RPC, viem and MandateProtocol errors into stable user-facing copy.
 * The original technical text is preserved for optional diagnostics, never shown by default.
 */
export function describeMandateError(error: unknown): MandateFriendlyError {
  const technicalMessage = collectErrorText(error).filter(Boolean).join(' · ').slice(0, 1_200)
  const text = technicalMessage.toLowerCase()

  if (includesAny(text, ['user rejected', 'user denied', 'rejected the request', '4001', 'request rejected'])) {
    return friendly(
      'user-rejected',
      'Transaction cancelled',
      'You rejected the request in your wallet. No funds moved.',
      true,
      technicalMessage,
    )
  }

  if (includesAny(text, ['chain mismatch', 'wrong chain', 'unsupported chain', 'switch chain', 'chain not configured', 'chain disconnected'])) {
    return friendly(
      'wrong-network',
      'Wrong network',
      'Switch your wallet to Soneium Minato and try again.',
      true,
      technicalMessage,
    )
  }

  if (includesAny(text, ['insufficient funds for gas', 'insufficient funds', 'intrinsic transaction cost'])) {
    return friendly(
      'insufficient-gas',
      'Not enough Minato ETH',
      'Your wallet needs a small amount of Minato test ETH to pay the network fee.',
      true,
      technicalMessage,
    )
  }

  if (includesAny(text, ['insufficientvaultbalance', 'insufficient vault balance'])) {
    return friendly(
      'insufficient-vault-balance',
      'Vault balance is too low',
      'Add more Test USDSC to the protected vault before continuing.',
      true,
      technicalMessage,
    )
  }

  if (includesAny(text, ['erc20insufficientbalance', 'transfer amount exceeds balance', 'insufficient token balance'])) {
    return friendly(
      'insufficient-token-balance',
      'Not enough Test USDSC',
      'Your connected wallet does not have enough Test USDSC for this action.',
      false,
      technicalMessage,
    )
  }

  if (includesAny(text, ['plandisabled', 'plan disabled'])) {
    return friendly(
      'plan-disabled',
      'Plan is paused',
      'This membership plan is currently paused by its merchant.',
      false,
      technicalMessage,
    )
  }

  if (includesAny(text, ['plannotfound', 'plan not found'])) {
    return friendly('plan-not-found', 'Plan not found', 'This membership plan no longer exists.', false, technicalMessage)
  }

  if (includesAny(text, ['notplanmerchant', 'not plan merchant'])) {
    return friendly(
      'not-plan-merchant',
      'Merchant permission required',
      'Only the wallet that published this plan can change or refund it.',
      false,
      technicalMessage,
    )
  }

  if (includesAny(text, ['subscriptionnotfound', 'subscription not found'])) {
    return friendly(
      'subscription-not-found',
      'Membership not found',
      'The requested membership could not be found on Minato.',
      false,
      technicalMessage,
    )
  }

  if (includesAny(text, ['notsubscriber', 'not subscriber'])) {
    return friendly(
      'not-subscriber',
      'Subscriber permission required',
      'Only the subscriber wallet can pause, resume or cancel this membership.',
      false,
      technicalMessage,
    )
  }

  if (includesAny(text, ['invalidsubscriptionstatus', 'invalid subscription status'])) {
    return friendly(
      'invalid-subscription-status',
      'Action unavailable',
      'This action is not valid for the membership’s current status.',
      false,
      technicalMessage,
    )
  }

  if (includesAny(text, ['chargenotdue', 'charge not due'])) {
    return friendly(
      'charge-not-due',
      'Payment is not due yet',
      'The next charge can only be settled after its scheduled date.',
      false,
      technicalMessage,
    )
  }

  if (includesAny(text, ['chargelimitreached', 'charge limit reached'])) {
    return friendly(
      'charge-limit-reached',
      'Charge limit reached',
      'This membership has already used every charge allowed by its terms.',
      false,
      technicalMessage,
    )
  }

  if (includesAny(text, ['spendcapexceeded', 'spend cap exceeded'])) {
    return friendly(
      'spend-cap-exceeded',
      'Lifetime cap reached',
      'This payment would exceed the subscriber-approved lifetime cap.',
      false,
      technicalMessage,
    )
  }

  if (includesAny(text, ['chargespaused', 'charges paused'])) {
    return friendly(
      'charges-paused',
      'Settlements are paused',
      'Protocol charge settlement is temporarily paused. User withdrawals remain available.',
      true,
      technicalMessage,
    )
  }

  if (includesAny(text, ['invalidperiod', 'invalidchargelimit', 'invalidspendcap', 'zeroamount'])) {
    return friendly(
      'invalid-plan-terms',
      'Invalid terms',
      'Review the price, billing interval, charge count and lifetime cap.',
      false,
      technicalMessage,
    )
  }

  if (includesAny(text, ['unsupportedtoken', 'feeontransfertokenunsupported'])) {
    return friendly(
      'unsupported-token',
      'Token not supported',
      'This token cannot be used by the current Mandate deployment.',
      false,
      technicalMessage,
    )
  }

  if (includesAny(text, ['refundexceedspaidamount', 'refund exceeds paid amount'])) {
    return friendly(
      'refund-too-large',
      'Refund is too large',
      'The refund cannot exceed the net amount already settled for this membership.',
      false,
      technicalMessage,
    )
  }

  if (
    includesAny(text, [
      'failed to fetch',
      'network error',
      'network request failed',
      'http request failed',
      'timeout',
      'timed out',
      'rpc request failed',
      'rpc error',
      'connection reset',
      'connection refused',
    ])
  ) {
    return friendly(
      'rpc-unavailable',
      'Minato connection unavailable',
      'The network did not respond. Check your connection, wait a moment and retry.',
      true,
      technicalMessage,
    )
  }

  return friendly(
    'transaction-failed',
    'Transaction failed',
    'The action could not be completed. Your confirmed onchain balances are unchanged.',
    true,
    technicalMessage,
  )
}

export function formatMandateError(error: unknown): string {
  return describeMandateError(error).message
}
