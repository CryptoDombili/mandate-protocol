# Mandate product specification

## Positioning

Mandate is not a generic subscription dashboard. It is an ecosystem primitive that gives Startale Mini Apps:

1. Bounded recurring payments.
2. Machine-readable access rights.
3. A shared user control center.
4. A reusable TypeScript integration layer.

## Initial users

- Game studios selling 7/30/90-day season passes.
- Creator Mini Apps selling supporter clubs.
- Builder communities selling access to premium tools or research.

## User promise

Before approval, the user sees:

- exact merchant,
- exact token,
- exact amount per period,
- maximum number of charges,
- lifetime spend cap,
- pause/cancel rights.

No merchant receives arbitrary call authority or access to the user's main smart-account balance.

## Merchant promise

- Plan terms cannot be silently changed.
- Successful charges transfer directly to the merchant.
- Access can be checked with one view call.
- Refunds return to a user-controlled, withdrawable vault balance.

## MVP success criteria

- Working Minato deployment.
- Verified contracts.
- Startale host wallet flow passes sandbox.
- Three demo plans.
- Approve, deposit, subscribe, charge, pause, cancel, refund, withdraw demonstrated.
- At least two external example integrations.
