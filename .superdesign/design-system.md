# bankagent Security-Grade Design System

## Product and tone
bankagent is a Chinese-first secure AI banking workspace for smart transfers, bill analysis, and wealth operations. The product should feel like a regulated financial institution's secure professional terminal: serious, exact, discreet, premium, and calm under risk. The visual promise is **the AI prepares; the bank server decides and executes**.

Core path: understand intent → server validation → immutable action snapshot → explicit confirmation or action-bound MFA → server receipt. Use synthetic demo data only. Never invent balances, transactions, yields, success states, or transaction IDs.

Avoid lifestyle fintech, crypto dashboards, hacker/cyberpunk aesthetics, purple AI gradients, neon glows, glassmorphism, oversized blobs, playful pastel palettes, and warm editorial paper themes.

## Palette
- `--navy-950`: #0B1220 — secure shell, primary authority surface.
- `--navy-900`: #111C2E — dark panels and header bands.
- `--ink`: #172235 — primary text on light surfaces.
- `--ink-muted`: #5D6A7D — secondary text.
- `--porcelain`: #F3F5F7 — cool neutral page background.
- `--surface`: #FFFFFF — functional panels and inputs.
- `--steel-100`: #E3E8EE — subtle borders and inactive surfaces.
- `--steel-300`: #B4BFCC — strong structural lines.
- `--cobalt`: #2F67D8 — primary action and selected navigation.
- `--cobalt-soft`: #E8EFFD — information/selected wash.
- `--success`: #1C7A5A — query/validated state only, paired with text and icon.
- `--success-soft`: #E6F3EE.
- `--amber`: #A76500 — explicit confirmation state.
- `--amber-soft`: #FFF3D9.
- `--red`: #B33A36 — MFA/high sensitivity/destructive state.
- `--red-soft`: #FBE9E8.
- `--silver`: #8D99A8 — technical metadata only.

Blue is the product accent. Green, amber, and red are status semantics, never decoration. Status always includes a written label and icon/shape.

## Typography
- Chinese UI/body: `Noto Sans SC`, `PingFang SC`, sans-serif.
- Headings/Latin: `Inter`, `IBM Plex Sans`, or an equivalent neutral grotesk; no decorative serif.
- Amounts, timestamps, IDs, technical labels: `IBM Plex Mono`, `JetBrains Mono`, monospace.
- Page title 32–42px, weight 600; section title 18–22px, weight 600; body 13–15px; technical labels 10–11px with modest tracking.
- Use sentence case and plain Chinese. Technical labels may use concise uppercase Latin where it improves scanning.

## Layout and surfaces
- Desktop baseline 1440px, max content width 1360px, 12-column grid, 20–24px gutters, 28–32px outer margins.
- Header 64px with navy shell, compact logo lockmark, product name, environment badge, session status, and user menu.
- Use a clear light workspace on porcelain background, with one navy authority panel for AI/server context.
- Panels have 1px steel borders, 4–8px radius only where it aids grouping, no heavy shadows. Use navy bands and vertical rules to convey hierarchy.
- Density is professional: enough information for audit and review, with strong alignment and deliberate empty space.
- Use one memorable motif: a thin secure-channel rail connecting user intent, policy checks, action snapshot, and bank receipt.

## Core components
- Header: dark navy authority surface; `演示环境` and `SERVER CONNECTED` are explicit; no fake real-bank branding.
- AI composer: light functional surface with a labeled natural-language request and quick actions `智能转账`, `账单分析`, `理财操作`. Make it clear that the next step is preparing a plan.
- Validation panel: show `服务端校验`, policy result, permission scope, and timestamp. Do not show chain of thought.
- Yellow confirmation panel: amber rule and `需确认` label. Show recipient, amount, note, expiry, risk reason, Action ID and Trace ID. Primary CTA is `确认转账`.
- Red MFA panel: red rule and `需 MFA` label. MFA copy must bind to Action ID and explain why it is required.
- Evidence rail: `风险判定`, `动作快照`, `一次性执行门`, `审计记录`; each has visible state and concise evidence.
- Receipt: only after a server response; label `银行服务回执` and show only returned fields.

## Motion and accessibility
Use 150–220ms transitions for focus, selection, and confirmed state changes. No decorative loops or fake AI progress. Honor `prefers-reduced-motion`. Keep focus rings visible, persistent labels, keyboard navigation, and WCAG AA contrast.

## First screen
Create a polished desktop secure banking workspace in a yellow transfer confirmation state:
- mock user and `演示环境` in the navy header;
- natural-language request `转 500 元给王明，备注房租`;
- validation evidence that the server checked policy and permissions;
- immutable action snapshot for `王明（尾号 8842）`, `¥500.00`, `房租`, `需确认`, expiry `09:42`, Action ID `ACT-7F2A`, Trace ID `TRC-91D4E`;
- controlled CTA `确认转账`, secondary `返回修改意图`;
- visible audit/one-time execution evidence;
- no success receipt while pending;
- all numbers, identities, and account information are synthetic.
