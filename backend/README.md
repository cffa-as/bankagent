# Backend

Go HTTP 服务、领域服务、SQLite Mock 账本和集成测试。

```bash
go test ./...
go test -race ./...
go vet ./...
go test -bench BenchmarkBillSummaryHTTP ./internal/httpapi
```

运行服务：

```bash
go run ./cmd/bankagent
```
