---
name: react-best-practices
description: 按 Vercel Engineering 的 React / Next.js 性能规则编写、评审和重构 bankagent 前端。适用于请求瀑布、Server Component、Bundle、缓存、重复渲染和客户端数据获取问题。
---

# React / Next.js 性能规范

本 Skill 采用 Vercel Engineering 的官方 React Best Practices 作为详细参考：

- `references/AGENTS.md`
- 官方来源：https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices

处理 bankagent 前端时，先阅读详细参考，再结合仓库的安全边界。性能优化不能改变银行动作的授权顺序，也不能让前端替代服务端进行风险、MFA、执行、幂等或审计裁决。

## 优先检查

1. 独立的只读请求是否可以并行，避免请求瀑布。
2. 大型或非首屏组件是否应动态加载。
3. 是否引入了不必要的 barrel import 或客户端依赖。
4. 是否用 `useEffect` 派生状态或处理本应由事件处理函数完成的交互。
5. 是否因为宽泛的状态订阅造成无关组件重复渲染。
6. Server Action 是否像 API 一样校验身份、资源归属和动作权限。
7. 是否把过多数据序列化到 RSC 边界或客户端。

## bankagent 约束

- 查询、审计摘要和通知等无依赖读取可以并行。
- 风险判断、用户确认、MFA、一次性执行门和业务执行必须保持服务端定义的顺序。
- 不为了性能把确认、MFA 和执行合并成一个客户端请求。
- 不把缓存、乐观更新或过渡状态当成业务成功；成功只能来自服务端业务回执。
- 不为 `Promise.all()` 或简单组件优化新增依赖，除非实际代码证明现有实现不足。
- 所有性能改动完成后，继续检查窄屏布局、键盘焦点、错误态、过期态和 `prefers-reduced-motion`。
