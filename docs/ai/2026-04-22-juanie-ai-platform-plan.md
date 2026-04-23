# Juanie AI Platform Plan

## Document Role

这份文档是 Juanie 当前 AI 方向的主文档。

作用：

- 定义 AI 的产品定位
- 定义 AI 的分层架构
- 定义 plugin / skill / tool / context 的关系
- 定义 chat UI / copilot panel / task center 的产品面
- 定义当前阶段、后续阶段与明确后置项

与其他文档的关系：

- `2026-04-22-juanie-ai-architecture.md`：架构原则与历史基线
- `2026-04-22-juanie-plugin-system.md`：插件系统专题
- `2026-04-22-juanie-phase-1-implementation-plan.md`：phase 1 实施与完成状态
- `2026-04-23-juanie-ai-assets-and-deploy-rules.md`：markdown 资产层与生产部署规则

当几份文档存在表述差异时，以本文档为当前主线方案。

## Status

当前状态：

- `foundation`: done
- `plugin-runtime-governance`: done
- `core-evals-and-gates`: done
- `markdown skill/prompt assets`: done
- `production deploy-safe ai enable rule`: done
- `environment/release ai surfaces`: done
- `chat UI / copilot panel product surface`: done
- `command bar`: done
- `async ai task runtime`: done for environment/release deep analysis, partial for richer replay/history/state machine
- `plugin marketplace / mcp auth / subagent`: deferred

## 1. Product Goal

Juanie 的 AI 不是通用聊天产品。

Juanie 的 AI 应定位为：

- 环境优先的 AI Copilot
- 发布、迁移、日志、变量、项目初始化的 AI Operator
- 可扩展的 AI Plugin Platform
- 具备领域 skills 与后续 subagent 能力的 Agent Runtime

AI 的职责不是“陪聊”，而是：

- 解释当前状态
- 发现风险
- 生成建议
- 调用工具
- 在权限边界内协助执行任务
- 将结果落为卡片、建议动作、任务、审计记录、回放记录

## 2. Product Spine

Juanie 的 AI 必须先理解产品主链：

`Team -> Project -> Environment -> Release`

补充规则：

- `Project is the entry`
- `Environment is the operational center`
- `Release belongs to Environment`
- `Logs / Variables / Data / Diagnostics are environment-scoped`
- 团队设置是支撑层，不与项目 / 环境主链竞争

硬约束：

- 不允许重新引入 project-level runtime/schema/delivery 旧叙事
- 不允许重复入口、重复按钮、重复解释
- 不允许一个页面同时承担多个主问题

## 3. Model and Provider Strategy

第一阶段允许使用 `302.ai` 作为主 provider 接入层，但只能通过 adapter 接入。

当前结论：

- provider 入口：`302`
- 内部协议：统一 provider adapter
- 后续保留：
  - OpenAI direct
  - Gemini direct
  - Claude direct

产品上不暴露“多模型平台”的复杂度；内部保留可切换能力。

推荐长期分工：

- 主协调模型：GPT 系列
- 用户面对型、解释型输出：Gemini
- 深度代码 / 复杂分析：Claude
- 高吞吐低成本任务：小模型

## 4. Why Skills Before Subagent

当前阶段先做 `skills`，再做 `subagent`。

原因：

- 现在最缺的是稳定的领域认知
- 现在最缺的是稳定的上下文边界
- 现在最缺的是稳定的工具边界
- 现在最缺的是稳定的输出结构

这些更适合先用 `skills` 固化。

正确顺序：

1. Provider Adapter
2. Context Assembler
3. Tool Registry
4. Skills
5. Streaming Runtime
6. Async Task Runtime
7. Plugin System
8. Subagent Orchestrator

## 5. Runtime Layers

Juanie 的 AI 推荐按 6 层建设：

1. `provider`
2. `runtime`
3. `context`
4. `tools`
5. `skills`
6. `plugins`

### Provider Layer

职责：

- 屏蔽 provider 差异
- 暴露统一模型获取接口
- 不向业务泄露底层 provider 字段

当前状态：done

### Runtime Layer

职责：

- 请求编排
- 结构化生成
- 快照、审计、降级、eval
- 流式 transport
- 异步任务执行

当前状态：partial

已完成：

- plugin run 编排
- snapshot
- audit / usage
- eval

未完成：

- 通用 streaming runtime
- 通用 chat message runtime
- 完整 async task runtime

