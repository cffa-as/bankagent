# Vaultline frontend

Vaultline's Next.js product surface. The homepage presents the product and the `/workspace` route is connected to the Go banking API.

The assistant prepares candidate actions. Risk, confirmation, Action-bound MFA, execution, idempotency, audit and the final receipt remain server-owned.

The homepage presents the 30-second brand film. The full real-API product demo is linked separately.

## Requirements

- Node.js 24.13.0 (pinned in `.nvmrc`)
- pnpm 11
- Apple Silicon users must use an arm64 Node binary; the runtime check rejects x64 Node under Rosetta
- Go backend at `http://localhost:8080`

## Development

```bash
cd frontend
nvm install
nvm use
corepack enable pnpm
pnpm install
pnpm dev
```

Open `http://localhost:3000`. API calls use `/backend/*`; Next.js proxies them to `BANKAGENT_API_PROXY_TARGET`, which defaults to `http://localhost:8080`.

```bash
BANKAGENT_API_PROXY_TARGET=http://localhost:8080 pnpm dev
```

## Verification

```bash
pnpm typecheck
pnpm build
```

The browser uses the synthetic `demo-user-1` identity. The demo MFA code is `000000`; it is test data, never a production credential.

All funds, accounts, cards, subscriptions, simulations and receipts are synthetic. Never replace a server error or pending state with a fabricated success state.

See [BRAND.md](BRAND.md) for visual direction.
