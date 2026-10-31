# 银行 AI 智能体

面向“人工智能赛道 · 银行 AI 智能体”的参赛项目仓库。

## 文档

- [赛题解析](docs/赛题解析.md)：赛题要求、场景取舍与评审关注点
- [技术方案](docs/技术方案.md)：系统架构、安全设计、验收、风险和决策
- [产品需求](docs/产品需求.md)：用户、场景、功能、业务流程和页面交互
- [概要设计](docs/概要设计.md)：数据结构、API、数据库和关键业务流程
- [OpenAPI](docs/openapi.yaml)：前后端共同遵循的 `/v1` 机器可读契约

## 当前实现

当前已开始普通用户 MVP，使用本地 Mock 银行账本，暂不包含管理员、真实银行接入、真实登录或真实 MFA。已实现：

- 创建会话，提交自然语言消息
- 通过 REST API 查询余额、交易流水、账单汇总、理财产品、卡片和订阅（支持过滤、分页）
- 预置收款人转账：黄色动作确认、红色动作 MFA
- 动作查询、取消、过期和失败状态
- SQLite 事务账本、幂等回放和审计查询
- Bearer 演示身份：`Bearer demo-user-1`
- 演示 MFA 验证码：`000000`

消息接口当前使用受控规则解析，后续再接入 DeepSeek 结构化意图适配器。六个场景的完整覆盖仍按设计文档逐步实现。

## 本地运行

需要 Go 1.27+ 和 CGO（SQLite 驱动）。

```bash
cd backend
go run ./cmd/bankagent
```

可通过环境变量修改监听地址和数据库文件：

```bash
cd backend
BANKAGENT_ADDR=:8080 BANKAGENT_DATABASE=./bankagent.db go run ./cmd/bankagent
```

示例：

```bash
curl -X POST http://localhost:8080/v1/conversations \\
  -H 'Authorization: Bearer demo-user-1' \\
  -H 'Content-Type: application/json' \\
  -d '{}'
```

副作用请求需要 `Idempotency-Key`。转账消息示例：`给张三转300元，备注房租`；黄色动作确认发送 `{}`，红色动作提交 `{"code":"000000"}`。

## 安全边界

模型只负责理解意图和生成候选计划；权限、风险级别、MFA、动作状态、执行门、账本事务和审计由 Go 服务端决定。所有演示数据是本地 Mock 数据，API Key 只允许通过环境变量提供，禁止提交到仓库。
