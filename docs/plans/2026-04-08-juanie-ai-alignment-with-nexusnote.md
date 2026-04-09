# Juanie AI 对齐 NexusNote 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 重构 Juanie 的 AI 栈，使其遵循 NexusNote 的 AI 架构风格，同时复用同一套 `AI_302_API_KEY` / `AI_302_BASE_URL` 约定，并保留 Juanie 以发布链路为中心的产品行为。

**架构：** 保留 Juanie 在 `release-intelligence` / `incident-intelligence`、团队 gating、snapshot 与审计链路上的领域层；将其下方的 AI 核心替换为 NexusNote 风格的 env 校验、provider/model policy、prompt registry、workflow 化执行、统一 telemetry 与 evals。

**技术栈：** Next.js 16、TypeScript、AI SDK 6、`@ai-sdk/openai`、Zod、Drizzle、PostgreSQL、BullMQ。

---

## 需求概述

### 功能性需求

- Juanie 必须继续支持：
  - 发布计划 snapshot
  - 故障诊断 snapshot
  - release 详情页上的手动刷新
  - 团队级 AI 控制面
- Juanie 和 NexusNote 必须使用同一套 provider 密钥约定：
  - `AI_302_API_KEY`
  - `AI_302_BASE_URL`
- Juanie 的 prompt/version/model 选择必须像 NexusNote 一样显式化，并且由代码驱动。
- Juanie 未来新增的 AI 能力应该有一条统一的扩展路径，而不是继续在代码里零散写内联 prompt。

### 非功能性需求

- 不能破坏现有 release 详情页。
- 不能移除当前的 snapshot 缓存与团队访问控制。
- 必须保留可审计性，并提升可观测性。
- 尽量减少 Juanie 与 NexusNote 在 secret/config 上的漂移。
- 要为未来的交互式 AI surface 留出口，但第一阶段不要强行引入 chat UI。

---

## 现状审计

### Juanie 当前状态

- Provider 已经基于 302.ai，但 env 读取是分散的，没有集中校验：
  - `src/lib/ai/core/provider.ts`
  - `src/env.d.ts`
  - `.env.example`
- 执行模型是 plugin-centric，而不是 profile/workflow-centric：
  - `src/lib/ai/runtime/plugin-registry.ts`
  - `src/lib/ai/runtime/plugin-runner.ts`
  - `src/lib/ai/runtime/plugin-service.ts`
- Prompt 是直接写在 plugin 文件里的内联字符串：
  - `src/lib/ai/plugins/release-intelligence/plugin.ts`
  - `src/lib/ai/plugins/incident-intelligence/plugin.ts`
- 产品/业务层其实已经存在，而且有价值：
  - `src/lib/ai/runtime/control-plane.ts`
  - `src/app/api/teams/[id]/ai/route.ts`
  - `src/lib/db/schema.ts` 中的 `aiPluginInstallation`、`aiEntitlement`、`aiPluginSnapshot`、`aiPluginRun`
- 当前 AI surface 很窄，而且基本是同步拉取：
  - `src/app/api/projects/[id]/releases/[releaseId]/ai-plan/route.ts`
  - `src/app/api/projects/[id]/releases/[releaseId]/ai-incident/route.ts`
  - `src/components/projects/ReleaseAISnapshotPanel.tsx`

### NexusNote 当前状态

- 有规范的 env 解析和默认值体系：
  - `/Users/findbiao/projects/nexusnote/config/env.ts`
- 有规范的 provider/model policy 层：
  - `/Users/findbiao/projects/nexusnote/lib/ai/core/provider.ts`
  - `/Users/findbiao/projects/nexusnote/lib/ai/core/model-policy.ts`
- 有 prompt registry 与版本化静态 prompt 资源：
  - `/Users/findbiao/projects/nexusnote/lib/ai/core/prompt-registry.ts`
  - `/Users/findbiao/projects/nexusnote/lib/ai/prompts/load-prompt.ts`
  - `/Users/findbiao/projects/nexusnote/lib/ai/prompts/resources/`
