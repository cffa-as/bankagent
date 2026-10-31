<p align="center">
  <img src="frontend/public/vaultline-mark.svg" width="72" alt="Vaultline" />
</p>

<h1 align="center">VAULTLINE</h1>

<h3 align="center">让银行业务，一句话开始。</h3>

<p align="center">
  面向真实银行业务的安全 AI 工作台<br />
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
  <a href="#security-model">Security model</a>
  ·
  <a href="#demo-film">Demo film</a>
  ·
  <a href="#quick-start">Quick start</a>
  ·
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <a href="frontend/public/demo/vaultline-demo.gif">
    <img src="frontend/public/demo/vaultline-demo.gif" width="960" alt="Vaultline product film: six banking capabilities and the server-owned security path" />
  </a>
</p>

<p align="center">
  <sub>8 SCENES · 6 BANKING CAPABILITIES · SERVER-OWNED EXECUTION · SYNTHETIC DATA ONLY</sub>
</p>

## Product

Vaultline 把自然语言请求转化为可审查的银行动作。模型负责理解意图、提取实体和准备候选计划；风险分级、用户确认、MFA、执行门、幂等、审计和最终回执始终由银行服务端掌握。

<table>
  <tr>
    <td width="33%" valign="top">
      <sub>01 / UNDERSTAND</sub><br />
      <strong>一句话表达复杂需求</strong><br />
      <sub>转账、账单、理财、卡片、订阅和跨场景工作流进入同一个入口。</sub>
    </td>
    <td width="33%" valign="top">
      <sub>02 / GOVERN</sub><br />
      <strong>每笔动作先审查再执行</strong><br />
      <sub>关键字段锁定为动作快照；黄色确认，红色 MFA，均绑定 Action ID。</sub>
    </td>
    <td width="33%" valign="top">
      <sub>03 / PROVE</sub><br />
      <strong>最终结果只认业务回执</strong><br />
      <sub>页面不伪造余额、交易号或收益；状态变化均可关联 Trace ID。</sub>
    </td>
  </tr>
</table>

<p align="center">
  <code>Natural language</code> → <code>Server risk</code> → <code>Action snapshot</code> → <code>Confirmation / MFA</code> → <code>Server receipt</code>
</p>

## Core capabilities

| 业务能力 | 用户可以直接说 | 服务端必须给出 |
| --- | --- | --- |
| **智能转账** | “转 500 元给王明，备注房租” | 动作快照、风险等级、Action ID、执行回执 |
| **账单分析** | “看看这个月钱花在哪了” | 分类统计、异常交易解释、Trace ID |
| **理财操作** | “比较稳健型产品，赎回 1 万” | 产品/持仓事实、风险评估、MFA 执行门 |
| **卡片管理** | “冻结尾号 8842 的卡” | 卡片状态、授权路径、变更记录 |
| **订阅 / 代扣** | “找出不用的订阅并取消” | 周期扣费证据、取消快照、可审计结果 |
| **跨场景联动** | “预算 1000 元安排爱人生日” | 子任务工作流、逐项授权、服务回执 |

## Security model

> 模型可以提出计划，但不能修改权限、绕过确认、开启执行门，也不能宣布交易成功。

| 等级 | 典型动作 | 服务端控制 |
| --- | --- | --- |
| **Green** | 余额、流水、账单、产品查询 | 意图确认后自动执行；只返回服务端事实 |
| **Yellow** | 小额转账、订阅取消、虚拟卡申请 | 展示不可静默修改的动作快照，等待显式确认 |
| **Red** | 大额转账、卡片挂失、理财申购/赎回 | 必须通过绑定 Action ID 的 MFA；通过后仍需执行门 |

- **Snapshot**：金额、收款人、产品等关键字段锁定；变化必须创建新动作并重新授权。
- **Idempotency**：确认与执行支持幂等键，同一请求只能产生一次副作用。
- **Audit**：决策链、授权证据和业务回执通过 Trace ID 关联，敏感字段脱敏。
- **Failure-safe**：取消、过期、MFA 失败、余额不足和未知回执都有明确状态，不盲目重试。

## Demo film

上方 GIF 是首页使用的 8 场景快速演示，覆盖智能转账、账单分析、理财、卡片、订阅、跨场景联动、安全拒绝和业务回执。

完整的 3–5 分钟产品视频将使用真实前端操作录制，并由 Remotion 统一品牌片头、章节标题、动作快照和字幕。制作脚本与工具选型见 [产品演示视频方案](docs/demo-video-production.md)。

<details>
<summary><strong>Architecture and repository map</strong></summary>

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

需要 Go 1.27+、Node.js 20+ 和 CGO（SQLite 驱动）。

```bash
git clone https://github.com/cffa-as/bankagent.git
cd bankagent
```

启动后端：

```bash
cd backend
go test ./...
go run ./cmd/bankagent
```

另开终端启动前端：

```bash
cd frontend
npm install
npm run dev
```

打开 <http://localhost:3000>。演示身份为 `Bearer demo-user-1`，演示 MFA 验证码为 `000000`。

> [!IMPORTANT]
> 当前版本只连接本地 Mock 银行账本。没有真实账户、真实资金、真实短信/人脸认证或银行核心系统接入；所有演示数据均为合成数据。

## Documentation

| Document | Purpose |
| --- | --- |
| [产品需求](docs/产品需求.md) | 用户、场景、功能和交互要求 |
| [概要设计](docs/概要设计.md) | 数据模型、API、数据库和关键流程 |
| [OpenAPI](docs/openapi.yaml) | 前后端共同遵循的机器可读契约 |
| [技术方案](docs/技术方案.md) | 架构、安全边界、验收和风险 |
| [安全自评报告](docs/安全自评报告.md) | 权限分级实现说明与已知风险 |
| [品牌规范](frontend/BRAND.md) | Vaultline 视觉方向、标识和用色 |

<p align="center">
  <sub>VAULTLINE · SECURE BANKING INTELLIGENCE FOR A WORLD THAT CHECKS TWICE.</sub>
</p>
