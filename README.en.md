<p align="center">
  <a href="README.md">中文</a> · English
</p>

<h1 align="center">VAULTLINE</h1>

<h3 align="center">Banking starts with a sentence.</h3>

<p align="center">
  A secure AI workspace for real banking operations<br />
  <sub>Understand intent. Govern execution. Prove the outcome.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-MVP-4D72FF?style=flat-square" alt="MVP" />
  <img src="https://img.shields.io/badge/frontend-Next.js%2015-111C2E?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/backend-Go-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/API-OpenAPI%203.1-6BA539?style=flat-square&logo=openapiinitiative&logoColor=white" alt="OpenAPI 3.1" />
  <img src="https://img.shields.io/badge/security-server%20governed-111C2E?style=flat-square" alt="Server governed" />
  <img src="https://img.shields.io/badge/data-synthetic%20only-8A6726?style=flat-square" alt="Synthetic data" />
</p>

<p align="center">
  <a href="#product">Product</a>
  ·
  <a href="#security-model">Security</a>
  ·
  <a href="#product-film">Product film</a>
  ·
  <a href="#quick-start">Quick start</a>
  ·
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <a href="frontend/public/demo/vaultline-preview.mp4">
    <img src="frontend/public/demo/vaultline-preview-cover.png" width="960" alt="Vaultline product preview — real UI and server-controlled transfer flow" />
  </a>
</p>

<p align="center">
  <a href="frontend/public/demo/vaultline-preview.mp4"><strong>▶ Watch the 22-second product preview</strong></a>
  <br />
  <sub>Real UI · Local mock ledger · Synthetic data only</sub>
</p>

> [!NOTE]
> This is a single-scenario test film for validating the real capture, camera, caption, and sound workflow. The complete 3–5 minute film will cover all six banking scenarios and failure paths after the backend stabilizes.

## Product

Vaultline turns natural-language requests into reviewable banking actions. The model prepares a candidate plan; the bank server owns risk classification, authorization, MFA, the one-time execution gate, idempotency, audit, and the final receipt.

The product is designed as a regulated banking control surface, not a generic AI chat interface. A user can express intent, verify an immutable action snapshot, complete the required authorization, and receive a business outcome only when the bank service issues it.

<table>
  <tr>
    <td width="33%" valign="top">
      <sub>01 / UNDERSTAND</sub><br />
      <strong>Express complex intent naturally</strong><br />
      <sub>One workspace replaces deep menus and disconnected banking flows.</sub>
    </td>
    <td width="33%" valign="top">
      <sub>02 / GOVERN</sub><br />
      <strong>Review every action before execution</strong><br />
      <sub>Yellow actions require confirmation; red actions require action-bound MFA.</sub>
    </td>
    <td width="33%" valign="top">
      <sub>03 / PROVE</sub><br />
      <strong>Trust only the business receipt</strong><br />
      <sub>No invented balances, transaction IDs, yields, or successful outcomes.</sub>
    </td>
  </tr>
</table>

<p align="center">
  <code>Natural language</code> → <code>Server risk</code> → <code>Action snapshot</code> → <code>Confirmation / MFA</code> → <code>Server receipt</code>
</p>

## Core capabilities

| Capability | Example request | Server-owned evidence |
| --- | --- | --- |
| **Transfers** | “Transfer CNY 500 to Wang Ming for rent” | Action snapshot, risk level, Action ID, receipt |
| **Bill analysis** | “Where did I spend money this month?” | Category totals, anomaly explanations, Trace ID |
| **Investments** | “Compare conservative products and invest CNY 100” | Product/holding facts, risk class, MFA gate |
| **Card controls** | “Freeze the card ending in 8842” | Card state, authorization path, change history |
| **Subscriptions** | “Find unused subscriptions and cancel them” | Recurring-charge evidence, cancellation snapshot, audit |
| **Cross-scene workflows** | “Plan a birthday with a CNY 1,000 budget” | Child tasks, step-by-step authorization, receipts |
| **Liquidity preflight** | “Will reserving CNY 1,000 affect rent?” | Three cash-flow scenarios, daily curve, minimum balance, and safe budget |