- 执行路径是 capability/profile 驱动：
  - `/Users/findbiao/projects/nexusnote/lib/ai/core/capability-profiles.ts`
  - `/Users/findbiao/projects/nexusnote/lib/ai/agents/chat.ts`
- telemetry 与成本记录是统一的：
  - `/Users/findbiao/projects/nexusnote/lib/ai/core/telemetry.ts`
- evals 已经是一等公民：
  - `/Users/findbiao/projects/nexusnote/lib/ai/evals/runner.ts`

---

## Juanie 的目标架构

### 需要与 NexusNote 对齐的部分

- 一套规范的 env/config 层。
- 一套规范的 provider 抽象层。
- 显式的 model policy，而不是隐藏的模型选择。
- 版本化的 prompt 资源文件。
- 在代码里做动态 prompt 组装，而不是把长 prompt 直接写死在业务文件中。
- 统一的 telemetry，包括 request/workflow/prompt version/model policy。
- AI eval runner，作为回归保护。

### 应该保留 Juanie 特性的部分

- 团队 entitlement 与 plugin 安装/启用开关。
- 基于 resource + schema version + evidence hash 的 snapshot 缓存。
- release/incident 的领域证据构建器。
- 审计日志集成与 release 详情页 UI。

### 明确决策

第一阶段**不要**把 NexusNote 的 chat 栈原样搬到 Juanie。

Juanie 当前的 AI 用例，更接近 NexusNote 的 **workflow** 和 **nested AI** 路径，而不是开放式 chat agent 路径。正确的对齐方式应该是：

- 用 NexusNote 风格的 AI 核心
- 包在 Juanie 自己的 workflow/product shell 外面

而不是：

- 把 Juanie 改造成一个通用聊天应用

---

## Secret 与 Key 策略

两边统一采用以下 runtime secret 名称：

- `AI_302_API_KEY`
- `AI_302_BASE_URL`
- `AI_MODEL`
- `AI_MODEL_PRO`

推荐规则：

- 部署平台的 secret manager 是唯一真源。
- 两个应用分别读取同名 secret。
- 不共享 `.env` 文件本身。

向后兼容方案：

- Juanie 里的 `AI_ENABLED` 和 `AI_MODEL_TOOL` 暂时保留一个过渡期。
- 但内部实现要统一归一化到 NexusNote 风格的 config contract。

---

## 实施任务

### 任务 1：补上规范的 AI Env 层

**文件：**
- 新建：`src/config/env.ts`
- 修改：`.env.example`
- 修改：`src/env.d.ts`
- 修改：`src/lib/ai/core/provider.ts`
- 修改：`src/lib/ai/runtime/control-plane.ts`

**步骤 1：创建 NexusNote 风格的 env parser**

新增 `src/config/env.ts`，包含：

- 基于 Zod 的校验
- `AI_302_BASE_URL`、`AI_MODEL`、`AI_MODEL_PRO` 的默认值
- 对 `AI_ENABLED`、`AI_MODEL_TOOL` 的兼容归一化逻辑

**步骤 2：让 provider 统一通过 `env` 读取配置**

重构 `src/lib/ai/core/provider.ts`，不再直接读取 `process.env.*`。

**步骤 3：明确 enablement 规则**

推荐行为：

- `isConfigured()` = `Boolean(env.AI_302_API_KEY)`
- `isEnabled()` = `isConfigured()`，除非你仍然需要显式 feature flag

如果暂时保留 `AI_ENABLED`，也应该只把它当成临时 override，而不是规范的状态来源。

**步骤 4：更新文档中的 env contract**

更新 `.env.example`，让 Juanie 尽量对齐 NexusNote 的命名和默认值。

**验证**

- `bunx biome check src/config/env.ts src/lib/ai/core/provider.ts`
- `bun run build`

---

### 任务 2：引入 Prompt Registry 与 Prompt Resources

