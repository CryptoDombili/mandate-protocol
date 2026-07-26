# Mandate game-pass integration

This example shows how another Startale Mini App can gate a premium feature with one read-only Mandate SDK call.

```ts
const decision = await checkGamePass(subscriptionId, connectedAccount)

if (!decision.granted) {
  return showMembershipRequired(decision.reason)
}

return openPremiumTournament()
```

Access is based on the protocol's paid-through timestamp. Pausing or cancelling future charges does not revoke access that has already been paid for; access ends when the paid period expires.

## Files

- `checkAccess.ts`: creates a read-only client and asks Mandate for an access decision.
- `accessGate.ts`: framework-neutral HTTP-style gate.
- `demo.ts`: minimal executable example.
