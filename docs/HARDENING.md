# Mandate v0.8 — Hardening and failure UX

Mandate v0.8 keeps the existing Soneium Minato contracts and strengthens the application and SDK around them. No contract redeployment is required.

## Safety layers

### Network guard

Every write checks for Soneium Minato (chain ID `1946`). A persistent banner offers a one-click network switch before a transaction is prepared.

### Preflight checks

The Mini App checks the most common failure conditions before opening the wallet:

- wallet and network readiness
- plan existence and enabled state
- wallet Test USDSC balance
- token allowance before vault funding
- protected vault balance before subscription creation or settlement
- duplicate active or paused membership for the same plan
- subscription ownership and current state
- settlement due date
- charge count and lifetime cap

The contracts remain the final authority. Preflight checks improve clarity but never replace onchain enforcement.

### Friendly error decoding

`@mandate/sdk` exports `describeMandateError` and `formatMandateError`. Wallet, RPC, ERC-20 and MandateProtocol failures are converted into stable messages such as:

- `Wrong network — switch to Soneium Minato and try again.`
- `Transaction cancelled — no funds moved.`
- `Not enough Test USDSC.`
- `This membership plan is currently paused.`
- `Payment is not due yet.`
- `Only the subscriber wallet can perform this action.`
- `Vault balance is too low.`

Raw technical details remain available through `technicalMessage` for diagnostics, but are not shown by default.

### Safe recovery screen

A React error boundary catches unexpected interface crashes. It does not send a transaction and provides reload and Minato explorer recovery actions.

## Manual failure test matrix

| Scenario | Expected result |
|---|---|
| Wallet on another chain | Minato banner appears; write is blocked until network switch |
| User rejects wallet request | Friendly cancellation message; balances unchanged |
| Wallet lacks Test USDSC | Subscription flow stops before approval or funding |
| Plan paused | New membership and settlement are blocked |
| Duplicate active/paused membership | A second live membership for the same plan is blocked |
| Paused or cancelled membership settlement | Charge button is blocked before wallet request |
| Payment before due date | `Payment is not due yet` |
| Charge cap reached | Settlement is blocked |
| Vault below charge amount | `Vault balance is too low` |
| Wrong subscriber wallet | Subscriber-only action is rejected |
| RPC timeout or disconnect | Retryable network message is shown |

## Regression checks

The following successful flows must remain unchanged:

1. approve a bounded amount
2. fund the protected vault
3. create a membership
4. pause and resume
5. settle a due charge
6. cancel future charges
7. withdraw every unspent token
8. verify paid access through `@mandate/sdk`
