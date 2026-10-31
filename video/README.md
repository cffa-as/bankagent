# Vaultline video pipeline

This directory builds the Vaultline product preview from the real frontend and Go API. It is separate from the application dependencies so recording and rendering tools do not enter the production bundle.

## Current output

- `frontend/public/demo/vaultline-preview.mp4` — 22-second, 1920×1080 H.264 product test film
- `frontend/public/demo/vaultline-preview-cover.png` — README video cover
- `frontend/public/demo/vaultline-preview-poster.png` — clean frame for other materials

The current test film covers one real transfer flow:

`intent → server risk review → action snapshot → explicit confirmation → server receipt`

## Pipeline

1. Playwright drives the production Next.js UI and records the browser viewport as WebM.
2. The recording script writes event timestamps to `public/timeline.json`.
3. MiniMax `speech-2.8-hd` produces the Chinese narration with the selected “Reliable Executive” voice.
4. Remotion adds the brand intro, camera movement, bilingual chapter titles, progress treatment, and outro.
5. Remotion renders the final MP4 and still frames.

The recording and audio files are intentionally ignored. They can be regenerated and should be reviewed before publishing.

## Requirements

- Google Chrome
- Node.js 20+
- Playwright's FFmpeg helper: `npx playwright install ffmpeg`
- A local MiniMax TTS config containing `tts.api_key`
- Go backend on `http://localhost:8080`
- Production frontend on `http://localhost:3001`

Use the same Node architecture for `npm install` and rendering. On Apple Silicon, install and render with an arm64 Node binary.

## Build

Start a fresh mock backend:

```bash
cd backend
BANKAGENT_DATABASE=/tmp/vaultline-video.db go run ./cmd/bankagent
```

Build and start the frontend without the development toolbar:

```bash
cd frontend
npm run build
npm run start -- -p 3001
```

Install the video tools and record the real interaction:

```bash
cd video
npm install
npx playwright install ffmpeg
npm run record
```

Generate narration with the recommended executive voice, render the cover, and render the film:

```bash
export MINIMAX_CONFIG=/path/to/config.local.json
python3 scripts/minimax-tts.py \
  --voice "Chinese (Mandarin)_Reliable_Executive" \
  --text "Vaultline，让银行业务，一句话开始。用户说出转账需求，模型准备候选操作，服务端判定风险并锁定动作快照。确认之后，一次性执行门才允许执行。成功状态和业务回执，只来自银行服务端。" \
  --output public/audio/preview-minimax-executive.mp3
npm run poster
python3 scripts/make-cover.py
npm run render
```

Open Remotion Studio while editing:

```bash
npm run dev
```

## Scene recording rules

- Use synthetic accounts and a fresh mock ledger.
- Record one business action per clip while the film is still being validated.
- Wait long enough after a server response for viewers to read the receipt.
- Never replace a failed server response with a successful UI state.
- Keep passwords, tokens, complete account numbers, and real personal data out of frame.
- Use a real mouse path, real server state, and real response timestamps.

## Production limits

The test film has MiniMax TTS narration but only one scenario, no licensed music, and no final sound mix. The 3–5 minute release should add the remaining business scenarios, negative security paths, human-reviewed narration, loudness normalization, captions, and the selected logo direction.
