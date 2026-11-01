# Vaultline films

This directory produces two separate deliverables:

- a 30-second cinematic launch film driven by huashu-motion;
- a 3:46 product film captured from the real Next.js frontend and Go API.

## Current output

- `frontend/public/demo/vaultline-launch.mp4` — 30s, 1920×1080, H.264/AAC launch film
- `frontend/public/demo/vaultline-launch-cover.png` — README cover
- `frontend/public/demo/vaultline-launch-poster.png` — player poster
- `frontend/public/demo/vaultline-product.mp4` — 3:46, 1920×1080, H.264/AAC product film
- `frontend/public/demo/vaultline-product-cover.png` — full-demo cover
- `frontend/public/demo/vaultline-product-poster.png` — full-demo still

## 30-second launch film

The editable project is [`huashu-vaultline/`](huashu-vaultline/). Its `treatment.md` contains the selected direction, 112 BPM rhythm sheet, continuity chain, palette and sound plan.

The skill npm package is behind GitHub. Clone the repository and use its local CLI:

```bash
git clone --depth 1 https://github.com/alchaincyf/huashu-motion.git /tmp/huashu-motion
OM=/tmp/huashu-motion/cli/om.js
node "$OM" doctor
node "$OM" sound video/huashu-vaultline
node "$OM" check video/huashu-vaultline
node "$OM" render video/huashu-vaultline --fps 30 --blur --workers 6
node "$OM" qa video/huashu-vaultline
node "$OM" share video/huashu-vaultline
```

The final film uses a composed 112 BPM score, 27 sound-effect hits, real product captures and a 1.2-second huashu-motion signature.

Create the README cover and player poster from the final MP4:

```bash
ffmpeg -ss 3.6 -i video/huashu-vaultline/out/huashu-vaultline-v11.mp4 \
  -frames:v 1 frontend/public/demo/vaultline-launch-poster.png
python3 video/huashu-vaultline/tools/make-cover.py
```

## Full business demo

The long-form film (about 3:46) is a user-facing product story, not a feature checklist:

1. brand open and the problem (menus and long forms);
2. 一句话开始 — the workspace;
3. 看清每一笔 — transactions and spending analysis;
4. 看得见的过程 — the live agent activity (steps stream in, then fold into "处理完成");
5. 理财 · 卡片 · 订阅;
6. 看清未来 30 天 — liquidity preflight;
7. 一步一步来 — the multi-step fund plan;
8. 确认后才执行 — locked business form, confirmation and bank receipt;
9. 高风险，再验证 — action-bound verification code;
10. 越权指令，直接拦截 — prompt-injection resistance;
11. 每一笔都有记录 — operation history;
12. 听得懂 / 看得见 / 守得住 and outro.

Scene order, minimum lengths and camera keyframes live in `src/film-plan.ts`; each scene stretches to fit its narration.

### Pipeline

1. Playwright drives the frontend and records the real browser viewport (1536×864) as WebM.
2. `scripts/record-demo.mjs` stores trim points in `src/timeline.json` after every clip, so `--only a,b` re-records single clips.
3. MiniMax `speech-2.8-hd` (or `generate-narration-edge.py`) generates the Mandarin narration and `src/narration-timing.json`.
4. `pnpm score` synthesizes the ambient music bed (`public/audio/score.wav`, ducked under narration).
5. Remotion adds the browser frame, camera moves, chapter pills, captions and the animated title / agent scenes.

## Requirements

- Apple Silicon with arm64 Node.js 24.13
- pnpm 11
- Google Chrome
- Go backend on `http://localhost:8090`
- MiniMax TTS config containing `tts.api_key`

### Record from a fresh ledger

The yellow/red risk scenes depend on the daily transfer total, so always start from a new database.

Start the backend:

```bash
cd backend
BANKAGENT_ADDR=:8090 \
BANKAGENT_DATABASE=/tmp/vaultline-film.db \
go run ./cmd/bankagent
```

The frontend proxy target is embedded during `next build`. Build and start the production frontend:

```bash
cd frontend
BANKAGENT_API_PROXY_TARGET=http://localhost:8090 pnpm build
pnpm exec next start -p 3001
```

Install video tools and record:

```bash
cd video
pnpm install
pnpm exec playwright install ffmpeg
VAULTLINE_DEMO_URL=http://localhost:3001/workspace pnpm record
```

### Narration and render

Generate all narration segments:

```bash
export MINIMAX_CONFIG=/path/to/config.local.json
python3 scripts/generate-narration.py
```

Render the film and stills:

```bash
pnpm score
pnpm render
pnpm poster
```

`pnpm poster` generates both the player poster and README cover from the current real workspace screenshot.

Open Remotion Studio while editing:

```bash
pnpm dev
```

## Recording rules

- Use synthetic accounts and a fresh local ledger.
- Keep every successful state tied to a real Go API response.
- Never put password, OTP, token, complete account number, or real personal data in frame.
- Preserve enough pause after each result for the narration and viewer to read it.
- Re-record after any material workspace UI change; do not reuse clips from an older design.

## Repository policy

Raw recordings, narration, huashu-motion output and Remotion caches are intentionally ignored. The final launch film and full business demo are committed so GitHub README links and clones remain usable.
