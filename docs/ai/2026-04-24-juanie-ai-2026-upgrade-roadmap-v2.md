# Juanie AI 2026 Upgrade Roadmap v2

## Role

这份文档只做两件事：

- 明确 Juanie 当前 AI 架构和 2026 年 4 月最新形态之间的差距
- 定义接下来真正要开发的升级路径

它不是总方案替代品。当前总方案仍以
[2026-04-22-juanie-ai-platform-plan.md](/Users/findbiao/projects/Juanie/docs/ai/2026-04-22-juanie-ai-platform-plan.md)
为主。

## Status

当前判断：

- runtime / tools / audit / eval：strong
- markdown prompts：done
- markdown skills：done
- copilot runtime unification：done
- skill package system：done
- conversation runtime：in progress
- subagent / handoff：pending

## Gap Summary

Juanie 现在已经不是旧式“页面里写 prompt，接口里直调模型”的架构。

但距离 2026 年 4 月最先进的一档，仍有 3 个核心缺口：

1. `skills` 还是 registry item，不是真正的 package
2. `copilot` 还是 surface adapter，不是统一 conversation runtime
3. 没有正式 `subagent / handoff / delegation` 层

## Phase A: Skill Package Foundation

目标：

- 把 skill 从“手写路径列表”升级成“目录自动发现”
- 把 skill 从“薄 metadata”升级成“package metadata”
- 为后续 conversation runtime 和 subagent 提供稳定能力单元

交付：

- `src/lib/ai/skills/registry.ts`
  - 支持自动发现 `definitions/*/SKILL.md`
- `src/lib/ai/skills/types.ts`
  - 增加 package 级字段
- `src/lib/ai/skills/definitions/*`
  - skill frontmatter 补齐执行模式与 surface 声明
  - 支持 references / examples / evals 资产

状态：

- auto-discovery: done
- richer skill manifest: done
- package asset references: done

## Phase B: Conversation Runtime

目标：

- 把 Copilot 从 surface service 升级成正式 conversation runtime
- 支持统一 session、streaming metadata、trace、tool-aware messaging

交付：

- 统一 conversation transport
- response metadata channel
- richer replay / trace
- conversation state model

状态：

- shared SSE transport: done
- response metadata channel: done
- local conversation persistence: done
- replay / session history: done
- trace / tool-aware messaging: in progress

## Phase C: Subagent / Handoff

目标：

- 引入 specialist agents
- 支持复杂任务分解、并行分析、handoff

交付：

- handoff contract
- subagent manifest / registry
- long-running orchestration
- task center 聚合 subagent 结果

状态：

- not started

## Current Execution Decision

现在直接进入 `Phase A`。

原因：

- 这是后面所有升级的底座
- 不先把 skill package 化，conversation runtime 还是会绑死在 TS 逻辑里
- 不先把 skill package 化，subagent 也没有稳定的能力单元可复用
