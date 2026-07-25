# Threat model

## Protected assets

- User ERC-20 balances deposited in the protocol.
- Integrity of plan terms.
- Integrity of paid access periods.
- User ability to exit.

## Trust assumptions

- The allowlisted ERC-20 behaves like a standard non-rebasing token.
- Soneium consensus and the selected RPC are functioning.
- Startale host wallet correctly presents and signs transactions.

## Explicit guarantees in v0.1

- Owner cannot withdraw user funds because no owner withdrawal function exists.
- Incident pause blocks charges only; it does not block user withdrawals.
- Fee-on-transfer deposits and refunds revert.
- Each subscription has a user-approved charge count and gross spend cap.
- Plan amount, period, merchant and token cannot be changed after creation.
- Merchant cannot charge early or twice within a paid period.
- A public keeper cannot redirect or resize a payment.
- Pausing or cancelling does not erase already paid access.

## Known risks before audit

- Smart-contract implementation risk.
- Malicious or compromised allowlisted token.
- Incorrect metadata shown by an offchain merchant website.
- User approving a plan whose merchant identity they did not verify.
- Keeper downtime delays renewals; it cannot steal funds.
- Shared vault balance is not reserved per subscription, so the user may intentionally withdraw and cause a future charge to fail.

## Required pre-mainnet work

- Independent audit.
- Foundry fuzz and invariant suite.
- Formal review of accounting invariants.
- Token allowlist governance design.
- Monitoring for balance/liability mismatches.
- Production keeper redundancy.
