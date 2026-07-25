# Architecture

```text
Startale App host wallet
        │
        ▼
Mandate Mini App ─────────────── Merchant Studio
        │                              │
        ├──────── @mandate/sdk ────────┤
        │                              │
        ▼                              ▼
                MandateProtocol
                ├─ token allowlist
                ├─ user vault ledger
                ├─ immutable plans
                ├─ bounded subscriptions
                ├─ permissionless charge trigger
                ├─ access expiry
                └─ merchant-funded refunds
                         │
                         ▼
                  Soneium Minato
```

## Why a vault in v0.1

Startale Mini Apps use the host-managed smart account. The lower-level AA SDK supports custom smart sessions, but a third-party Mini App should not assume it can install arbitrary session modules into the Startale App-managed account. A bounded vault creates an independent, demonstrably safe recurring-payment model without relying on a private API or special account permission.

## Keeper model

`charge(subscriptionId)` is permissionless. A backend, merchant, user, or community keeper can call it. The caller has no discretion over recipient, token, amount, timing, charge count, or spend cap.

## Upgrade policy

The initial protocol is deliberately non-upgradeable. Plan terms are immutable and there is no owner withdrawal function. A future protocol version should be deployed separately and users should migrate voluntarily.
