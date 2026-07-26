# Mandate

**User-controlled membership rails for Startale Mini Apps.**

Mandate is an open-source protocol, Mini App and typed developer SDK for memberships, season passes, creator clubs and recurring access on Soneium without unlimited token approvals.

## Live Minato preview

- Network: Soneium Minato — chain ID `1946`
- Protocol: `0x59CCA55ad8F4AEd1460dCd0356c4B682B986b408`
- Test token: `0x5cB83Dfd39205E9A0697BD0a1d51874c481bdC9f`
- Test token label: **Test USDSC** — mock token with no monetary value
- Production target: **Startale USD (USDSC)**

## v0.8 modules

- `apps/miniapp`: Startale-compatible Vite + React Mini App and standalone web application.
- `packages/contracts`: non-upgradeable Solidity protocol, mock test token, deployment scripts and tests.
- `packages/sdk`: typed viem client for plans, subscriptions, access decisions, vaults, settlements, exits and friendly failure decoding.
- `examples/game-pass`: portable paid-access gate for another Mini App.
- `docs/SDK.md`: integration guide and API surface.


## v0.8 hardening

- Persistent Soneium Minato network guard and one-click switch.
- Preflight checks for plan state, token balance, vault balance, duplicate memberships and settlement timing.
- Stable user-facing messages for wallet rejection, RPC failures, ERC-20 failures and MandateProtocol custom errors.
- Safe interface recovery screen for unexpected rendering failures.
- Existing Minato contracts and addresses remain unchanged.

## Product model

A user approves a fixed token amount, deposits only that bounded amount into the protected Mandate vault, and creates a subscription with a charge limit and lifetime spend cap. Merchants receive only due charges. Users can pause or cancel future charges and withdraw every unspent token at any time.

## Developer access gate

```ts
import { MandateClient } from '@mandate/sdk'

const decision = await mandate.checkAccess(subscriptionId, connectedAccount)

if (decision.granted) {
  openPremiumFeature()
}
```

`checkAccess` distinguishes active paid access from an unpaid subscription, expiry, cancellation, completion and subscriber mismatch.

## Safety properties

- No unlimited approval is required.
- The protocol owner cannot move user vault balances.
- Emergency charge pauses never block withdrawals.
- Plan price, interval, token and merchant are immutable after creation.
- Pausing or cancelling future charges does not remove access already paid through.
- The protocol is non-upgradeable.

## Commands

```bash
npm install
npm run typecheck
npm run test
npm run build
```

## Status

Minato testnet software. Not audited. Do not use with assets of real value.
