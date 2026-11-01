# Vaultline Films

This workspace produces the full product demo captured from the real Next.js frontend and Go API.

## Current Output

- `frontend/public/demo/vaultline-product.mp4` — 4:45, 1920×1080, H.264/AAC
- `frontend/public/demo/vaultline-product-poster.png` — full-demo still

## Product Demo

The film leads with the security requirements and keeps the extras short:

1. opening: the hard part is permissioned money movement, not chat;
2. three-tier permission model (green / yellow / red);
3. green balance query, yellow ¥300 transfer with snapshot, receipt and a real 409 replay;
4. red ¥1,800 transfer with action-bound MFA, three failures and lock;
5. prompt-injection rejection, account-level circuit breaker and the audit timeline;
6. recap of the five safety mechanisms;
7. extra: 30-day liquidity preflight (short);
8. complex task: a four-node DAG executed step by step and cancelled mid-plan;
9. coverage of the six banking scenarios;
10. trusted execution passport and closing statement.

Scene order, minimum durations and camera keyframes are defined in `src/film-plan.ts`.

## Pipeline

1. Automated browser recording captures the production frontend and real Go API.
2. The recorder stores clip trim points in `src/timeline.json`.
3. Narration and timing metadata are generated locally.
4. The score and sound bed are generated as local assets.
5. Remotion composes the browser frame, camera movement, chapter titles, captions and brand scenes.
6. The final video is exported as 1920×1080 H.264/AAC.

## Reproduction

Requirements:

- Node.js 24.13+
- pnpm 11
- Google Chrome
- Go and a local synthetic ledger

Start the backend once to create the ledger, stop it, raise the opening balance, then start it again (the tier and circuit-breaker shots depend on a fresh ledger):

```bash
node video/scripts/film-ledger.mjs backend/vaultline-film.db
cd backend
BANKAGENT_ADDR=:8090 \
BANKAGENT_DATABASE=./vaultline-film.db \
go run ./cmd/bankagent
```

Build and start the frontend:

```bash
cd frontend
BANKAGENT_API_PROXY_TARGET=http://localhost:8090 pnpm build
pnpm exec next start -p 3001
```

Record and render:

```bash
cd video
pnpm install
pnpm exec playwright install ffmpeg
VAULTLINE_DEMO_URL=http://localhost:3001/workspace pnpm record
pnpm score
pnpm render
pnpm poster
```

Open Remotion Studio while editing:

```bash
pnpm dev
```

## Recording Rules

- Use synthetic accounts and a fresh local ledger.
- Keep every successful state tied to a real Go API response.
- Never show passwords, verification codes, tokens, complete account numbers or real personal data.
- Preserve enough pause after each result for narration and reading.
- Re-record after a material workspace change; do not reuse outdated UI clips.

Raw recordings, narration audio and temporary render caches remain local. Final films and covers are committed so README links work after cloning.