**文件：**
- 新建：`src/lib/ai/prompts/load-prompt.ts`
- 新建：`src/lib/ai/prompts/index.ts`
- 新建：`src/lib/ai/prompts/resources/release-plan.md`
- 新建：`src/lib/ai/prompts/resources/incident-analysis.md`
- 新建：`src/lib/ai/core/prompt-registry.ts`
- 修改：`src/lib/ai/plugins/release-intelligence/plugin.ts`
- 修改：`src/lib/ai/plugins/incident-intelligence/plugin.ts`

**步骤 1：把静态 system instructions 挪到资源文件**

创建版本化 prompt 资源：

- `release-plan@v1`
- `incident-analysis@v1`

这些 prompt 文件只负责稳定的规则，不应该塞 evidence JSON。

**步骤 2：增加 prompt registry**

创建一个仿照 NexusNote 的 Juanie prompt registry：

- prompt key -> system prompt
- `buildPromptInstructions(key, dynamicContext?)`

**步骤 3：保留 evidence 在代码中组装**

Plugin/workflow 继续在代码里序列化 evidence：

- release evidence builder 的输出
- incident evidence builder 的输出

静态 prompt 文件不应该承载本该由 TypeScript 组装的领域数据模板。

**步骤 4：每次 AI 执行都挂上 prompt version**

每一次 AI 执行都应解析出明确的 prompt key，例如：

- `release-plan@v1`
- `incident-analysis@v1`

**验证**

- 输出 shape 与现有 schema 保持一致
- 手动刷新接口的响应契约保持不变

---

### 任务 3：把 AI Core 与 Product Plugin Shell 分离

**文件：**
- 新建：`src/lib/ai/workflows/release-plan.ts`
- 新建：`src/lib/ai/workflows/incident-analysis.ts`
- 新建：`src/lib/ai/workflows/index.ts`
- 修改：`src/lib/ai/core/generate-structured.ts`
- 修改：`src/lib/ai/runtime/plugin-runner.ts`
- 修改：`src/lib/ai/plugins/release-intelligence/plugin.ts`
- 修改：`src/lib/ai/plugins/incident-intelligence/plugin.ts`

**步骤 1：创建 workflow 风格的执行模块**

每个 workflow 应该负责：

- model policy
- prompt key
- evidence 到 prompt 的组装
- schema 绑定
- telemetry labels

**步骤 2：让 plugin `run()` 委托给 workflow**

第一阶段不要删 plugin。

正确做法是：

- 保留 plugin manifest，作为 Juanie 的产品目录
- 把真正的 AI 执行逻辑挪到 workflow 模块里

这样可以保住：

- entitlement
- snapshot
- 安装/启用开关

同时让执行风格与 NexusNote 对齐。

**步骤 3：统一 generation API**

扩展 `generateStructuredObject()`，让它接收：

- `promptVersion`
- `modelPolicy`
- telemetry context

不要把 prompt/version/model 的选择继续隐藏在 plugin 代码里。

**验证**

- `release-intelligence` 仍然输出 `ReleasePlan`
- `incident-intelligence` 仍然输出 `IncidentAnalysis`
- snapshot 按 evidence hash 去重的逻辑依旧有效

---

### 任务 4：增加统一 Telemetry 与成本核算

**文件：**
- 新建：`src/lib/ai/core/telemetry.ts`
- 修改：`src/lib/ai/core/model-policy.ts`
- 修改：`src/lib/ai/runtime/plugin-runner.ts`
- 修改：`src/app/api/projects/[id]/releases/[releaseId]/ai-plan/route.ts`
- 修改：`src/app/api/projects/[id]/releases/[releaseId]/ai-incident/route.ts`
- 修改：`src/lib/db/schema.ts`
- 新建或修改：`drizzle/*` 中用于 AI usage 字段/表的 migration

**步骤 1：增加一个通用的 `aiUsage` 记录表**

推荐：新建一个通用表，不要直接复用 `aiPluginRun`。

原因：

- `aiPluginRun` 是产品/业务事件
- `aiUsage` 是技术层的可观测性记录

建议字段：

