# Vaultline frontend

Vaultline's Next.js product surface. The homepage presents the product and the `/workspace` route is connected to the Go banking API.

The assistant prepares candidate actions. Risk, confirmation, Action-bound MFA, execution, idempotency, audit and the final receipt remain server-owned.

The full real-API product demo is linked separately from the workspace experience.

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
BANKAGENT_API_PROXY_TARGET=http://localhost:8080 \
BANKAGENT_AUTH_TOKEN=demo-user-1 \
pnpm dev
```

## Verification

```bash
pnpm typecheck
pnpm build
```

The `/backend` route is a server-side proxy. It injects `BANKAGENT_AUTH_TOKEN` and does not expose the token to browser code.
Local development defaults to `demo-user-1`; shared environments must use a random token of at least 24 characters. The demo MFA code is `000000`.

All funds, accounts, cards, subscriptions, simulations and receipts are synthetic. Never replace a server error or pending state with a fabricated success state.

See [BRAND.md](BRAND.md) for visual direction.
