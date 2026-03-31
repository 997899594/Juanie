# Juanie AI Plugin Platform Plan

更新时间：2026-03-31

## 目标

Juanie 的 AI 不做聊天挂件，而是做平台能力插件。

一期目标：

- 把 AI 做成官方内置插件，支持后续收费
- 先打通 `302.ai + structured output + plugin runtime`
- 先落两类高价值插件：
  - `release-intelligence`
  - `incident-intelligence`

## 产品原则

1. AI 是控制面能力，不是聊天框。
2. 结构化输出优先，不用文本伪协议。
3. tool 只用于真实动作，workflow 只用于固定副作用。
4. UI 优先渲染插件 snapshot，不每次现算。
5. 收费按能力包，不按 token 对外暴露。

## 架构分层

### 1. AI Core

- 单 `302.ai` provider
- `generateText + output.object()`
- model policy
- telemetry
- degradation

### 2. Plugin Runtime

- 插件注册
- entitlement 校验
- evidence 装配
- workflow 执行
- snapshot 落库
- usage metering

### 3. Official Plugins

- `release-intelligence`
- `incident-intelligence`
- `preview-intelligence`
- `project-architect`

一期只实现前两个。

## 首批插件

### release-intelligence

Surface:

- 发布列表页
- production promote dialog

输出：

- 推荐 rollout 策略
- 风险等级
- 阻塞检查
- 执行步骤
- 回滚建议
- operator narrative

### incident-intelligence

Surface:

- release detail

输出：

- 根因类别
- 因果链
- 证据列表
- 安全动作建议
- 人工动作建议
- operator narrative

## 技术路线

### Structured Output

主生成方式：

- `generateText({ output: output.object(...) })`

不用纯文本 JSON，不用前端猜协议。

### Tool / Workflow / Data Part 边界

- tool：真实动作，例如 remediation / rollback / rollout
- workflow：固定顺序的后台过程，例如刷新 AI snapshot
- data part：稳定 UI 补充数据

一期插件主链路不依赖聊天，不以 `streamText` 为核心。

## 数据模型

建议增加：

- `aiPluginInstallations`
- `aiEntitlements`
- `aiPluginRuns`
- `aiPluginSnapshots`

其中：

- `runs` 用于计费、观测、审计
- `snapshots` 用于页面读取、缓存、版本管理

## 计费模型

不是卖 token，而是卖 capability pack。

建议：

- Pro：`release-intelligence`
- Scale：`release-intelligence + incident-intelligence + preview-intelligence`
- Enterprise：全部 + 策略控制 + 更强审计

计费维度：

- 主维度：`per_team`
- 补充维度：`per_run`

## 一期实施顺序

1. `AI Core`
2. `Plugin Runtime`
3. `release-intelligence`
4. `incident-intelligence`
5. snapshot 持久化与 entitlement

## 一期交付标准

- 平台能注册官方 AI 插件
- 插件能输出结构化对象
- 页面能读取 snapshot 渲染 AI 卡片
- entitlement 能决定是否展示/刷新能力
- usage run 能被记录
