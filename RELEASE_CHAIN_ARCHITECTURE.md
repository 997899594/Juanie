# Juanie Release Chain Architecture

Updated: 2026-04-02

## 1. 目标

Juanie 现在有两条必须分开的发布链路：

1. 平台自身发布链路
2. 平台托管子应用发布链路

这两条链路不能再混用。

平台自身是控制面，目标是：

- 平台升级时不把坏版本直接污染线上
- 失败时能尽量自动回退
- CI 日志必须能暴露真实根因，而不是只剩 SSH `255`

子应用是被平台管理的业务工作负载，目标是：

- 仓库 CI 只负责构建镜像和触发 release
- 迁移、部署、验证、流量切换由 Juanie 控制
- release 的最终状态以平台状态机为准，不以仓库 CI 的单个 shell 命令为准

## 2. 总体分层

### 2.1 平台自身

GitHub Actions -> SSH 到服务器 -> Schema Sync Job -> Helm Upgrade -> Rollout Wait -> 健康恢复

关键文件：

- [`.github/workflows/ci.yml`](/Users/findbiao/projects/Juanie/.github/workflows/ci.yml)
- [`deploy/k8s/charts/juanie/templates/deployment.yaml`](/Users/findbiao/projects/Juanie/deploy/k8s/charts/juanie/templates/deployment.yaml)
- [`deploy/k8s/charts/juanie/values-prod.yaml`](/Users/findbiao/projects/Juanie/deploy/k8s/charts/juanie/values-prod.yaml)

### 2.2 子应用

Child App CI -> `POST /api/releases` -> `release` queue -> pre-deploy migrations -> deployment queue -> workload verify / route update -> post-deploy migrations -> release terminal status

关键文件：

- [`src/app/api/releases/route.ts`](/Users/findbiao/projects/Juanie/src/app/api/releases/route.ts)
- [`src/app/api/releases/[releaseId]/status/route.ts`](/Users/findbiao/projects/Juanie/src/app/api/releases/[releaseId]/status/route.ts)
- [`src/lib/releases/index.ts`](/Users/findbiao/projects/Juanie/src/lib/releases/index.ts)
- [`src/lib/releases/orchestration.ts`](/Users/findbiao/projects/Juanie/src/lib/releases/orchestration.ts)
- [`src/lib/queue/release.ts`](/Users/findbiao/projects/Juanie/src/lib/queue/release.ts)
- [`src/lib/queue/deployment.ts`](/Users/findbiao/projects/Juanie/src/lib/queue/deployment.ts)
- [`src/lib/queue/deployment-executor.ts`](/Users/findbiao/projects/Juanie/src/lib/queue/deployment-executor.ts)
- [`src/lib/migrations/runner.ts`](/Users/findbiao/projects/Juanie/src/lib/migrations/runner.ts)

## 3. 平台自身发布链路

### 3.1 顺序

1. `quality`
2. `build`
3. `deploy`

`deploy` 内部顺序：

1. 配置 SSH 与 keepalive
2. 上传 Helm chart 到服务器
3. 同步 `ghcr-pull-secret`
4. 创建 schema sync job
5. 等待 schema sync job 完成
6. `helm upgrade --install`
7. 等待 `juanie-web` rollout
8. 等待 `juanie-worker` rollout
9. 等待 `juanie-scheduler` rollout
10. 任一 rollout 失败则打印 deployment / pod / event 诊断并尝试 `helm rollback`

### 3.2 当前约束

- 平台 Secret 默认走集群现有 `juanie-secret`
- chart 不再依赖仓库内真实敏感默认值
- 控制面拆成 `web / worker / scheduler` 三个职责
  - `web`: 只提供 API / UI，对外接流量
  - `worker`: 只消费 BullMQ 队列
  - `scheduler`: 只跑周期治理任务（drift detection / preview cleanup / infra remediation / history retention）
- `web` 与 `worker` 在生产环境使用更保守的 rolling update
  - `maxSurge: 1`
  - `maxUnavailable: 0`
- `scheduler` 使用单副本 `Recreate`
- 生产环境当前副本策略：
  - `web: 2`
  - `worker: 1`
  - `scheduler: 1`

### 3.3 当前探针语义

- `/api/health/live`: 只代表进程活着
- `/api/health/startup`: 只代表容器已启动
- `/api/health/ready`: 代表当前实例可接流量

关键文件：

- [`src/app/api/health/route.ts`](/Users/findbiao/projects/Juanie/src/app/api/health/route.ts)
- [`src/app/api/health/live/route.ts`](/Users/findbiao/projects/Juanie/src/app/api/health/live/route.ts)
- [`src/app/api/health/ready/route.ts`](/Users/findbiao/projects/Juanie/src/app/api/health/ready/route.ts)
- [`src/app/api/health/startup/route.ts`](/Users/findbiao/projects/Juanie/src/app/api/health/startup/route.ts)

## 4. 子应用发布链路

### 4.1 入口

子应用仓库 CI 在镜像构建完成后调用：

- `POST /api/releases`

请求必须带 Bearer token。

Juanie 会校验：

1. token 存在
2. token 对目标仓库有访问权
3. 仓库已在 Juanie 内登记
4. 仓库已绑定 project

