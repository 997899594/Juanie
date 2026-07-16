# Juanie 共同事实源

这份文档是 PM、技术和 AI 面试的共同底座。任何讲法都应该先和这里对齐。

## 30 秒版本

Juanie 是一个 AI 原生发布控制平面。它不是单纯的 CI/CD 面板，而是把项目创建、环境、
数据库、schema safety、预览、发布、验证、生产放量和 AI 诊断统一到一个可审计状态机里。

它解决的问题是：团队不是不会部署，而是不敢确定“这次能不能安全上线”。特别是数据库变更、
预览环境、生产放量、失败排障和跨环境提升，很容易散在 CI、Kubernetes、数据库脚本和聊天记录里。
Juanie 把这些变成平台层的主流程。

## 3 分钟版本

Juanie 有两条必须分清的发布边界：

1. Juanie 自身发布，也就是平台控制面怎么上线。
2. Juanie 管理用户应用发布，也就是子应用怎么创建、构建、部署、迁移、验证和放量。

平台自身发布走 GitHub Actions + Argo CD + Helm。CI 负责质量检查和构建镜像，然后更新
`values-gitops.yaml` 里的镜像指针。Argo CD 负责同步 Helm chart，PreSync Job 负责用
runtime 镜像里的 schema-runner 执行控制面 Atlas 迁移。

用户应用发布不走平台自身 GitOps 主链。用户应用的 CI 构建 artifact，并调用 Juanie API。
Juanie 创建 release，解析目标环境策略，执行 schema gate、迁移、部署、验证和 production
controlled rollout。这样做的原因是子应用每次发布都改 GitOps 仓库会制造脏历史，也不如控制面
状态机实时、可审计、可与 AI 和任务中心联动。

## 当前系统边界

| 边界 | 当前设计 |
| --- | --- |
| 平台自身发布 | CI build images -> update GitOps pointer -> Argo CD sync -> Helm -> PreSync Atlas |
| 用户应用发布 | App CI build image -> call Juanie API -> release state machine |
| 控制面 schema | Drizzle 负责建模，Atlas 是唯一活跃迁移执行器 |
| 子应用 schema | Atlas 做 diff/safety/repair，实际迁移执行尊重 `juanie.yml` 声明 |
| Preview | 基于远端分支最新 commit 创建，ApplicationSet 管 scaffold，release 状态机管发布 |
| Staging | 默认作为持续验证环境，接收直接发布或从 preview 提升 |
| Production | 默认通过 staging 提升，并可以进入受控放量 |
| AI | 基于真实证据做 release/environment/schema/incident 分析，结果进入任务中心和审计 |

## 为什么不是普通 PaaS

普通 PaaS 更强调“部署资源”。Juanie 更强调“发布决策”：

- 这次发布来自哪个 commit？
- 目标环境当前是什么版本？
- 数据库 schema 有什么风险？
- 迁移是否已经执行？
- Preview 能否直接基于分支最新提交创建？
- Production 是否应该全量、暂停、回滚、还是继续放量？
- AI 的判断依据是什么，能否审计，能否复现？

这就是“控制平面”的意义：不是替你写一个 kubectl wrapper，而是把发布过程中的事实、
状态、策略和行动统一建模。

## 核心取舍

| 取舍 | 为什么这样做 |
| --- | --- |
| 平台自身用 GitOps，子应用发布不用强制 GitOps | 平台自身需要声明式稳定交付；子应用发布需要实时状态机、审计、门禁和可提升关系 |
| Drizzle + Atlas | Drizzle 对 TypeScript 友好，Atlas 更适合迁移校验、hash、diff 和执行 |
| Worker + BullMQ | 长任务不能绑在 HTTP 请求上，发布和初始化需要可重试、可观测、可恢复 |
| SSE | 用户需要实时看到创建、发布、schema 修复进度，不应该靠刷新页面猜 |
| AI plugin runtime | AI 能力需要权限、scope、prompt 版本、usage 审计，不能散落成页面里的 prompt 调用 |

## 常见误区

- 不要说“Juanie 就是 CI/CD”。更准确是“release control plane”。
- 不要说“所有发布都 GitOps”。当前设计是平台自身 GitOps，用户应用 release-state-machine。
- 不要说“Atlas 替用户应用执行所有 ORM 迁移”。Atlas 负责 diff/safety/repair，执行仍看配置。
- 不要说“AI 是聊天机器人”。AI 是发布证据、风险判断、修复建议和任务中心的一部分。
- 不要把 preview、staging、production 混成同一种环境。preview 是需求级，staging/production 是持久环境。

## 代码入口

| 主题 | 文件 |
| --- | --- |
| 当前架构说明 | `docs/current-architecture.md` |
| 部署边界 | `DEPLOYMENT_ARCHITECTURE.md` |
| Release 创建 | `src/lib/releases/index.ts` |
| Release 编排 | `src/lib/releases/orchestration.ts`, `src/lib/queue/release.ts` |
| Deployment 执行 | `src/lib/queue/deployment.ts` |
| Schema 门禁 | `src/lib/releases/schema-gate.ts`, `src/lib/schema-safety/index.ts` |
| Preview | `src/lib/environments/preview-launch.ts`, `src/lib/environments/application-set.ts` |
| AI 插件 | `src/lib/ai/plugins/builtins.ts` |
| AI 运行审计 | `src/lib/ai/runtime/usage-service.ts` |
