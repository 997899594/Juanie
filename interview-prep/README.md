# Juanie 面试资料总入口

这套资料只描述当前 Juanie。不要沿用旧版部署、旧版模型绑定、旧版分层架构等过期叙事。

Juanie 的核心讲法是：

> Juanie 是一个 AI 原生发布控制平面，围绕项目创建、预览环境、schema safety、
> release orchestration、controlled rollout 和实时诊断，帮助团队把应用更安全地交付到
> Kubernetes。

## 怎么用

如果准备 PM 面试，先读：

1. [共同事实源](./00-project-truth.md)
2. [PM 定位](./pm/positioning.md)
3. [用户场景](./pm/user-scenarios.md)
4. [产品策略](./pm/product-strategy.md)
5. [AI 产品价值](./ai/ai-product-value.md)
6. [PM 问题库](./pm/pm-question-bank.md)

如果准备技术面试，先读：

1. [共同事实源](./00-project-truth.md)
2. [技术架构总览](./tech/architecture-overview.md)
3. [发布控制平面](./tech/release-control-plane.md)
4. [Schema Safety](./tech/schema-safety.md)
5. [AI 技术深挖](./tech/ai-technical-deep-dive.md)
6. [技术问题库](./tech/tech-question-bank.md)

如果面试官重点追问 AI，先读：

1. [AI 平台故事](./ai/ai-platform-story.md)
2. [AI 架构](./ai/ai-architecture.md)
3. [AI 产品价值](./ai/ai-product-value.md)
4. [AI 问题库](./ai/ai-question-bank.md)

如果需要准备真实项目故事，读：

1. [STAR 故事库](./stories/star-stories.md)
2. [NexusNote 发布恢复](./stories/nexusnote-rollout-recovery.md)
3. [Schema 门禁与修复](./stories/schema-gate-and-repair.md)
4. [Preview 现代化](./stories/preview-modernization.md)

## 面试表达原则

每个回答都尽量遵循同一个结构：

1. 先讲用户问题，不先炫技术。
2. 再讲系统边界，区分平台自身发布和用户应用发布。
3. 然后讲状态机、门禁、审计和降级。
4. 最后讲取舍和不足，体现你知道系统还可以继续演进。

AI 相关不要讲成“我们接了一个大模型”。更好的表达是：

> Juanie 把 AI 放在发布控制链路里，让 AI 基于真实 release、environment、schema、
> deployment 和日志证据做结构化判断，再通过任务中心、门禁、修复建议和审计记录进入工程流程。

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
| Realtime | Redis-backed SSE for init, project, release, deployment and schema events |
| Observability | Structured logs, audit logs, Sentry/Loki hooks, release trace context |
| AI | 302.ai provider adapter, plugin runtime, markdown prompts/skills, eval fixtures, task center |

## 代码与文档真源

| 主题 | 入口 |
| --- | --- |
| 当前架构 | `docs/current-architecture.md` |
| 部署边界 | `DEPLOYMENT_ARCHITECTURE.md` |
| 项目初始化 | `src/lib/projects/create-project-service.ts`, `src/lib/queue/project-init.ts` |
| Release 主链 | `src/lib/releases/`, `src/lib/queue/release.ts` |
| Deployment 执行 | `src/lib/queue/deployment.ts` |
| Preview | `src/lib/environments/preview.ts`, `src/lib/environments/application-set.ts` |
| Schema Safety | `src/lib/schema-safety/`, `src/lib/schema-management/` |
| AI 插件 | `src/lib/ai/plugins/` |
| AI prompt/skill | `src/lib/ai/prompts/definitions/`, `src/lib/ai/skills/definitions/` |
| AI eval | `src/lib/ai/evals/` |
| AI task center | `src/lib/ai/tasks/` |

## 可以诚实承认的不足

Juanie 的主链路已经比较完整，但面试里可以诚实讲这些继续优化点：

- `project-init` 仍然承载较多配置注入和初始化编排逻辑，后续应继续领域拆分。
- AI 已经有 plugin、prompt、skill、eval 和 usage 记录，但 marketplace、远程 MCP、写操作审批流仍属于后续阶段。
- Web readiness 主要表达 Web 入口健康，worker、queue、schema-runner 的完整健康还可以做成更统一的运行时画像。
- 成本归因、租户级 quota、AI 输出质量的线上长期评测还可以继续增强。
- E2E 覆盖仍应围绕创建项目、首发、preview、promote、production rollout、删除项目补齐。
