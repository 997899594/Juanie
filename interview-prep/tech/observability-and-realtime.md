# 技术路线：实时与可观测性

## 30 秒版本

Juanie 的长任务体验依赖实时事件。项目初始化、发布、部署、schema repair 和删除清理都应该通过状态落库 +
Redis-backed SSE 推送，让用户看到真实进度，而不是刷新页面猜。

## 为什么 SSE

发布控制平面里很多任务会持续几十秒到几分钟：

- 创建 namespace。
- 触发 CI。
- 等待 image。
- 跑 schema gate。
- 执行 migration。
- 等待 rollout。
- 清理资源。

如果只用 HTTP 返回，用户会不知道平台是否还在工作。SSE 的价值是简单、浏览器原生、适合服务端单向推送。

## 事件类型

| 场景 | 价值 |
| --- | --- |
| 项目初始化 | 展示 validate repository、inject config、namespace、database、DNS 等步骤 |
| Release | 展示 queued、schema gate、migration、deployment、verification、rollout |
| Deployment | 展示 workload 执行和失败 |
| Schema repair | 展示排队、运行、完成、失败 |
| 删除项目 | 删除完成后列表真实移除 |

## Observability

Juanie 可观测性应该围绕 release trace，而不是散落日志：

- Structured logs。
- Audit logs。
- Sentry/Loki hooks。
- Release/deployment/migration trace context。
- AI usage。
- Kubernetes events。
- Schema runner logs。

## 面试深挖

**问：SSE 和轮询怎么取舍？**

SSE 适合实时主体验，轮询可以作为兜底。重要的是状态必须落库，SSE 只是传输层，不是状态真源。

**问：AI 怎么参与可观测性？**

AI 不替代日志系统，而是消费 release/environment/incident evidence，把日志和状态压缩成诊断摘要。
AI 输出本身也要记录 usage、latency、token 和 degraded reason。

**问：如何排查一个 stuck release？**

先看 DB release 状态，再看 queue job，再看 worker logs，再看 schema-runner/deployment/Kubernetes events，
最后看 SSE 是否只是 UI 没收到事件。不要直接根据页面状态猜。

## 代码入口

| 主题 | 文件 |
| --- | --- |
| Deployment SSE | `src/app/api/events/deployments/route.ts` |
| Schema realtime | `src/lib/schema-safety/realtime.ts`, `src/lib/schema-management/realtime.ts` |
| Release events | `src/lib/releases/event-state.ts` |
| Logger | `src/lib/logger/` |
| Trace | `src/lib/trace/context.ts` |
| AI usage | `src/lib/ai/runtime/usage-service.ts` |
