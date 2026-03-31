# 2026-03-31 Release State Machine Modernization

## 结论

当前发布链路已经从“资源 apply 成功即算成功”升级为“迁移成功 + rollout ready + 服务校验成功”才算成功，但在渐进式发布场景下仍有一个关键语义缺口：

- `controlled / canary / blue_green` 的 candidate 就绪后，release 过早进入成功语义
- `postDeploy` 迁移可能在正式放量前执行
- 失败被压扁为 `failed`，平台无法明确告诉用户是部署失败、校验失败，还是仍在等待放量

这次改造把它收敛为一个更现代、更正确的状态机。

## 新状态机

### Rolling

1. `queued`
2. `planning`
3. `migration_pre_running`
4. `deploying`
5. `verifying`
6. `migration_post_running`
7. `succeeded`

### Progressive

1. `queued`
2. `planning`
3. `migration_pre_running`
4. `deploying`
5. `awaiting_rollout`
6. 人工完成 rollout
7. `verifying`
8. `migration_post_running`
9. `succeeded`

### Failure semantics

- `migration_pre_failed`
  前置迁移失败，发布不会继续
- `verification_failed`
  镜像已经部署，但运行态校验失败，平台不会记为成功
- `degraded`
  主链路已完成，但后置迁移失败
- `failed`
  其他部署阶段失败

## 关键设计决策

### 1. 首次 progressive 发布不再无意义地卡在 rollout

如果环境还没有 stable workload，就没有“切流”的对象。此时平台直接把首个版本部署到 stable，并跑完整个 release 闭环，而不是制造一个永远待切换的 candidate。

### 2. rollout 是 release 的正式阶段，不是 release 之后的附属动作

原先 rollout 更像部署附属操作。现在改成：

- deployment candidate 通过校验后进入 `awaiting_rollout`
- release 也进入 `awaiting_rollout`
- 只有所有 deployment 都完成 rollout，release 才继续 `postDeploy` 并收口成功

### 3. verification failure 单独建模

`waitForDeploymentReady()` 解决的是 K8s workload readiness。

`verifyServiceReachability()` 解决的是服务入口是否真能工作。

这两者不应该混成一个 `failed`。现在会单独落成 `verification_failed`，让 timeline、summary、排障动作都更准确。

## 用户链路

### Rolling 用户

- 发版后，平台自动跑完全部链路
- 成功才显示成功
- 失败会明确标成部署失败或校验失败

### Progressive 用户

- 发版后先看到 candidate 已通过校验
- 平台明确显示“待放量”
- 用户点击 rollout
- 平台完成 stable verify
- 若全部 deployment 都完成 rollout，release 自动继续后置迁移并收口成功

## 为什么这版更现代

- 成功语义不再提前
- rollout 被纳入正式 release state machine
- verification failure 有独立状态
- progressive 首发不再产生无意义人工步骤
- release / deployment / timeline / recap 的状态表达一致

## 仍未完成但值得继续做的点

1. 把 release orchestration 从 DB polling 升级成显式事件驱动状态机
2. 把 verify 从固定 HTTP path 升级成声明式 verification contract
3. 把 rollback candidate 与 stable lineage 固化成一等数据模型
4. 把 infrastructure incident 自动归因进一步沉淀为 release-level remediation suggestions
