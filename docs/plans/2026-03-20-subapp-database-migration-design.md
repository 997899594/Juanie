# 2026-03-20 子应用数据库迁移体系设计

## 背景与问题

Juanie 当前已经具备：

- 项目级数据库资源模型
- 项目级部署与环境模型
- monorepo 子应用识别能力
- 基于 BullMQ 的异步任务处理
- 基于 Kubernetes 的运行时环境

但“子应用数据库迁移”能力仍处于未完成状态，主要问题有：

1. 迁移边界错误
- 当前数据库模型主要按 `projectId` 归属，没有形成稳定的“子应用/服务 -> 数据库”绑定关系。
- 对 monorepo 而言，部署是服务级别的，但数据库迁移还是项目级思路，边界不一致。

2. 迁移来源表达不足
- 当前迁移目录读取逻辑依赖固定路径 `migrations/{databaseType}`。
- 这无法表达 monorepo 中每个子应用独立的 `appDir`、`workingDirectory`、迁移工具和迁移命令。

3. 执行边界过重
- 当前雏形倾向于由平台进程直接连接数据库执行 SQL。
- 这种方式会让 Juanie 长期持有高权限数据库凭证，安全边界和可运维性都较差。

4. 迁移与部署解耦
- 迁移没有被建模为部署过程中的明确阶段。
- 这会导致代码与 schema 漂移，出现“镜像部署成功但数据库未升级”的灰色失败。

5. 可观测性不足
- 缺少迁移运行实体、重试语义、审批语义、锁语义、日志聚合和审计模型。

本设计目标是将数据库迁移升级为：

- 以子应用为边界
- 以声明式配置为输入
- 以部署链路为编排入口
- 以临时执行器为运行边界
- 以平台控制面为审计和可观测中心

## 目标

### 功能目标

1. 每个子应用都可以独立声明自己的数据库迁移配置。
2. 每个环境都拥有独立的迁移执行记录与锁。
3. 数据库迁移可作为部署前置 gate，并阻断不安全发布。
4. 平台支持手工触发、自动触发、重试、审批、历史查询。
5. 支持多迁移引擎并存：`drizzle`、`prisma`、`knex`、`typeorm`、原生 SQL、custom command。

### 非功能目标

1. 不让平台 API 进程长期持有数据库 root 凭证。
2. 迁移执行必须具备幂等调度和并发互斥能力。
3. 迁移执行必须可追踪到用户、环境、部署、提交和日志。
4. 迁移失败必须能清晰阻断部署并给出诊断信息。

## 非目标

1. 不在 Phase 1 支持自动 down migration。
2. 不在 Phase 1 支持所有数据库引擎的原生迁移能力。
3. 不在 Phase 1 做数据库 schema diff 可视化。
4. 不保留“平台进程直接执行任意 SQL”作为主路径。

## 核心设计原则

1. 服务边界优先
- 数据库迁移必须与 `service` 对齐，而不是仅与 `project` 对齐。

2. 声明式优先
- 仓库声明“如何迁移”，平台负责“何时迁移、在哪迁移、如何观测”。

3. 执行器隔离
- 迁移在临时执行器中运行，平台只做调度、状态管理、日志聚合和审计。

4. 部署门禁化
- 迁移是部署流水线的一部分，而不是旁路按钮。

5. 向前兼容优先
- 生产迁移默认遵循 expand-contract，不将自动回滚作为主手段。

## 总体架构

```text
Repository Config (per service migration spec)
  -> Deployment Trigger / Manual Trigger
  -> Juanie API creates migration run
  -> BullMQ dispatches migration job
  -> Worker resolves service + env + database binding
  -> Worker creates ephemeral K8s Job
  -> K8s Job executes declared migration command
  -> Job streams logs / reports status
  -> Success: deployment continues
  -> Failure: deployment blocked
```

### 角色分工

- 仓库
  - 定义迁移目录、工具、命令、工作目录

- Juanie 控制面
  - 决定何时执行
  - 记录迁移计划与结果
  - 处理权限、锁、审批、审计、状态流转

- 临时执行器
  - 真正执行迁移命令
  - 使用短期凭证访问目标数据库

- 目标数据库
  - 保存迁移工具自己的事实表
  - 承担最终 schema 状态

## 数据模型设计

### 1. database 表扩展

当前 `database` 缺少对子应用的明确绑定。建议扩展如下：

```typescript
database {
  id
  projectId
  environmentId
  serviceId nullable

  name
  type
  plan
  provisionType
  scope: 'project' | 'service'
  role: 'primary' | 'readonly' | 'cache' | 'queue' | 'analytics'

  connectionString
  host
  port
  databaseName
  username
  password

  namespace
  serviceName
  status
  createdAt
  updatedAt
}
```