- `requestId`
- `endpoint`
- `workflow`
- `provider`
- `modelPolicy`
- `model`
- `promptVersion`
- `inputTokens`
- `outputTokens`
- `totalTokens`
- `costCents`
- `durationMs`
- `success`
- `errorMessage`
- `metadata`

**步骤 2：在 API 和 workflow 边界记录 telemetry**

Route 层应该创建 request-scoped telemetry context。

Workflow 层应该记录：

- prompt version
- model policy
- latency
- token usage
- degraded reason

**步骤 3：保留 `aiPluginRun`**

第一阶段不要删除 `aiPluginRun`。
它依然对产品问题有价值，例如：

- 某个 plugin 被调用了多少次
- 哪个团队在用
- 哪个 release 被分析了

**验证**

- 成本估算能根据配置的模型价格正确算出
- 失败运行也能写入 telemetry 记录

---

### 任务 5：让团队 AI 控制面对齐新核心

**文件：**
- 修改：`src/lib/ai/runtime/control-plane.ts`
- 修改：`src/app/api/teams/[id]/ai/route.ts`
- 修改：`src/components/teams/TeamSettingsClient.tsx`

**步骤 1：保留控制面的产品语义**

保留：

- 团队 plan
- plugin 启用/关闭
- provider 状态展示

**步骤 2：展示规范化的 provider/model 状态**

控制面应该从集中式 env/provider 层取值，而不是直接读散落的 env 字符串。

推荐增加：

- 当前激活的 provider label
- 解析后的 `AI_MODEL`
- 解析后的 `AI_MODEL_PRO`
- 每个 plugin/workflow 当前使用的 prompt registry version 摘要

**步骤 3：不要把业务 gating 混进 provider 代码**

以下几件事不要混在一起：

- provider readiness
- team entitlement
- plugin installation

它们是不同层面的职责，应该继续分离。

**验证**

- 当前团队设置页仍可工作
- 只有 owner 可 patch 的权限路径保持不变

---

### 任务 6：增加 AI 回归 Evals

**文件：**
- 新建：`src/lib/ai/evals/types.ts`
- 新建：`src/lib/ai/evals/runner.ts`
- 新建：`src/lib/ai/evals/release-plan/cases.ts`
- 新建：`src/lib/ai/evals/incident-analysis/cases.ts`
- 新建：`src/lib/ai/evals/index.ts`
- 修改：`package.json`
- 可选新建：`scripts/run-ai-evals.ts`

**步骤 1：增加一个最小可用的 eval runner**

对齐 NexusNote 的模式：

- suite definition
- case execution
- scoring/judging hooks
- summary output

**步骤 2：补齐领域级 eval case**

Release plan eval 应验证：

- 没有幻觉步骤
- risk level 与 evidence 一致
- rollback plan 存在
- checks 满足 schema 完整性

Incident eval 应验证：

- root cause 必须引用真实 evidence
- actions 按安全等级拆分合理
- causal chain 有连贯性

**步骤 3：增加 CI 入口**

加入类似这样的脚本：

- `bun run ai:eval`

先手动跑稳定，再接入 CI，不要一上来就卡主主线构建。

**验证**

- eval suite 跑的是真实 workflow 代码，而不是只跑 mock

---

### 任务 7：清理 API 边界，并为未来 surface 预留空间

**文件：**
- 修改：`src/app/api/projects/[id]/releases/[releaseId]/ai-plan/route.ts`
- 修改：`src/app/api/projects/[id]/releases/[releaseId]/ai-incident/route.ts`
- 修改：`src/lib/ai/runtime/release-plugin-service.ts`
- 修改：`src/components/projects/ReleaseAISnapshotPanel.tsx`

**步骤 1：保留当前 API 契约**

第一阶段不要破坏当前 release 详情页 consumer。

**步骤 2：补充更丰富的元数据**

建议在 payload 中增加：

- `promptVersion`
- `modelPolicy`
- `provider`
- `model`
- `generatedAt`
- `degradedReason`

这能提升运维和排障效率，同时不改变核心 UX。

**步骤 3：把“数据新鲜度”和“本次执行失败”区分开**

