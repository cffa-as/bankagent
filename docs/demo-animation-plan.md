# Vaultline Demo Animation Plan

> 状态：暂缓，不属于当前代码仓库评审范围。

## 目标

用一段 60–90 秒的产品演示，让观众看懂 Vaultline 的核心边界：模型理解自然语言并提出候选动作，银行服务端负责风险、授权、MFA、执行、幂等、审计和最终业务回执。

所有画面使用合成数据，页面状态必须来自实际 API 响应。

## 推荐制作方式

### 1. 首页品牌 Demo Film + 真实 API 工作台

首页只展示独立的品牌 Demo Film，不把演示脚本做成业务播放器。真实业务继续通过首页的 API 工作台完成；Demo Film 只负责让观众快速理解产品能力。

`请求 → 服务端审查 → 动作快照 → 确认 / MFA → 处理中 → 业务回执`

真实工作台的状态来自服务端响应，演示视频的镜头状态与真实 API 状态完全分离。

Demo Film 使用 GIF / MP4 播放品牌镜头；真实工作台只响应真实 API。动画只响应用户动作或服务端状态变化，不用假进度条代替后端状态。

### 2. README 主视觉：Remotion 生成 MP4

Remotion 适合把 React + TypeScript 组件按时间线渲染成可重复生成的 MP4 或 GIF。它支持在现有项目中安装、用 Agent Skill 创建视频，并提供 Studio、Player 和服务端渲染能力。建议把视频数据和页面数据分开，使用固定的合成事件序列，这样 API 变化不会让 README 视频失效。

建议后续目录：

```text
remotion/
  src/
    Root.tsx
    VaultlineDemo.tsx
    scenarios.ts
  public/
    vaultline-mark.svg
```

第一版只做一个 16:9、60 秒、30 fps 的 MP4；需要在 GitHub README 首屏加载时，再从同一时间线导出 6–10 秒循环 GIF。

### 3. 真实交互录制：Screen Studio 或 OBS

Screen Studio 适合在 macOS 上录制当前前端交互，自动根据点击区域做缩放，并平滑光标、点击效果和镜头运动。它适合制作一条节奏紧凑的“产品已经能用”的视频。

OBS Studio 适合免费录制多窗口、浏览器、终端和旁白。它更适合录制后端日志、前端状态和 API 调试同时出现的工程演示。录制时把后端日志中的 token、真实账户标识和验证码全部隐藏。

Vaultline 的顺序建议是：先用 Remotion 做可控的品牌化主视频，再用 Screen Studio 录一条真实前端交互短片；没有 Screen Studio 时用 OBS 替代。

## 六个演示场景（对齐赛题能力）

| 场景 | 观众要看懂的能力 | 状态路径 | 建议时长 |
| --- | --- | --- | --- |
| 小额转账 | 黄色动作必须显式确认 | 请求 → 风险审查 → awaiting_confirmation → confirm → 服务端回执 | 12 秒 |
| 高风险转账 | 红色动作进入 Action 绑定的 MFA 门 | 请求 → 风险升级 → awaiting_mfa → MFA 验证 → processing / receipt | 15 秒 |
| 余额与账单查询 | 只读查询可以直接返回结果 | 意图 → query_result → Trace | 8 秒 |
| 理财赎回 | 风险动作和最终业务回执分开 | 持仓 → 动作快照 → MFA → 执行 → tool_receipt | 10 秒 |
| 卡片管理 | 冻结、解冻、额度调整进入动作状态机 | 用户请求 → 风险判定 → 确认 / MFA → 状态回执 | 8 秒 |
| 订阅 / 代扣 | 识别周期扣费并提供取消入口 | 订阅查询 → 取消动作 → 服务端回执 | 8 秒 |
| 跨场景联动 | 预算锁定和服务预订拆成可审核工作流 | 生日意图 → 预算 → 子任务 → 审核 / 执行 | 10 秒 |
| 提示注入或篡改 | 模型不能跳过服务端控制 | 恶意指令 → 服务端拒绝 → audit event | 6 秒 |
| 重复确认 | 幂等键阻止重复执行 | 第一次确认 → 重复请求 → idempotency result / conflict | 6 秒 |

第一条 README 视频优先放前三个场景，第二条安全视频再放提示注入和重复确认。这样首屏先讲产品价值，再讲工程可信度。

## 60 秒视频时间线

| 时间 | 画面 | 旁白 / 字幕 |
| --- | --- | --- |
| 0–4 秒 | Vaultline 六边形标识、深墨背景、细钢线网格 | `SECURE BANKING INTELLIGENCE` |
| 4–12 秒 | 输入“转 500 元给王明，备注房租” | 模型理解请求，但只生成候选动作 |
| 12–20 秒 | 服务端风险卡片亮起，显示 risk、Action ID、Trace ID、expires_at | 风险由服务端决定 |
| 20–30 秒 | 黄色确认按钮和不可变快照 | 授权绑定一个 Action ID |
| 30–42 秒 | 切换高风险场景，红色 MFA 门出现 | 敏感动作必须通过银行 MFA |
| 42–50 秒 | 余额查询返回只读结果，旁边显示 Trace | 查询和资金动作使用不同路径 |
| 50–57 秒 | 重复确认被幂等保护，审计事件追加 | 每次请求可追溯、可重放判断 |
| 57–60 秒 | 回到品牌锁定画面，显示合成数据声明 | `MODEL PROPOSES. BANK SERVER DECIDES.` |

## 视觉和动效规则

- 深墨黑、深海军蓝、铂金灰、克制钴蓝；风险状态同时使用文字、图标和颜色。
- 使用固定镜头：状态卡片、Action ID、Trace ID、MFA 门、回执区域是重点，避免镜头跟随每个装饰元素。
- 普通过渡控制在 150–220ms；场景切换可以使用 350–500ms 的淡入和位移。
- 不使用紫蓝渐变、玻璃拟态、霓虹光晕、机器人插画、假思考动画或假进度。
- 每个镜头只突出一个核心变化；字幕不超过两行。
- 视频和网页都显示“合成演示数据”。

## README 展示结构

```markdown
<p align="center">品牌标识 + 一句话定位</p>
<p align="center">构建 / 版本 / License / Next.js / Go 徽章</p>
<p align="center">产品主截图或 6–10 秒 GIF</p>

## Demo

[MP4 或 YouTube 视频]

## Scenarios

小额转账 · 高风险 MFA · 只读查询 · 理财赎回 · 幂等与拒绝

## Security model

模型提议，服务端决定；授权、MFA、执行和回执均由服务端控制。
```

GIF 只用于快速表达“页面怎么动”；MP4 用于完整讲清场景和安全边界。README 不应把 GIF 当成真实业务结果证明。

## 工程约束

- 首页 Demo Film 与真实 API 工作台分离，不新增支付 SDK、真实账户数据或独立后端。
- 所有真实 API 请求继续通过 `frontend/lib/api.ts`，带 Bearer token 和 `Idempotency-Key`。
- `action.status`、`risk_level`、`authorization`、`tool_receipt` 只展示服务端返回值。
- MFA 输入值不能进入日志、审计展示、Remotion props 或视频素材。
- 只有服务端返回 `result` 或 `tool_receipt` 后，视频和页面才能显示业务回执；演示脚本里的回执必须明确标记为 synthetic。

## 参考

- Remotion 文档：<https://www.remotion.dev/docs/>
- OBS Knowledge Base：<https://obsproject.com/kb/>
- Screen Studio 动画：<https://screen.studio/guide/animations>
- Screen Studio 自动缩放：<https://screen.studio/guide/auto-zoom>
