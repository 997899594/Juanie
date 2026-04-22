# Juanie AI Phase 1 Implementation Plan

## Status

文档角色：

- 这是一份 phase 1 实施文档
- phase 1 已基本完成
- 当前更完整的总方案见 [2026-04-22-juanie-ai-platform-plan.md](/Users/findbiao/projects/Juanie/docs/ai/2026-04-22-juanie-ai-platform-plan.md)

当前结论：

- `phase 1 foundation`: done
- `phase 1` 之外又额外完成了：
  - environment summary
  - migration review
  - envvar risk
  - dynamic plugin runtime
  - eval fixtures and gates
  - audit / usage persistence

仍未纳入本阶段、后续再做：

- marketplace
- subagent

## Goal

phase 1 的目标不是把所有 AI 能力一次做完，而是把 Juanie 的 AI 基础设施做成长期可扩展的样子，同时不破坏当前已上线的 release / incident 能力。

## Scope

phase 1 包含 6 件事：

1. 统一 AI config
2. 建 provider adapter
3. 建 prompt registry
4. 建 plugin manifest / registry
5. 建 skill registry
6. 保持现有 release / incident 路由可运行

phase 1 不包含：

- chat UI
- subagent
- marketplace
- 自定义 prompt 编辑器

## Directory Plan

```txt
docs/ai/
  2026-04-22-juanie-ai-architecture.md
  2026-04-22-juanie-plugin-system.md
  2026-04-22-juanie-phase-1-implementation-plan.md

src/lib/ai/
  config.ts
  provider/
    adapter.ts
    index.ts
    providers/
      provider-302.ts
  prompts/
    registry.ts
    resources/
      release-plan.ts
      incident-analysis.ts
  plugins/
    manifest.ts
    registry.ts
  skills/
    registry.ts
    types.ts
```

## Milestone 1: Typed Config

目标：

- 集中解析 AI 环境变量
- 固化默认 provider / model policy
- 明确 `configured` 和 `enabled` 的语义

结果：

- 所有 AI 入口都不再直接读 `process.env`
- 302 只是默认 provider，不是平台内部协议

状态：done

## Milestone 2: Provider Adapter

目标：

- 给 runtime 一个稳定 provider 接口
- 支持 `reasoning`、`toolCalling`、`json` 三种取模方式

结果：

- 旧 `core/provider.ts` 变成桥接层
- 未来新增 OpenAI / Gemini / Claude 不需要碰业务层

状态：done

## Milestone 3: Prompt Registry

目标：

- 去掉业务插件里的大段内联 system prompt
- 给每次运行明确 prompt key / version

结果：

- `release-intelligence` 和 `incident-intelligence` 都从 registry 取 prompt
- 后续 eval / 回归更容易追踪

状态：done

补充：

- environment / migration / envvar / dynamic plugin 也已接入 registry

## Milestone 4: Plugin / Skill Registry

目标：

- 把“插件”和“技能”概念分开
- 当前内建能力先走静态 registry

结果：

- plugin 负责挂载信息和能力声明
- skill 负责任务编排

状态：done

## Milestone 5: Compatibility Bridge

目标：

- 不破坏现有页面和接口
- 先把旧入口接到新骨架

结果：

- 现有 release / incident snapshot 仍能工作
- 新架构可以渐进接管旧实现

状态：done

## Test and Verification

phase 1 至少验证：

- `bun run typecheck`
- `bun run lint`
- AI provider 状态页仍然可读
- release intelligence 插件仍能注册
- incident intelligence 插件仍能注册

建议后续补充：

- config parsing tests
- prompt registry tests
- plugin registry tests
- eval fixtures for release / incident

当前仓库状态：

- config parsing tests：done
- prompt registry tests：done
- plugin registry tests：done
- eval fixtures for release / incident：done
- eval fixtures for environment / migration / envvar：done

## Implementation Notes

### Provider

- phase 1 默认保留 `302`
- 使用 `AI_302_API_KEY` 和 `AI_302_BASE_URL`
- `AI_ENABLED` 仅作为临时 override，不作为长期唯一真源

### Skills

phase 1 先注册，不强行全部实现：

- `release-skill`
- `incident-skill`
- `environment-skill`
- `migration-skill`
- `envvar-skill`

其中真正先接通的是：

- `release-skill`
- `incident-skill`

### Plugin surfaces

先只允许：

- `release`
- `release-detail`
- `environment`

减少重复入口。

## Deferred Decisions

这些事情可以在 phase 2 再定：

- 模型自动路由细则
- task center 完整状态机
- plugin marketplace 治理
- subagent 编排策略
- MCP 远程插件鉴权

## Exit Criteria

phase 1 完成的标志：

- 文档已固化到仓库
- AI 配置已集中
- provider 已抽象
- prompt registry 已接管核心能力
- plugin / skill registry 已存在
- 旧页面不报错

当前状态：

- 文档已固化到仓库：done
- AI 配置已集中：done
- provider 已抽象：done
- prompt registry 已接管核心能力：done
- plugin / skill registry 已存在：done
- 旧页面不报错：done

达到这个状态后，就可以继续做 environment summary、task center 和后续 AI surface。

当前补充：

- environment summary：done
- task center：done
- 后续 AI surface：done