### Context Layer

职责：

- 自动装配当前对象上下文
- 自动装配页面职责
- 自动装配权限
- 自动装配最近事件
- 自动装配可执行动作

当前状态：done for environment/release core paths

### Tool Layer

职责：

- 所有 AI 能力统一注册
- 强制输入输出 schema
- 标记权限级别
- 标记 scope
- 标记审计与确认要求

当前状态：done for first-party core tools

### Skill Layer

职责：

- 封装领域能力
- 绑定上下文、工具、输出格式、UI 规则

当前状态：done for first-party core skills

补充：

- `skills` 现在以 `SKILL.md` 作为资产真源
- `prompts` 现在以 markdown prompt files 作为资产真源
- typed registry 只负责加载、校验和暴露稳定 contract

### Plugin Layer

职责：

- 管理技能与工具扩展
- 支持 core / workspace / external / mcp 插件

当前状态：done for manifest/runtime contract, partial for ecosystem

## 6. Plugin System

Juanie 的插件系统不是脚本市场，而是 AI 能力扩展系统。

插件分类：

- `core`
- `workspace`
- `external`
- `mcp`

插件必须声明：

- `id`
- `version`
- `title`
- `description`
- `scope`
- `capabilities`
- `skills`
- `tools`
- `contextProviders`
- `ui.surfaces`
- `permissions`

硬规则：

- 插件不能绕过权限系统
- 插件不能越 scope 读数据
- 所有 `write / dangerous` 行为必须进入审计链
- 插件 UI 不得制造重复入口
- 插件必须声明 scope 与 surface

当前状态：

- manifest schema：done
- static registry：done
- dynamic registry：done
- runtime adaptation：done
- marketplace：deferred
- mcp remote auth：deferred

## 7. First-party Skills

当前建议的第一批核心 skills：

- `environment-skill`
- `release-skill`
- `migration-skill`
- `logs-skill`
- `envvar-skill`
- `project-init-skill`

当前实际状态：

- `environment-skill`: done
- `release-skill`: done
- `migration-skill`: done
- `envvar-skill`: done
- `incident-skill`: done
- `logs-skill`: not started
- `project-init-skill`: not started

说明：

- 现有实现里 `incident-skill` 已补齐
- `logs-skill` 与 `project-init-skill` 仍属于下一阶段扩展项

## 8. Context Assembler Rules

每次 AI 执行前，应只注入当前任务最需要的上下文，而不是整仓库。

上下文由 5 类组成：

1. `Domain Spine`
2. `Current Surface`
3. `Current Entity Snapshot`
4. `Allowed Actions`
5. `Recent Signals`

当前必须常驻的规则：

- 项目是入口，不是操作面
- 环境是操作面
- 发布属于环境
- 不允许创建重复入口
- 不允许重复 CTA
- 不允许解释型废话文案
- UI 保持轻表面、统一控件语言

当前状态：partial

已完成：

- environment / release 证据组装
- page-attached plugin context

未完成：

- 通用 `Current Surface` 规则注入器
- 通用 `Allowed Actions` 矩阵注入器
- logs / init 路径的 context assembler

## 9. Tool Registry

建议按领域命名空间组织：

- `project.*`
- `environment.*`
- `release.*`
- `deployment.*`
- `migration.*`
- `envVar.*`
- `team.*`
- `integration.*`
- `logs.*`
- `aiTask.*`

当前状态：

- 工具注册表：done
- 风险与审计标注：done
- first-party write tool：partial

当前已存在的核心工具能力偏向：

- environment read
- release read
- incident read
- migration approval write

未完成：

- `release.promote`
- `release.rollback`
- `environment.createPreview`
- `environment.deletePreview`
- `envVar.upsert`
- `envVar.delete`
- `logs.*`
- `projectInit.*`

## 10. Frontend Surfaces

Juanie 不应只做单聊天框。

建议的 4 个 AI surface：

### Copilot Panel

右侧 AI 面板。

适用页面：

- 环境页
- 发布页
- 数据页
- 日志页
- 团队页

当前状态：done

### Command Bar

全局命令入口。

示例：

- 分析当前环境
- 总结本次发布
- 检查迁移风险
- 解释当前失败

当前状态：done

### Inline AI Actions

卡片边上的 AI 分析入口。

当前状态：done

### Task Center

用于承载 AI 异步任务与待确认任务。

