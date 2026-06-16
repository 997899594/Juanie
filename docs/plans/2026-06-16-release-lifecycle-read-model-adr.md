# 2026-06-16 Release Lifecycle Read Model ADR

## Status

Accepted

## Context

Juanie 的发布链路已经包含准入、迁移、部署、渐进式放量、运行态校验、后置迁移和回滚恢复。之前的问题不是某个按钮文案，而是多个模块各自解释 release/deployment/migration 状态：

- status API 自己算 terminal/resolution/error
- intelligence 自己算 issue/failure summary
- recap 自己算 blocking reason
- timeline 自己决定是否展示待放量
- release detail 自己决定是否展示放量操作
- orchestration compatibility layer 自己决定 deployment 结果

这些重复判断会在混合状态下互相打架。典型例子是 worker 已经 `verification_failed`，web 仍是 `awaiting_rollout` 或 sibling deployment 被取消，页面会同时表现得像“失败”和“待放量”，用户无法判断下一步。

## Decision

引入 `src/lib/releases/lifecycle.ts` 作为发布生命周期唯一 read model。它只接收 release status、migration runs、deployments 和 error message，不访问 DB、不访问 Kubernetes、不触发副作用。

它统一输出：

- 当前 phase
- 主 issue 及优先级
- resolution / terminal / succeeded / failed
- failure summary
- 是否允许放量
- 可放量 deployment ids

消费侧规则：

- API、intelligence、recap、timeline、release detail 和 rollout plan 只能消费 lifecycle 裁决结果
- orchestration 仍负责推进真实状态，但 deployment terminal resolution 通过 lifecycle 兼容层得出
- UI 不再直接用裸 `release.status === 'awaiting_rollout'` 作为放量条件
- 基础设施诊断只在 lifecycle 没有发布链路 issue 时作为 fallback 展示

## Priority Order

生命周期 issue 优先级按发布链路语义排序：

1. 准入失败
2. 迁移审批 / 外部迁移阻塞
3. 迁移失败 / 迁移取消
4. 运行态校验失败
5. 部署失败
6. release failed
7. deployment canceled / release canceled
8. clean awaiting rollout
9. degraded

关键约束：`verification_failed` / `deployment_failed` 必须压过 sibling `canceled` 和 `awaiting_rollout`。因此只要同一个 release 中有服务已经校验失败，平台不能再把该 release 表达为“待放量”，也不能暴露继续放量按钮。

## Consequences

Positive:

- 失败、待处理、待放量的含义有单一裁决来源
- 页面、API、摘要、时间线、放量入口对同一 release 给出一致结论
- 混合状态不会再把失败服务盖成待放量
- 新增 release 状态时只需扩展 lifecycle 和对应测试

Negative:

- 调用点需要传入足够的 deployment/migration 上下文；只传裸 status 的旧兼容函数只能用于简单判断
- lifecycle 的优先级变更会影响多个页面，需要测试覆盖组合态

Neutral:

- orchestration 仍然可以分阶段更新 DB 状态；lifecycle 不替代状态写入，只提供读侧裁决
- infrastructure diagnostics 继续存在，但不再覆盖发布链路本身的主因

## Alternatives Considered

继续在各页面修补判断：

- Rejected. 会继续复制优先级，下一次新增状态或混合状态仍会分叉。

把所有状态推进改成事件溯源：

- Deferred. 这是长期正确方向，但当前最紧急的问题是读侧裁决混乱。先收敛 read model，不阻塞后续事件驱动改造。

只改 orchestration 最终状态：

- Rejected. 历史 release 和进行中 release 仍会在 UI/API/recap 上被不同模块解释。
