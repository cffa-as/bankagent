# MCP 工具边界

当前六个场景由 Go 服务端白名单领域工具直接执行；这个目录只保留未来 MCP 的跨进程边界说明，不宣称当前已有 MCP Server。

如果演示需要拆成独立 MCP Server，服务放在本目录下，必须满足：

- 只暴露结构化工具和输入 Schema，不暴露 SQLite、任意 SQL、Shell 或内部管理接口。
- 由 Go 核心服务注入 `user_id`、`run_id`、`action_id`、`trace_id` 和 `tool_request_id`；模型不能提供这些字段。
- 只读工具超时 5 秒，副作用工具超时 10 秒；资金类工具不自动重试。
- 工具服务只返回结构化 receipt。风险级别、授权、MFA、动作状态、执行门和账本事务仍由 Go 核心服务决定。
- 跨进程传输使用 MCP Streamable HTTP，并使用服务间 Bearer Token；Token 不进入审计正文或前端。

首期单进程演示不启动独立 MCP Server。只有当工具需要独立部署、独立扩缩容或跨语言实现时，才把对应工具迁入这里；这能避免为本地场景增加无收益的网络跳转。
