# Backend

Go HTTP 服务、领域服务、SQLite Mock 账本和集成测试。

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
GET /v1/investments/products?risk_level=balanced&page=1&page_size=20
GET /v1/cards
GET /v1/subscriptions?status=active

自然语言消息支持演示动作：冻结/解冻卡片、取消预置订阅；确认动作统一使用 `/v1/actions/{action_id}/confirm`。
```

运行服务：

```bash
go run ./cmd/bankagent
```