说明：

- 单体项目数据库可设置为 `scope=project`。
- 子应用数据库应设置为 `scope=service` 并绑定 `serviceId`。
- `environmentId` 保持必需语义，用于区分 production / preview / staging。

### 2. 新增 migrationSpecifications 表

用于表达“某服务在某环境对某数据库如何执行迁移”。

```typescript
migrationSpecification {
  id
  projectId
  serviceId
  environmentId
  databaseId

  tool: 'drizzle' | 'prisma' | 'knex' | 'typeorm' | 'sql' | 'custom'
  phase: 'preDeploy' | 'postDeploy' | 'manual'
  autoRun: boolean

  workingDirectory
  migrationPath nullable
  command
  lockStrategy: 'platform' | 'db_advisory'
  compatibility: 'backward_compatible' | 'breaking'
  approvalPolicy: 'auto' | 'manual_in_production'

  createdAt
  updatedAt
}
```

说明：

- `workingDirectory` 明确命令执行目录，如 `apps/api`。
- `migrationPath` 只用于 UI 展示、诊断或 SQL/custom 类型辅助定位，执行主入口仍以 `command` 为准。
- `tool` 用来驱动平台提示、校验和未来扩展。

### 3. 新增 migrationRuns 表

作为平台迁移运行控制面实体。

```typescript
migrationRun {
  id
  projectId
  serviceId
  environmentId
  databaseId
  specificationId
  deploymentId nullable

  triggeredBy: 'deploy' | 'manual' | 'api' | 'webhook'
  triggeredByUserId nullable
  sourceCommitSha nullable
  sourceCommitMessage nullable

  status: 'queued' | 'awaiting_approval' | 'planning' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped'
  runnerType: 'k8s_job' | 'ci_job' | 'worker'
  lockKey

  startedAt nullable
  finishedAt nullable
  durationMs nullable

  appliedCount nullable
  logExcerpt nullable
  logsUrl nullable

  errorCode nullable
  errorMessage nullable

  createdAt
  updatedAt
}
```

### 4. 新增 migrationRunItems 表

用于记录单个文件或单个版本项，便于 UI 展示。

```typescript
migrationRunItem {
  id
  migrationRunId
  name
  checksum nullable
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  startedAt nullable
  finishedAt nullable
  output nullable
  error nullable
  createdAt
}
```

### 5. 与审计系统关系

所有下列行为都必须落 audit log：

- 创建 migration run
- 生产环境审批
- 手工执行
- 手工重试
- 取消执行

## 仓库声明设计

建议扩展 `juanie.yaml`，由服务级配置显式声明迁移能力，而不是平台猜测目录结构。

示例：

```yaml
services:
  - name: api
    type: web
    monorepo:
      appDir: apps/api
    databases:
      - binding: api-primary
        migrate:
          tool: drizzle
          workingDirectory: apps/api
          path: apps/api/drizzle
          command: bun run db:migrate
          phase: preDeploy
          autoRun: true
          lockStrategy: db_advisory
          compatibility: backward_compatible
          approvalPolicy: manual_in_production

  - name: worker
    type: worker
    monorepo:
      appDir: apps/worker

databases:
  - name: api-primary
    type: postgresql
    scope: service
    service: api
    role: primary
    environments:
      production:
        plan: standard
      preview:
        provision: branch-isolated
```

### 设计理由

1. monorepo 目录不是数据库类型能推导出来的。
2. 不同服务可能使用不同迁移工具。
3. 某些服务可能共享库，但命令不同，必须显式声明。
4. 平台未来可以对 `tool` 做校验与智能提示。

## 触发模型

### 1. 部署触发

默认主路径。

触发时序：

```text
Create deployment
  -> Resolve migration specifications for target service + environment
  -> If no migration spec:
       continue deployment
  -> If spec.phase = preDeploy:
       create migration run
       execute migration
       success => continue deployment
       failed => block deployment
  -> If spec.phase = postDeploy:
       deploy first
       run migration after rollout gate
```

推荐默认值：

- 生产环境：`preDeploy`
- preview/staging：`preDeploy`
- `postDeploy` 只允许用户显式选择，且仅适合兼容型场景

### 2. 手工触发

用于下列场景：

- 初始化旧项目
- 修复性重试
- 数据库恢复后补跑
- 非部署时执行维护性迁移

要求：

- 生产环境手工触发默认要求 owner/admin
- `breaking` 迁移需审批

### 3. Webhook / API 触发