保留 Juanie 现在这个很有价值的行为：

- 新生成失败时展示最近一次可用的 cached snapshot
- 单独展示刷新失败原因

这个模式已经是对的，应该保留。

---

### 任务 8：可选的 Phase 2 - 增加一个 Operations Agent

**文件：**
- 新建：`src/lib/ai/core/capability-profiles.ts`
- 新建：`src/lib/ai/agents/ops.ts`
- 新建：`src/lib/ai/tools/ops/*`
- 新建：`src/app/api/ai/chat/route.ts`
- 仅在产品明确需要时再补 UI

**这个任务是可选的。**

只有在你明确希望 Juanie 增加一个 NexusNote 风格的交互式运维助手时，才进入这一步。

推荐的第一批用例：

- 解释为什么一个 release 被阻塞
- 总结 rollout 风险
- 给出下一步排障建议
- 调用针对 release/environment 的安全只读工具

一开始**不要**做写操作工具或 remediation action。

---

## 推进顺序

### Phase 1

- 任务 1
- 任务 2
- 任务 3

结果：

- 与 NexusNote 相同的 provider/key contract
- 与 NexusNote 相同的 prompt/version/model 纪律
- 与 NexusNote 相同风格的 AI 核心基础层

### Phase 2

- 任务 4
- 任务 5
- 任务 6

结果：

- 生产级 telemetry
- 控制面一致性
- AI 回归安全网

### Phase 3

- 任务 7
- 任务 8（可选）

结果：

- 更干净的 API surface
- 可选的交互式 ops assistant

---

## 风险与缓解

### 风险 1：过度照搬 NexusNote 的 chat 抽象

缓解：

- 只拷贝适合 Juanie 用例的 AI 核心模式
- 让 release 分析继续保持 workflow/snapshot 驱动

### 风险 2：破坏现有 snapshot 消费方

缓解：

- 第一阶段保持当前响应 shape
- 只加 metadata 字段，不删已有字段

### 风险 3：迁移过程中 config 漂移

缓解：

- 保留临时 env 兼容层
- 清晰记录规范字段名与废弃窗口

### 风险 4：prompt 变更缺少回归保护

缓解：

- 先补 prompt registry
- 明确 prompt version key
- 再用 eval suite 保护迭代

---

## 推荐写成 ADR 的决策

### ADR 1：规范的 Provider Contract

- 决策：NexusNote 与 Juanie 均以 `AI_302_API_KEY` / `AI_302_BASE_URL` 作为唯一规范 runtime contract。
- 结果：部署与 secret 轮换更简单。

### ADR 2：产品层与 AI Core 层分离

- 决策：保留 Juanie 的 plugin/snapshot/entitlement 业务层，但把 AI 执行核心重建为 NexusNote 风格。
- 结果：业务控制能力保住了，实现质量也更高。

### ADR 3：Workflow First，Chat Optional

- 决策：Juanie AI 第一阶段坚持 workflow-first，不强推 chat surface。
- 结果：迁移更快，产品风险更低。

---

## 验收标准

- Juanie 使用与 NexusNote 相同的 `AI_302_API_KEY` secret contract。
- 所有 AI env 读取都来自一个集中式 config 模块。
- Release 与 incident 的 prompt 都改为版本化资源文件，不再写成内联字符串。
- 每一次 AI run 都记录 prompt version、model policy、provider、model 以及 cost/usage metadata。
- 当前 release 详情页上的 AI 面板仍然可用。
- AI eval 已存在，并且能跑真实 Juanie workflow。

---

## 给实施工程师的说明

- 不要一上来就删 `aiPlugin*` 这些表。
- 除非产品范围明确要求，否则不要主动加 chat UI。
- 先做兼容 shim，再做硬删除。
- 如果某个实现选择与 NexusNote 的 AI 核心模式冲突，优先站在 NexusNote 的 AI 核心模式这一边。
- 如果某个实现选择与 Juanie 的业务控制层冲突，优先保住 Juanie 的业务控制层，然后把冲突下沉到 AI 核心边界去解决。

