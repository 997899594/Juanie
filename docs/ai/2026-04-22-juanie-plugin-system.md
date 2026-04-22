# Juanie Plugin System

## Status

文档角色：

- 这是一份插件系统专题文档
- 当前主线方案与阶段状态见 [2026-04-22-juanie-ai-platform-plan.md](/Users/findbiao/projects/Juanie/docs/ai/2026-04-22-juanie-ai-platform-plan.md)

当前完成情况：

- static registry：done
- dynamic registry：done
- manifest schema：done
- scope / permission contract：done
- first-party plugin runtime：done
- dynamic plugin runtime adaptation：done
- plugin audit / usage：done
- workspace / external / mcp ecosystem：partial
- marketplace：deferred
- mcp remote auth：deferred

## Goal

Juanie 的 plugin system 要解决的不是“装一堆功能”，而是让 AI 能力以稳定、可治理、可审计的方式挂进平台。

plugin 必须是平台能力单元，而不是松散脚本。

## Plugin Taxonomy

Juanie 插件分为 4 类：

### 1. Core plugins

平台官方内建，跟随主仓库发布。

例如：

- `release-intelligence`
- `incident-intelligence`
- `environment-summary`
- `migration-review`

### 2. Workspace plugins

团队或项目私有插件，部署在同一控制面内，但作用域受限。

适合：

- 团队内部规范
- 定制告警解释
- 特定数据库或部署流程

### 3. External plugins

由外部包或仓库提供，通过 manifest 注册到 Juanie。

适合：

- 自定义集成
- 第三方工作流
- 组织内部扩展

### 4. MCP / remote plugins

通过远程 tool 或 MCP server 暴露能力。

适合：

- 外部系统只读查询
- 受控写操作
- 跨系统编排

## Manifest Shape

```ts
export interface JuaniePluginManifest {
  id: string
  version: string
  title: string
  description: string
  kind: 'core' | 'workspace' | 'external' | 'mcp'
  scope: 'global' | 'team' | 'project' | 'environment' | 'release'
  capabilities: string[]
  skills: string[]
  tools: string[]
  contextProviders: string[]
  surfaces: Array<'copilot-panel' | 'inline-card' | 'action-center' | 'task-center'>
  permissions: {
    level: 'read' | 'write' | 'dangerous'
    requiresAudit: boolean
  }
}
```

要求：

- manifest 是真源。
- 任何 plugin 的 UI、权限、能力描述都要从 manifest 派生。
- 没有 manifest 的能力不允许进入 registry。

## Capability Model

plugin 不直接等于一个 prompt。

plugin 由 4 部分组成：

1. manifest
2. context providers
3. skills
4. tools

运行关系：

`surface -> plugin -> skill -> context/tool -> provider -> structured result`

这意味着：

- UI 不需要知道底层模型细节
- provider 替换不会影响插件能力声明
- 同一个 plugin 可以复用多个 skill

## Scope Rules

scope 必须严格受限：

- `team`: 团队级配置、成员、集成、治理
- `project`: 项目摘要、项目设置、项目入口信息
- `environment`: 环境状态、访问地址、变量、数据库、发布列表
- `release`: 单次发布、变更、风险、诊断

禁止跨 scope 偷拿数据。比如 release 插件不能默认读取整个团队的历史运行，除非显式声明需要。

## Permission Model

所有 plugin tool 必须标记风险级别：

- `read`
- `write`
- `dangerous`

执行规则：

- `read` 可以直接调用，但要审计
- `write` 需要明确 actor 和 scope
- `dangerous` 必须通过 task center 或显式确认流转

这层边界是未来引入 subagent 时的前提。

## Registry Design

registry 分成两层：

### Static registry

用于注册内建插件与核心 skill。

特点：

- 启动即加载
- 类型稳定
- 跟随代码版本

### Dynamic registry

用于加载 workspace / external / MCP 插件。

特点：

- 按团队或项目装配
- 需要 manifest 校验
- 需要权限和 capability 校验

当前仓库状态：

- built-in 插件 registry：done
- dynamic manifest extraction：done
- runtime plugin adaptation：done
- duplicate id 校验：done
- 团队级装配：done
- 外部生态分发：not started

## UI Attachment Rules

插件不能到处挂入口。

建议 surface 规则：

- `inline-card`: 环境页 / 发布页局部分析结果
- `action-center`: 当前对象可执行动作建议
- `task-center`: 长任务、失败任务、待确认任务
- `copilot-panel`: 后续 phase 才开放

状态更新：

- `inline-card`：done
- `action-center`：done
- `task-center`：done
- `copilot-panel`：已进入当前产品计划，但代码尚未完成

同一个 plugin 只能在“最自然的对象页”出现，避免重复入口和重复文案。

## Safety and Audit

每次 plugin 运行要记录：

- plugin id
- skill id
- scope
- actor
- provider / model
- prompt version
- tool calls
- output schema
- result summary

当前仓库状态：

- plugin id：done
- skill id：done
- scope：done
- actor：done
- provider / model：done
- prompt version：done
- tool calls：done
- output schema：done
- token usage：done
- result summary：partial

写操作型插件还要记录：

- approval source
- before / after summary
- rollback hint

## Recommended First-party Plugins

phase 1 官方插件建议收敛到：

- `environment-summary`
- `release-intelligence`
- `incident-intelligence`
- `migration-review`
- `envvar-risk`

先把这 5 个做好，比扩张十几个半成品插件更有价值。

## Non-goals

当前阶段不做：

- 插件市场
- 沙箱代码执行
- 多 agent 插件编排
- 用户自定义 prompt UI

先把 manifest、registry、scope、audit 做扎实，后面扩展才不会失控。
