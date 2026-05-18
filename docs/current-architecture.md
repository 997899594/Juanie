# Juanie 当前架构入口

这份文档是当前设计入口。`docs/plans/` 只保留历史方案与取舍记录，不作为实现真源。

## 运行时基线

Juanie 采用 Bun-first，但不是 Bun-only：

| 层面 | 基线 | 原因 |
| --- | --- | --- |
| 包管理、测试、本地脚本 | Bun | 仓库脚本、测试与 worker 编译已经围绕 Bun 建模 |
| worker、scheduler、schema-runner | 同一个 Bun runtime 镜像内的编译产物 | 后台任务不依赖 Next standalone server，适合 Bun 主运行时；用 command 区分入口，避免重复镜像 |
| Web 生产服务 | Node 24 LTS + Next standalone | 保持 Next 生产服务的官方 Node server 语义，避免把用户入口压到兼容风险上 |

## 产品主链路

| 链路 | 当前真源 |
| --- | --- |
| 创建/导入项目 | `src/lib/projects/create-project-service.ts` 写项目与步骤，`src/lib/queue/project-init.ts` 编排初始化并承接仍待拆分的配置注入逻辑 |
| 仓库配置注入 | 当前仍由 `src/lib/queue/project-init.ts` 生成并推送 Juanie 管理的 CI 与 `juanie.yaml`，后续应继续拆到领域模块 |
| 环境模型 | `src/lib/db/schema.ts` + `src/lib/environments/*` |
| 预览环境 | `src/lib/environments/preview.ts`、`preview-launch.ts`、`application-set.ts` |
| 发布 | `src/lib/releases/index.ts` 创建 release，`src/lib/queue/release.ts` 推进发布 |
| 部署 | `src/lib/queue/deployment.ts` 执行 workload，`src/lib/releases/orchestration.ts` 续推 release |
| 数据库供应 | `src/lib/databases/provisioning.ts` 是供应与环境变量注入唯一入口 |
| Schema 门禁 | `src/lib/schema-safety/index.ts` 是 API 层入口，内部落到 `schema-management` 与 `releases/schema-gate` |
| 数据库工作台 | `src/lib/database-console/bytebase.ts` 只生成 Bytebase 控制台入口，不参与发布、迁移或 Schema Gate 判定 |
| 运行时同步 | `src/lib/env-sync.ts` 合并并同步环境变量到 Kubernetes |

## 平台依赖

| 能力 | 开源组件 |
| --- | --- |
| GitOps / preview scaffold | Argo CD ApplicationSet |
| 平台自身发布 | GitHub Actions + SSH + Helm |
| 受控放量 | Argo Rollouts |
| 托管 PostgreSQL | CloudNativePG |
| TLS / 证书 | cert-manager |
| 外部密钥能力 | External Secrets Operator |
| Schema diff / control-plane migration | Atlas |
| 数据库可视化工作台 | Bytebase Community（可选，只读优先，不接管发布治理） |
| 后台队列 | BullMQ + Redis |

## 平台自身发布

Juanie 平台自身不再通过 Argo CD GitOps 发布。当前主线是：

1. CI 构建 `web` 和 `runtime` 镜像。
2. CI 上传 `deploy/k8s/charts/juanie` 到服务器。
3. CI 在服务器执行 `helm upgrade --install juanie`，镜像 tag 直接来自当前 commit SHA。
4. `schemaSync.enabled=true` 时，控制面 Atlas 迁移由 Helm pre-upgrade Job 调用 runtime 镜像内的 `schema-runner` 执行。
5. CI 等待 Web / Worker rollout 和 `https://juanie.art/api/health/ready`。

这条链路的真源是 CI run + 镜像 SHA；不再提交 `values-gitops.yaml`，也不再注册 `juanie-platform` Argo CD Application，避免平台自身发布被 Argo repo cache 或代理缓存卡住。
Argo CD 自身由 `deploy/k8s/infrastructure/argocd/values.yaml` 定义 repo-server / controller
资源与 Git 拉取超时，这部分仅服务预览环境脚手架和后续 ApplicationSet。

## 安全与 Trace 基线

| 能力 | 当前设计 |
| --- | --- |
| Secret | Helm 支持 `existingSecret`、内置 Secret 和 ExternalSecret；生产优先使用已有 Secret 或 External Secrets Operator |
| TLS | chart 默认通过 `NODE_EXTRA_CA_CERTS` 信任 ServiceAccount CA；不默认注入 `NODE_TLS_REJECT_UNAUTHORIZED=0`，只有显式打开 `worker/scheduler.insecureSkipTlsVerify` 才会渲染 |
| RBAC | 高风险能力集中在 `rbac.*` 开关，`pods/exec` 默认关闭 |
| 平台临时执行 | 服务探活、schema-runner、迁移派发、预览库克隆统一走 `PlatformOperationJob`；平台账号只需要 `batch/jobs` 创建/删除和 `pods/log` 读取，不开放 `pods/create` |
| 数据库控制台 | Bytebase 默认只作为查询与排障入口；生产 DDL/DML 不从控制台直接放行，仍回到 Juanie 发布、提升或 Schema Repair 流程 |
| Trace | release id 派生稳定 W3C trace id，release/deployment/migration 队列 job 透传同一个 `traceId` 和 `traceparent` |

## 后续重构边界

| 模块 | 正确方向 |
| --- | --- |
| `src/lib/queue/project-init.ts` | 继续把渲染、仓库注入、首发构建、K8s 步骤拆到领域模块；worker 只保留步骤编排 |
| `src/lib/k8s.ts` | 保留读状态、等待、诊断和少量运行态控制；期望态交给 Helm、Argo CD、Argo Rollouts、CloudNativePG |
| `src/components/projects/create-project-form.tsx` | 拆成 wizard 状态、纯 view-model、步骤 section |
| `src/components/projects/EnvironmentsPageClient.tsx` | 拆成环境列表、详情面板、运行态操作、预览创建对话框 |
| Schema 相关模块 | 外部入口统一走 `schema-safety`，不要从 API 层直接拼 `schema-management` 多个子模块 |

## 黄金路径验收

每次大改后至少覆盖：

1. 导入仓库后生成 Juanie 管理配置。
2. staging 首发构建进入 release。
3. preview 可基于远端分支最新提交创建。
4. preview 可提升到 staging。
5. staging 可提升到 production，并在 production release detail 完成放量。
6. 删除项目进入 deleting 状态，后台完成后通过 SSE 从列表消失。
7. 平台自身发布只更新 GitOps 指针，由 Argo CD 完成同步，PreSync Job 先跑控制面迁移。
