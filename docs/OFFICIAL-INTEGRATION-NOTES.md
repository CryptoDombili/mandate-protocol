# Official integration notes

The codebase follows the currently published Startale architecture:

- Mini Apps are HTTPS web apps running in the Startale App frame.
- They use the host smart account and host approval UI.
- `@startale/app-sdk` supplies the Startale wagmi connector.
- `@farcaster/miniapp-sdk` supplies `sdk.actions.ready()` and frame communication.
- Startale requires a manifest at `/.well-known/farcaster.json` and `fc:miniapp` metadata.
- Soneium Minato has chain ID 1946 and public RPC `https://rpc.minato.soneium.org/`.
- Submission requires verified smart contracts and a passing sandbox flow.

Before submission, re-check package APIs and manifest validation because the SDK and manifest specification are actively developed.