仅作为自动化入口，底层统一走 `migrationRun` 模型，不允许旁路执行。

## 执行器设计

### 推荐方案：Kubernetes Job Runner

采用一次性 K8s Job 作为迁移执行器。

Job 职责：

- 拉取目标镜像或专用 runner 镜像
- 设置工作目录
- 注入最小权限数据库凭证
- 执行迁移命令
- 输出结构化日志

示例运行模型：

```text
Worker
  -> create Migration Job manifest
  -> submit Job to project namespace
  -> poll/watch Job status
  -> stream logs
  -> update migrationRun + deployment
  -> cleanup Job on retention policy
```

### 为什么优先 K8s Job

1. 与现有平台运行环境一致。
2. 可以绑定 namespace、serviceAccount、资源限制。
3. 易于实现超时、重试、日志采集。
4. 执行边界清晰，避免平台 API 进程持有长期 DB 权限。

### runner 镜像策略

支持两种模式：

1. 复用应用镜像
- 优点：环境最一致，工具链与应用完全匹配
- 缺点：必须确保镜像中已包含迁移工具

2. 专用 migration runner 镜像
- 优点：更可控
- 缺点：需要维护工具版本一致性

建议：

- Phase 1 优先复用应用镜像
- Phase 2 再补通用 migration runner

## 锁与并发控制

### 双层锁

必须实现双层锁，避免同一数据库并发迁移。

1. 平台锁
- 锁粒度：`databaseId + environmentId`
- 用途：阻止 Juanie 重复调度

2. 数据库锁
- PostgreSQL：`pg_advisory_lock`
- 用途：确保真正执行时串行

### 行为规则

1. 同一数据库同一环境同时只能存在一个 `running/planning/queued` 的 active run。
2. 新 deployment 命中已有 active migration 时：
- 可配置为排队
- 或快速失败并提示“等待当前迁移完成”

建议默认：

- deploy 触发的 migration 采用排队
- manual 触发若遇锁冲突则直接失败，避免误操作

## 部署集成设计

### Deployment 状态机扩展

建议为 deployment 增加或显式化以下阶段：

- `queued`
- `migration_pending`
- `migration_running`
- `migration_failed`
- `deploying`
- `healthy`
- `failed`

### 期望流程

```text
POST /api/projects/[id]/deployments
  -> create deployment (queued)
  -> resolve migration specs
  -> create migration run
  -> deployment -> migration_running
  -> migration success => deployment -> deploying
  -> deployment rollout success => healthy
  -> migration failed => deployment -> migration_failed
```

### 兼容策略

如果某服务没有数据库绑定或没有 migration spec：

- deployment 不进入 migration 阶段
- 直接按原流程执行

## API 设计

### 服务级查询

```text
GET /api/projects/:id/services/:serviceId/databases
GET /api/projects/:id/services/:serviceId/migration-specs
GET /api/projects/:id/services/:serviceId/migration-runs
```

### 迁移执行

```text
POST /api/projects/:id/services/:serviceId/migration-runs
POST /api/projects/:id/migration-runs/:runId/retry
POST /api/projects/:id/migration-runs/:runId/cancel
POST /api/projects/:id/migration-runs/:runId/approve
```

### 部署集成

```text
POST /api/projects/:id/deployments/:depId/migrate
```

说明：

- 不再推荐保留当前 `projects/:id/databases/:dbId/migrations` 作为核心主接口。
- 若为了兼容短期保留，它也应仅作为内部适配层，底层统一转成 `migrationRun`。

## 权限模型

### 权限要求

- 查看历史：团队成员可读
- 手工执行非生产：`owner/admin`
- 手工执行生产：`owner/admin`
- 审批 `breaking` 生产迁移：`owner`
- 重试失败生产迁移：`owner/admin`

### 安全约束

1. 平台不长期保存超级权限凭证。
2. 迁移账号应是最小权限账号。
3. 临时执行器仅在运行期拿到数据库凭证。
4. 所有生产迁移都必须留存审计事件。

## 日志与可观测性

迁移运行必须接入现有日志体系：

- `logger` 记录平台侧阶段事件
- `logger-kv` 记录审计动作
- Job 日志流入 `migrationRun.logExcerpt` 与外部日志系统引用

关键指标：

- migration success rate
- migration duration p50/p95
- blocked deployments count
- approval wait time
- retry success rate

## 失败语义

统一错误码建议：

