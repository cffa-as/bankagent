# Backend

Go HTTP 服务、领域服务、SQLite 本地账本和集成测试。

```bash
go test ./...
go test -race ./...
go vet ./...
go test -bench BenchmarkBillSummaryHTTP ./internal/httpapi
```

查询接口：

```text
GET /v1/accounts/{account_id}/balance
GET /v1/accounts/{account_id}/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD&category=food&page=1&page_size=20
GET /v1/accounts/{account_id}/bills/summary?month=YYYY-MM
GET /v1/accounts/{account_id}/bills/summary?year=YYYY
GET /v1/investments/products?risk_level=balanced&page=1&page_size=20
GET /v1/cards
GET /v1/subscriptions?status=active
GET /v1/subscriptions/reminders?days=7
GET /v1/liquidity-simulations/{simulation_id}
GET /v1/workflows/{workflow_id}

动作接口：

POST /v1/transfers
POST /v1/transfer-splits
POST /v1/liquidity-simulations
POST /v1/cards/{card_id}/apply
POST /v1/cards/{card_id}/limit
POST /v1/cards/{card_id}/freeze
POST /v1/cards/{card_id}/unfreeze
POST /v1/cards/{card_id}/lost
POST /v1/cards/{card_id}/unlost
POST /v1/subscriptions/{subscription_id}/cancel

黄色动作使用 `/v1/actions/{action_id}/confirm`；红色动作使用动作绑定的 `/mfa/verify`。预约转账授权后进入 `scheduled`，到点调用 `/trigger`；红色预约动作会生成新的执行 MFA，需要再次 `/mfa/verify` 才能扣款。所有副作用请求都需要 `Idempotency-Key`。
```

运行服务：

```bash
go run ./cmd/bankagent
```

未配置模型时使用确定性规则解析；配置 `BANKAGENT_LLM_BASE_URL`、`BANKAGENT_LLM_API_KEY` 和 `BANKAGENT_LLM_MODEL` 后启用 OpenAI-compatible Adapter。API Key 只放在本地环境变量中。

认证使用服务端 `BANKAGENT_AUTH_TOKEN`，令牌以 SHA-256 摘要保存到 Handler 并用常量时间比较。本地未设置时使用 `demo-user-1`；共享环境必须设置至少 24 位随机值。API 不接受请求体指定用户身份。