从 2026-04-02 开始，Juanie 生成的 GitHub / GitLab CI 模板默认不会在 `POST /api/releases` 后立即结束，而是会继续轮询：

- `GET /api/releases/{releaseId}/status`

直到 release 进入 terminal status。

这意味着：

- 仓库 CI 的成功，代表平台 release 最终成功
- 仓库 CI 的失败，代表平台 release 最终失败或超时
- 新项目默认不会再出现“CI 绿了，但平台里的 release 其实还没完成”的旧链路问题

### 4.2 release 创建

`createRepositoryRelease()` 负责：

1. 按仓库找到 project
2. 按 `ref` 解析 environment
3. 如有必要自动解析 preview environment
4. 解析本次 release 的 service artifacts
5. 落库 `releases` + `releaseArtifacts`
6. 投递 `release` queue

### 4.3 release 编排

`release` worker 的主顺序：

1. `planning`
2. `migration_pre_running`
3. pre-deploy migration runs
4. `deploying`
5. 为每个 artifact 创建或复用 deployment record
6. 投递 `deployment` queue
7. 等待 deployment terminal status
8. 如需 progressive rollout，则进入 `awaiting_rollout`
9. 否则继续 post-deploy migration
10. 最终进入 `succeeded / degraded / failed / verification_failed / rolled_back`

## 5. migration 链路

每个 migration run 由平台创建 K8s Job 执行。

当前模型：

- pre-deploy migration 在业务 deployment 前执行
- post-deploy migration 在业务 deployment 成功后执行
- migration 本身有独立的错误码、事件归因和日志摘录

平台会归因的典型问题：

- `FailedScheduling`
- `ImagePullBackOff`
- `ErrImagePull`
- `CrashLoopBackOff`
- image pull secret 不可用
- migration startup / execution timeout

这部分的真实来源是 K8s pod + event，不再只是 shell 命令文本。

## 6. deployment 链路

### 6.1 单个 deployment 的职责

`deployment` worker 不直接代表整次 release，只负责一个 service 的一次部署尝试。

核心步骤：

1. 同步 runtime contract
2. 同步 environment env vars 与 service env vars
3. 保证环境 scaffold 与域名存在
4. 确定目标镜像
5. 保证 GHCR image pull access
6. 根据策略部署 stable 或 candidate workload
7. 验证 candidate 可达性
8. 直接 promote，或进入 progressive traffic

### 6.2 流量策略

当前支持：

- `rolling`
- `controlled`
- `canary`
- `blue_green`

行为规则：

- 非 progressive，或没有 stable，或不需要先切流量验证时：
  - candidate 验证通过后直接 promote 为 stable
- progressive 且已有 stable 时：
  - 更新 HTTPRoute backend weights
  - release 进入 `awaiting_rollout`

关键文件：

- [`src/lib/releases/workloads.ts`](/Users/findbiao/projects/Juanie/src/lib/releases/workloads.ts)
- [`src/lib/releases/traffic.ts`](/Users/findbiao/projects/Juanie/src/lib/releases/traffic.ts)

## 7. 回滚与失败原则

### 7.1 平台自身

平台自身部署失败时：

- 先输出 deployment / pod / event 诊断
- 然后尝试 `helm rollback` 到上一 revision

### 7.2 子应用

子应用 deployment 失败时：

- deployment 记录进入 terminal failed state
- candidate workload 会尽量被清理
- release 状态机根据 deployment terminal status 决定 release 最终状态
- verification failed 不会被当成可重试成功

### 7.3 不允许的旧行为

以下思路现在都应视为错误：

- 只看子应用仓库 CI `202 Accepted` 就认为发布成功
- 平台 release API 允许匿名触发
- 平台自身单副本且 `maxUnavailable=1`
- 将 liveness / readiness / startup 混成一个端点
- 失败时只看 SSH 退出码，不看 K8s workload 真实状态

## 8. 当前确定的系统边界

1. 平台自身发布与子应用发布是两套链路，不混用
2. 子应用 CI 负责“构建并通知”，平台负责“迁移、部署、验证、流量”
3. release 的真实完成条件必须由 Juanie 状态机给出
4. migration 是 release 的一等阶段，不是额外脚本
5. progressive rollout 的切流是平台控制面能力，不是仓库 CI 逻辑

## 9. 当前仍需持续治理的方向

1. `worker` 如需扩到多副本，现在已经没有重复跑周期治理任务的问题，但仍应根据队列并发与资源占用独立评估
2. 平台 Secret 注入还应进一步统一成集群密钥管理，而不是 chart fallback
3. 需要继续增强 infra signals 对 K8s 事件的产品化翻译
4. `awaiting_rollout` 的人工推进和自动总结还可以继续做强

## 10. 2026-04-02 本轮收口

本轮已经完成的关键修复：

- 修复 release API 动态路由冲突导致的 `juanie-web` 启动失败
- 修复健康探针语义
- 修复 release API 匿名鉴权旁路
- 修复 rollout 诊断 pod selector
- 修复平台自身 deploy SSH 长时间等待后只报 `255` 的问题
- 增加 deploy 失败后的自动 rollback 尝试
- 将平台 chart 从“仓库内真实敏感值”切回“集群现有 secret”

实测结果：

- `Run 268` 已通过
- `https://juanie.art/api/health/ready` 已恢复 `200 healthy`
