# Mandate v0.8 build status

## Live protocol

- Network: Soneium Minato (chain ID 1946)
- MandateProtocol: `0x59CCA55ad8F4AEd1460dCd0356c4B682B986b408`
- Test USDSC: `0x5cB83Dfd39205E9A0697BD0a1d51874c481bdC9f`
- Production target asset: Startale USD (USDSC)
- Contract redeployment required for v0.8: **No**

## Completed

- Bounded token approval and protected vault funding
- Onchain subscriptions with immutable plan terms
- Pause, resume and permanent cancellation
- Permissionless due-charge settlement
- User-controlled withdrawal of unspent funds
- Proof Center with explorer links and JSON receipts
- Live merchant plan builder, pause and re-enable
- Typed `@mandate/sdk` v0.8
- Live SDK access-check workbench
- Framework-neutral game-pass integration example
- Standalone injected-wallet and Startale host-wallet transaction surfaces
- Minato network guard and one-click switch
- Preflight balance, plan, subscription and settlement checks
- Friendly wallet, RPC, ERC-20 and protocol error decoding
- Interface crash recovery boundary

## Validation target

GitHub CI must pass:

1. SDK build
2. Mini App TypeScript check
3. Example integration TypeScript check
4. Contract tests
5. Production build

See `docs/HARDENING.md` for the manual failure test matrix.