- `MIGRATION_SPEC_NOT_FOUND`
- `MIGRATION_LOCK_CONFLICT`
- `MIGRATION_APPROVAL_REQUIRED`
- `MIGRATION_RUN_TIMEOUT`
- `MIGRATION_COMMAND_FAILED`
- `MIGRATION_JOB_CREATE_FAILED`
- `MIGRATION_DATABASE_UNREACHABLE`
- `MIGRATION_PERMISSION_DENIED`
- `MIGRATION_UNSUPPORTED_TOOL`

UI 不直接显示底层 provider/DB 原始错误作为主信息，应映射为平台语义并附带原始日志。

## 兼容性与回滚策略

### 迁移设计规范

生产环境默认遵循：

1. expand-contract
2. backward-compatible first
3. 先加字段/索引，再切代码，再删旧结构

### 平台策略

- 不默认自动执行 down migration
- 回滚部署不等于回滚 schema
- 若 `compatibility=breaking`，生产必须审批

## Phase 1 落地范围

### 目标

在不大幅重写现有部署体系的前提下，先交付一个可用、现代、边界正确的最小版本。

### Phase 1 范围

1. 数据模型纠偏
- `database` 增加 `serviceId`、`scope`、`role`
- 新增 `migrationSpecifications`
- 新增 `migrationRuns`
- 可选新增 `migrationRunItems`

2. 配置解析
- 扩展 `juanie.yaml` parser
- 读取服务级 `databases[].migrate`

3. 执行器
- 新建 `src/lib/migrations/runner.ts`
- 使用 K8s Job 执行迁移命令

4. 队列
- 新增 migration queue 或复用 deployment queue 的子阶段编排

5. API
- 新增服务级 migration run API
- 当前数据库级 `/migrations` API 转为兼容入口或删除

6. UI
- 在服务页或部署详情页展示最近迁移状态与历史

7. 仅支持
- PostgreSQL
- `drizzle` / `prisma` / `sql` / `custom`

### Phase 1 非范围

- MySQL/MongoDB 全面支持
- schema drift 检测
- 自动生成 SQL 预览
- 数据库快照与回滚编排

## Phase 2

1. 将 migration run 与 deployment 强绑定
2. 支持审批流
3. 支持 preview 环境 branch-isolated 数据库
4. 支持 richer logs 与实时 SSE 状态
5. 支持 CI runner 模式

## Phase 3

1. drift detection
2. migration plan preview
3. 风险分类与智能拦截
4. 多数据库引擎统一抽象
5. 数据库变更审计报表

## 对现有代码的直接影响

### 建议新增目录

```text
src/lib/migrations/
  index.ts
  resolver.ts
  runner.ts
  locks.ts
  queue.ts
  types.ts

src/app/api/projects/[id]/services/[serviceId]/migration-runs/
src/app/api/projects/[id]/migration-runs/[runId]/
```

### 建议改造的现有模块

1. `src/lib/db/schema.ts`
- 扩展 database 归属模型
- 新增 migration tables

2. `src/lib/config/parser.ts`
- 扩展 `juanie.yaml` schema

3. `src/lib/queue/deployment.ts`
- 将 migration 作为部署阶段之一

4. `src/lib/k8s/`
- 新增 Migration Job builder

5. `src/app/projects/[id]/deployments/page.tsx`
- 展示 migration gate 状态

6. `src/app/projects/[id]/page.tsx`
- 数据库展示下沉为服务级视图，避免只显示项目级 database list

## ADR 结论

### ADR-1：数据库迁移以服务为边界

决策：

- 迁移归属从项目级调整为服务级优先，项目级作为兼容特例保留。

原因：

- monorepo 的部署、目录、数据库依赖和变更触发都天然是服务级。

代价：

- 数据模型与 UI 需要重构。

### ADR-2：迁移执行以临时 K8s Job 为主

决策：

- 平台不再以 API 进程直连数据库执行迁移为主路径。

原因：

- 安全边界更清晰，执行环境更一致，便于限权、审计和重试。

代价：

- 需要新增 Job 编排与日志聚合能力。

### ADR-3：迁移作为部署 gate

决策：

- 数据库迁移成为 deployment pipeline 的显式阶段。

原因：

- 代码发布与 schema 变化必须受同一控制面管理。

代价：

- 部署状态机更复杂，但整体可靠性显著提升。

## 验收标准

1. 任一 monorepo 子应用都可以独立声明迁移目录、工具、命令和数据库绑定。
2. 生产部署若迁移失败，部署必须被阻断并显示明确错误。
3. 同一数据库同一环境不能并发执行两个 migration run。
4. 所有生产迁移都能在平台内查到操作者、提交、日志和结果。
5. 平台主路径不再依赖固定 `migrations/{databaseType}` 目录约定。
