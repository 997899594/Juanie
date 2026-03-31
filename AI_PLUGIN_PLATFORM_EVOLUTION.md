# Juanie AI Plugin Platform Evolution

更新时间：2026-03-31

## 目标

这份文档定义 Juanie AI 的升级路径，不和一期落地方案混在一起。

当前推荐落点是：

- 先做 `官方内置插件 runtime`

未来升级方向是：

- `policy plugins`
- `AI event bus`
- 最终形成 `AI control operating system`

## 分层演进

## Phase 1: Official Capability Plugins

这是当前立即开干的方案。

特点：

- 官方内置插件
- 单 `302.ai` provider
- structured output first
- snapshot + usage + entitlement
- 页面按插件 surface 渲染能力卡

优点：

- 落地快
- 可收费
- 主链路价值强
- 风险低

限制：

- AI 主要还是“解释和建议”
- 还没有直接参与平台策略判定

## Phase 2: Policy Plugins

在 capability plugin 跑顺之后，引入 policy layer。

这层插件不只是“输出卡片”，还可以影响平台策略：

- 是否允许创建 production release
- 是否强制人工审批
- 是否禁止 canary
- 是否要求先做 capacity cleanup
- 是否禁止在高压状态下 rollout

示例：

- `release-policy-ai`
- `migration-policy-ai`
- `capacity-guard-ai`

目标：

- 让 AI 成为治理规则的一部分
- 但仍由平台代码执行最终判定

## Phase 3: AI Event Bus

再往上一层，不再只靠页面刷新触发 AI。

平台内部所有关键事件都进入 AI runtime：

- `release.created`
- `release.failed`
- `migration.awaiting_approval`
- `deployment.progress_deadline_exceeded`
- `environment.capacity_blocked`
- `environment.remediation_triggered`

插件订阅这些事件，自主刷新 snapshot。

这样平台会从：

- 页面上的 AI 卡片

升级成：

- 后台持续运行的 AI 控制面

## Phase 4: External Plugin SDK

这一步不建议现在做。

只有在以下条件满足后才考虑：

- 官方插件 runtime 已稳定
- entitlement / metering 已经跑顺
- 安全边界已经清楚
- evidence pack 已标准化

开放对象也不应是“任意模型脚本”，而应该是受控 SDK：

- evidence contracts
- schema contracts
- UI surface contracts
- audit / permission constraints

## 为什么不直接做终局

因为终局方案虽然更先进，但现在直接上会过度设计：

- 插件权限模型会爆炸
- 计费会复杂
- 稳定性边界不清楚
- 平台核心对象还没有标准化

所以正确路线是：

1. 先做 capability plugins
2. 再做 policy plugins
3. 再做 AI event bus
4. 最后才看 external SDK

## 最终愿景

Juanie 的终局不是“内置几个 AI 功能”，而是：

- 平台拥有一个 AI runtime
- 不同插件消费同一套 evidence pack
- AI 既能解释，也能参与治理策略
- 所有结果都可审计、可计费、可版本化

一句话：

Juanie 终局是 `AI-native DevOps Control OS`，不是 “DevOps 平台 + 一个 AI 页面”。
