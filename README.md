# Mandate

**Safe memberships and recurring access for Startale Mini Apps.**

Mandate is an open-source protocol, Mini App, and developer SDK for selling season passes, memberships, creator clubs, and recurring access on Soneium without unlimited token approvals.

## What is included in v0.1

- `apps/miniapp`: Startale-compatible Vite + React Mini App and standalone website.
- `packages/contracts`: non-upgradeable Solidity protocol, test token, deployment script, and security-focused tests.
- `packages/sdk`: typed viem client and ABI package for other Mini Apps.
- `examples/game-pass`: a tiny integration example.
- `docs`: architecture, product specification, threat model, and milestone plan.
- Startale manifest, embed metadata, and correctly sized placeholder media assets.

## Product model

A user deposits a bounded amount into Mandate, creates a subscription with a spend cap and charge limit, and can pause, cancel, or withdraw remaining funds at any time. A public keeper may trigger a due charge, but the protocol enforces the merchant, token, amount, period, cap, and charge count onchain.

## Important status

This is a **Minato testnet foundation**, not an audited production release. Do not use it with valuable assets before an independent security review.

## Requirements

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

## Run the Mini App

```bash
cp apps/miniapp/.env.example apps/miniapp/.env
npm run dev:miniapp
```

## Test contracts

```bash
npm run test:contracts
```

## Deploy to Soneium Minato

```bash
cp packages/contracts/.env.example packages/contracts/.env
npm run deploy:minato
```

After deployment, copy the printed protocol and token addresses into `apps/miniapp/.env`.

## Startale requirements already represented

- Host wallet via `@startale/app-sdk`
- `sdk.actions.ready()`
- `/.well-known/farcaster.json`
- `fc:miniapp` embed metadata
- Soneium Minato chain ID `1946`
- HTTPS/Cloudflare-ready static build

The manifest contains a placeholder deployment domain. Replace every `mandate-pass.pages.dev` occurrence before validation.

## Repository layout

```text
mandate/
├── apps/miniapp
├── packages/contracts
├── packages/sdk
├── examples/game-pass
└── docs
```

## License

MIT
