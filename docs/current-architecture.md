# Juanie 当前架构入口

这份文档是当前设计入口。`docs/plans/` 只保留历史方案与取舍记录，不作为实现真源。

## 运行时基线

Juanie 采用 Bun-first，但不是 Bun-only：

| 层面 | 基线 | 原因 |
| --- | --- | --- |
| 包管理、测试、本地脚本 | Bun | 仓库脚本、测试与 worker 编译已经围绕 Bun 建模 |
| worker、scheduler、schema-runner | Bun 编译产物 | 后台任务不依赖 Next standalone server，适合 Bun 主运行时 |
| Web 生产服务 | Node 24 LTS + Next standalone | 保持 Next 生产服务的官方 Node server 语义，避免把用户入口压到兼容风险上 |

## 产品主链路

| 链路 | 当前真源 |
| --- | --- |
| 创建/导入项目 | `src/lib/projects/create-project-service.ts` 写项目与步骤，`src/lib/queue/project-init.ts` 只负责编排初始化步骤 |
| 仓库配置注入 | `src/lib/queue/project-init.ts` 生成并推送 Juanie 管理的 CI 与 `juanie.yaml` |
| 环境模型 | `src/lib/db/schema.ts` + `src/lib/environments/*` |
| 预览环境 | `src/lib/environments/preview.ts`、`preview-launch.ts`、`application-set.ts` |
| 发布 | `src/lib/releases/index.ts` 创建 release，`src/lib/queue/release.ts` 推进发布 |
| 部署 | `src/lib/queue/deployment.ts` 执行 workload，`src/lib/releases/orchestration.ts` 续推 release |
| 数据库供应 | `src/lib/databases/provisioning.ts` 是供应与环境变量注入唯一入口 |
| Schema 门禁 | `src/lib/schema-safety/index.ts` 是 API 层入口，内部落到 `schema-management` 与 `releases/schema-gate` |
| 运行时同步 | `src/lib/env-sync.ts` 合并并同步环境变量到 Kubernetes |

## 平台依赖

| 能力 | 开源组件 |
| --- | --- |
| GitOps / preview scaffold | Argo CD ApplicationSet |
| 受控放量 | Argo Rollouts |
| 托管 PostgreSQL | CloudNativePG |
| TLS / 证书 | cert-manager |
| 外部密钥能力 | External Secrets Operator |
| Schema diff / control-plane migration | Atlas |
| 后台队列 | BullMQ + Redis |

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
