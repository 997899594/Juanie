# Juanie AI Architecture

## Status

文档角色：

- 这是一份架构基线文档
- 更完整的当前主线方案见 [2026-04-22-juanie-ai-platform-plan.md](/Users/findbiao/projects/Juanie/docs/ai/2026-04-22-juanie-ai-platform-plan.md)

当前完成情况：

- `config`: done
- `provider`: done
- `context`: done for environment/release core paths
- `tools`: done for first-party core tools
- `skills`: done for first-party core skills
- `plugins`: done for manifest/runtime foundation
- `runtime`: done for snapshot/audit/eval foundation
- `frontend AI surfaces`: done for inline cards/action center/task center
- `chat UI / copilot panel`: done
- `command bar`: done
- `subagent`: deferred

本文档中 `No chat-first architecture` 仍然成立。

补充解释：

- 这不意味着不做 chat UI
- 而是意味着 chat / copilot 不能成为新的主入口，只能附着在对象页内

## Positioning

Juanie 的 AI 不应该是一个泛化聊天框，而应该是平台内建的环境级操作层。

产品主链保持不变：

`Team -> Project -> Environment -> Release`

AI 只能增强这条主链，不能打散它。用户进入项目，是为了理解项目现状；进入环境，是为了理解该环境当前状态、发布状态、变量、数据库、访问地址和后续动作；进入发布，是为了理解这次交付是否安全、是否可提升、失败原因是什么。AI 的职责是把这些上下文整理成可执行判断，而不是额外创造一层抽象。

## Product Rules

### 1. Environment first

- AI 默认围绕环境工作，而不是围绕“会话”工作。
- 所有 AI 请求都应带明确 scope：`team`、`project`、`environment`、`release` 之一。
- 同一个问题在不同环境下的答案可以不同，因此上下文必须先定 scope，再定 prompt。

### 2. Release is not the root

- 发布属于环境，不应该成为全局平铺入口。
- AI 对发布的分析，应视为环境内的一种能力，而不是独立产品。
- 项目页可以展示正式环境入口、团队信息、关键信息摘要，但不应承载环境内部的细节操作。

### 3. No chat-first architecture

- phase 1 不以聊天 UI 为中心。
- 先把 AI 做成可复用运行时，再决定是否提供 chat / copilot surface。
- 所有输出都要可落地为卡片、摘要、任务、建议动作、审计记录。

## Runtime Layers

Juanie AI 推荐分为 7 层：

1. `config`
2. `provider`
3. `context`
4. `tools`
5. `skills`
6. `plugins`
7. `runtime`

### config

- 统一解析 provider、model、feature flag、默认计划等配置。
- 屏蔽 302 / OpenAI / Gemini / Claude 的环境变量差异。

### provider

- 对上只暴露稳定的模型能力：`reasoning`、`toolCalling`、`json`。
- 对下可以接 `302`、OpenAI、Gemini、Claude。
- 平台代码不得直接依赖某个供应商的细节字段。

### context

- 根据 scope 组装团队、项目、环境、发布的结构化上下文。
- 把“当前环境访问地址”“最新发布”“是否只接受提升”“数据库状态”“变量状态”等信息归一成稳定 shape。

### tools

- 所有可调用动作都必须显式注册。
- 每个 tool 必须有输入 schema、scope、风险级别、审计标签。
- 默认区分 `read`、`write`、`dangerous` 三类。

### skills

- skill 是面向任务的编排层，例如：
  - `environment-skill`
  - `release-skill`
  - `migration-skill`
  - `logs-skill`
  - `envvar-skill`
- skill 负责决定“看什么上下文、调用什么工具、输出什么结构”。
- phase 1 先做 skills，不先做 subagent。

### plugins

- plugin 是平台扩展层，不是 prompt 文件集合。
- plugin 应该声明：能力、上下文提供器、技能、工具、可挂载 UI surface。
- 官方内建能力和未来外部扩展都走同一套 manifest。

### runtime

- 负责请求编排、流式输出、异步任务、快照、审计、降级、eval。
- runtime 不直接承载业务语义，业务语义在 skill / context / tool 中定义。

## Provider Strategy

phase 1 允许使用 `302` 作为默认 provider，但只能作为 adapter 接入。

原因：

- 302 可以较快接入 GPT / Gemini / Claude 等模型。
- 有利于前期验证能力边界和模型路由策略。
- 但不能把平台内部协议写死为 302 特有约束。

推荐内部能力映射：

- `interactive-fast`
- `structured-high-quality`
- `tool-first`

模型选择始终通过 policy 完成，而不是业务代码手填 model id。

## Why Skills Before Subagents

先做 skills，再做 subagents。

原因：

- Juanie 现在最缺的不是“多个 agent 并行”，而是“单个 AI 请求到底该看哪些上下文、调用哪些动作、返回什么结果”。
- 在 scope、权限、工具边界尚未稳定时上 subagent，只会把复杂度放大。
- skills 能先把平台知识和操作链路固定下来，后续 subagent 再调用这些稳定能力。

## Frontend Surfaces

phase 1 建议只开放 4 个 surface：

- Environment summary card
- Release analysis card
- Action center
- Task center

不做泛滥入口，不做重复入口。

原则：

- AI 结果必须附着在当前对象上
- AI 结果必须对应明确动作
- AI 结果不能重复已有信息展示
- 重要地址、版本、状态永远先于 AI 说明

当前仓库状态：

- Environment summary card：done
- Release analysis card：done
- Action center：done
- Task center：done
- Copilot panel：done
- Command bar：done

## Data, Audit, Evals

所有 AI 运行都必须记录：

- actor
- scope
- provider
- model
- prompt key / version
- tool calls
- output schema
- latency
- token / usage
- degradation state

当前仓库状态：

- actor：done
- scope：done
- provider / model：done
- prompt key / version：done
- tool calls：done
- output schema：done
- latency：done
- token / usage：done
- degradation state：done

所有核心技能都要补 eval fixture，至少覆盖：

- 发布计划
- 故障分析
- 环境摘要
- 变量风险
- 迁移建议

当前仓库状态：

- 发布计划：done
- 故障分析：done
- 环境摘要：done
- 变量风险：done
- 迁移建议：done

## Delivery Order

推荐顺序：

1. provider adapter
2. typed AI config
3. prompt registry
4. plugin manifest / registry
5. skill registry
6. context assembler
7. task runtime
8. frontend AI surfaces
9. subagent

这是 Juanie 当前最稳的现代化路径。先把骨架做干净，再扩展能力，而不是先堆对话体验。