## Security model

> The model may propose a plan. It cannot change permissions, bypass confirmation, open the execution gate, or declare a transaction successful.

| Level | Typical actions | Server control |
| --- | --- | --- |
| **Green** | Balances, transactions, bills, product queries | Execute after intent validation; return server facts only |
| **Yellow** | Small transfers, card freeze, subscription cancellation | Show an immutable action snapshot and wait for explicit confirmation |
| **Red** | Large transfers, card loss, investment purchase/redemption | Require MFA bound to the Action ID, then still enforce the execution gate |

- **Snapshot** — key fields are locked; any change requires a new action and a new authorization.
- **Idempotency** — confirmation and execution use idempotency keys to prevent duplicate side effects.
- **Audit** — decisions, authorization evidence, and receipts are linked by Trace ID with sensitive fields redacted.
- **Failure safety** — cancellation, expiry, MFA failure, insufficient balance, and unknown receipts have explicit states.

## Product film

The current preview demonstrates one complete real flow:

`natural-language request → server risk review → immutable action snapshot → explicit confirmation → server-issued receipt`

The UI is recorded through Playwright from the real Next.js application and Go API. Remotion adds the branded intro, camera movement, bilingual chapters, captions, and outro. Narration uses MiniMax `speech-2.8-hd` with the “Reliable Executive” voice. The test film contains no fabricated interface, fake progress, or invented success state.

The full 3–5 minute film will cover all six capabilities, failure paths, prompt-injection rejection, and audit replay. See the [production plan](docs/demo-video-production.md) and the reusable [video pipeline](video/README.md).

<details>
<summary><strong>Architecture</strong></summary>

<br />

```mermaid
flowchart LR
  U[User] --> W[Next.js workspace]
  W --> API[Go REST API / v1]
  API --> A[Agent orchestration]
  A --> T[Server-approved tools]
  T --> L[(SQLite mock ledger)]
  API --> R[(Audit trace)]
```

| Layer | Implementation |
| --- | --- |
| Product surface | Next.js 15 · TypeScript · responsive safety console |
| API and policy | Go · REST `/v1` · OpenAPI 3.1 |
| Agent boundary | Structured intent + server-approved tools |
| State and evidence | SQLite WAL · transactional ledger · idempotency · audit |

</details>

## Quick start

Requires Go 1.27+, Node.js 20+, and CGO for the SQLite driver.

```bash
git clone https://github.com/cffa-as/bankagent.git
cd bankagent
```

Start the backend:

```bash
cd backend
go test ./...
go run ./cmd/bankagent
```

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>. The demo identity is `Bearer demo-user-1`; the mock MFA code is `000000`.

> [!IMPORTANT]
> This build uses only a local mock banking ledger. It has no real accounts, funds, SMS/biometric authentication, or core-banking integration. All demo data is synthetic.

## Documentation

| Document | Purpose |
| --- | --- |
| [Product requirements](docs/产品需求.md) | Users, scenarios, capabilities, and interaction requirements |
| [High-level design](docs/概要设计.md) | Data model, API, database, and key flows |
| [OpenAPI](docs/openapi.yaml) | Shared machine-readable API contract |
| [Technical design](docs/技术方案.md) | Architecture, security boundaries, acceptance, and risks |
| [Competitive and technical evaluation](docs/竞品评测.md) | Executable metrics, public capability matrix, and reproduction steps |
| [Security self-assessment](docs/安全自评报告.md) | Permission model and known risks |
| [Brand direction](frontend/BRAND.md) | Vaultline visual direction and usage |
| [Video pipeline](video/README.md) | Capture, voiceover, and Remotion rendering workflow |

<p align="center">
  <sub>VAULTLINE · UNDERSTAND INTENT · GOVERN EXECUTION · PROVE THE OUTCOME</sub>
</p>
