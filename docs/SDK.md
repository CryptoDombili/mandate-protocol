# Mandate SDK

`@mandate/sdk` is the typed integration layer for membership access, bounded recurring payments, merchant plans, and user exits.

## Install

```bash
npm install @mandate/sdk viem
```

## Read-only access gate

```ts
import { createPublicClient, http } from 'viem'
import { soneiumMinato } from 'viem/chains'
import { MandateClient, mandateMinatoDeployment } from '@mandate/sdk'

const publicClient = createPublicClient({
  chain: soneiumMinato,
  transport: http(mandateMinatoDeployment.rpcUrl),
})

const mandate = new MandateClient({
  protocolAddress: mandateMinatoDeployment.protocolAddress,
  publicClient,
})

const decision = await mandate.checkAccess(subscriptionId, connectedAccount)

if (decision.granted) {
  openPremiumFeature()
}
```

## Writes

Pass a viem `WalletClient` and the connected account to enable writes:

```ts
const mandate = new MandateClient({
  protocolAddress,
  publicClient,
  walletClient,
  account,
})

await mandate.approveToken(token, cap)
await mandate.deposit(token, cap)
await mandate.subscribe(planId, chargeLimit, cap)
```

The same calls work with a normal browser wallet or the Startale host wallet because both expose wagmi/viem-compatible transaction surfaces.

## Core methods

### Reads

- `getPlan(planId)`
- `getSubscription(subscriptionId)`
- `checkAccess(subscriptionId, expectedSubscriber?)`
- `hasActiveAccess(subscriptionId)`
- `getVaultBalance(account, token)`
- `getTokenBalance(token, account)`
- `getTokenAllowance(token, owner)`

### User writes

- `approveToken(token, amount)`
- `deposit(token, amount)`
- `subscribe(planId, chargeLimit, spendCap)`
- `pause(subscriptionId)`
- `resume(subscriptionId)`
- `cancel(subscriptionId)`
- `withdraw(token, amount)`

### Merchant and keeper writes

- `createPlan(input)`
- `setPlanEnabled(planId, enabled)`
- `charge(subscriptionId)`
- `refund(subscriptionId, amount)`

## Access semantics

`checkAccess` returns a typed decision and never treats a merely-created subscription as paid access. A successful charge sets `paidUntil`; access remains valid through that timestamp even if future charges are paused or cancelled.

## Failure-safe UX

Use the SDK error helpers around every write:

```ts
import { describeMandateError, formatMandateError } from '@mandate/sdk'

try {
  await mandate.charge(subscriptionId)
} catch (error) {
  const detail = describeMandateError(error)
  showToast(detail.title, detail.message)

  // Compact text is also available:
  console.log(formatMandateError(error))
}
```

`describeMandateError` returns a stable code, title, user-facing message, retryability flag and optional technical diagnostics. The contracts remain the source of truth; this layer only makes rejected transactions understandable.
