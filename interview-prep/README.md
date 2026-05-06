# Juanie 面试与讲解入口

这份材料只描述当前 Juanie，不保留旧版 Flux、Gemini、三层服务架构等过期叙事。

## 一句话定位

Juanie 是一个 AI 原生发布控制平面，围绕 release、environment、preview、schema safety 和
controlled rollout 帮团队把应用安全交付到 Kubernetes。

## 当前真实技术栈

| 方向 | 当前事实 |
| --- | --- |
| Web | Next.js 16 App Router, React 19, TypeScript |
| Runtime | Bun-first scripts/workers; Web production uses Node 24 + Next standalone |
| Persistence | PostgreSQL, Drizzle schema authoring, Atlas control-plane migrations |
| Queue | BullMQ + Redis |
| Git | GitHub/GitLab provider abstraction with team integration bindings |
| Kubernetes | `@kubernetes/client-node`, Helm chart, Gateway API-oriented routing helpers |
| Platform CD | GitHub Actions builds `web`/`runtime`; Argo CD syncs Helm from `values-gitops.yaml` |
| Preview | Argo CD ApplicationSet scaffold plus Juanie release state |
| Rollout | Argo Rollouts for controlled production delivery |
| Database ops | CloudNativePG, managed database provisioning, schema-runner, schema safety gates |
| Observability | Structured logs, audit logs, Sentry/Loki hooks, release trace context |
| AI | Release/environment summaries, task center, plugin runtime, eval fixtures |

## 推荐讲法

### 架构面试

- 从两个发布边界讲起：Juanie 自身发布和用户应用发布不能混成一条路径。
- 解释为什么子应用不强制 GitOps：会制造脏历史，且不如控制面状态机实时、可审计。
- 重点讲 release 状态机：schema gate、migration、deployment、verification、controlled rollout。
- 说明 schema safety：Atlas 用于 diff/safety/repair，应用迁移执行仍尊重子应用自己的配置。

### 产品面试

- 用户核心问题不是“会不会部署”，而是发布风险、数据库变更、预览验证和生产放量能否闭环。
- Preview 是需求/PR 级验证环境，不是 staging 的替代品。
- Staging 和 production 默认走提升关系，production 应以受控放量和审批为主。
- AI 的价值是减少排障和判断成本，不是增加一个聊天挂件。

### 工程深挖

- 项目初始化：API 写入项目和步骤，BullMQ worker 执行仓库验证、配置注入、命名空间、数据库、DNS 和首发构建。
- 实时性：长任务通过 Redis-backed SSE 推送，失败时保留轮询兜底。
- 平台自身发布：CI 只移动 GitOps 指针，Argo CD 和 Helm 执行真实同步。
- 数据库：控制面只走 Atlas；子应用迁移由 `juanie.yaml` 声明，平台做门禁、执行、审计和修复建议。
- 安全：团队 binding 替代个人 owner fallback，Secret/TLS/RBAC 走显式基线。

## 仍可诚实承认的不足

- 部分模块仍偏大，尤其 project init、K8s helper、创建项目表单和环境页。
- Web readiness 还不能完全表达 worker/queue/schema-runner 健康。
- 配额、成本归因和更完整策略引擎还在后续阶段。

## 准备路线

1. 先读 `docs/current-architecture.md`。
2. 再读 `DEPLOYMENT_ARCHITECTURE.md`。
3. 对照 `src/lib/releases/` 理解 release 主链。
4. 对照 `src/lib/schema-safety/` 和 `src/lib/schema-management/` 理解 schema safety。
5. 对照 `src/lib/queue/project-init.ts` 理解初始化还需要继续拆分的原因。