当前状态：done for migration/release operational tasks, done for generic ai task persistence, done for environment/release queue-backed async runtime

## 11. Chat UI and Copilot Panel

这部分不再视为“未定义的后续 phase”，而是已经进入当前产品规划。

产品原则：

- 不做全局 AI 首页
- 不打散主链
- 不让 chat 变成新的主入口
- chat / copilot 必须附着在对象页内

当前推荐落点：

- `Environment Copilot Panel`
- `Release Copilot Panel`

分工：

- `copilot-panel`：解释、问答、提炼、建议
- `action-center`：即时可执行动作
- `task-center`：异步任务、失败任务、待确认任务

当前状态：done

## 12. Async Runtime and BullMQ

Juanie 已有 BullMQ，适合承载 AI 长任务。

建议异步化的任务：

- 深度日志分析
- 发布风险评估
- 迁移修复建议
- 多环境对比
- 项目初始化失败报告
- 后续 subagent 聚合任务

建议 `aiTasks` 状态：

- `queued`
- `planning`
- `running`
- `awaiting_confirmation`
- `succeeded`
- `failed`
- `canceled`

当前状态：partial

已完成：

- 通用 `aiTasks` 表
- BullMQ AI 任务 runner
- 环境/发布任务中心
- 环境/发布深度分析任务入队与执行
- 任务详情弹窗与结果展示

未完成：

- 通用 AI 任务回放页
- 更完整的状态机与人工确认节点
- 非环境/发布 scope 的统一任务运行时

## 13. Security, Permissions, and Audit

基础原则：

- AI 不拥有额外权限
- 只能在当前用户已有权限范围内工作

建议的权限层次：

- `read_tool`
- `write_tool`
- `dangerous_tool`
- `cross_environment_tool`
- `cross_project_tool`

必须确认的动作：

- 提升发布
- 回滚发布
- 删除预览环境
- 修改或删除环境变量
- 任何 destructive 行为

当前状态：done for first-party runtime governance

当前已经记录：

- actor
- skill
- provider / model
- prompt key / version
- output schema
- tool calls
- token usage
- degradation
- latency

## 14. Eval and Quality Control

没有 eval 的 AI 系统不可控。

第一批 eval 场景：

- 环境状态解释
- 发布差异总结
- 迁移风险判断
- 权限越权拦截
- 输出结构与 prompt metadata 对齐

当前状态：done for core deterministic workflow evals

说明：

- 当前是 deterministic fixture/workflow regression
- 不是线上真实模型 A/B eval 平台

## 15. Delivery Phases

### Phase 1: Foundation

目标：

- provider adapter
- context / tool / skill / plugin 骨架
- 环境与发布核心分析能力

状态：done

### Phase 1.5: Product Surfaces

目标：

- environment/release AI surfaces
- chat UI
- copilot panel
- command bar

状态：

- inline cards / action / task surfaces：done
- chat UI / copilot panel：done
- command bar：done

### Phase 2: Operator

目标：

- logs / init / migration 深化
- BullMQ 异步任务
- AI task center

状态：partial

已完成：

- 环境/发布 AI 任务中心
- BullMQ 驱动的环境/发布深度分析

未完成：

- logs / project-init / migration 更完整 operator 扩展
- 通用 AI task replay / history / confirmation flow

### Phase 3: Plugin Platform

目标：

- 完整 external / workspace / mcp 插件扩展
- 生态级插件治理

状态：partial

### Phase 4: Subagent

目标：

- 多 agent 编排
- specialist agent 分工

状态：deferred

## 16. Recommended Directory Structure

推荐长期目录：

```txt
src/lib/ai/
  provider/
  runtime/
  context/
  tools/
  skills/
  plugins/
  tasks/
  audit/
  evals/
```

当前仓库已经基本长成这个形状，但仍缺：

- 通用 streaming runtime
- 通用 messages / transport
- 通用 ai task runtime
- logs / project-init skills

## 17. Final Conclusion

Juanie 当前不应做成“一个 AI 聊天功能”。

Juanie 正在建设的应该是：

**一个环境优先、插件可扩展、skills 驱动、后续可多 agent 化的 AI 操作平台。**

当前最合理的执行顺序仍然是：

1. Provider Adapter
2. Context Assembler
3. Tool Registry
4. Skills
5. Streaming Runtime
6. Copilot Panel / Chat UI
7. Task Center
8. Plugin System
9. Subagent
