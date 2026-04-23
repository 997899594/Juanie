# Juanie AI Assets and Deploy Rules

## Role

这份文档只回答两件事：

- Juanie 的 AI 资产现在怎么组织
- 生产环境为什么不能再被 CI 意外关掉 AI

它不是总方案文档。总方案仍以 [2026-04-22-juanie-ai-platform-plan.md](/Users/findbiao/projects/Juanie/docs/ai/2026-04-22-juanie-ai-platform-plan.md) 为准。

## Status

当前状态：

- markdown prompt assets：done
- markdown skill assets：done
- typed asset loader：done
- registry validation：done
- production AI enable rule：done

## 1. Why This Exists

之前 Juanie 的 AI 已经有：

- provider adapter
- plugin runtime
- eval fixtures
- prompt registry

但 `skills` 还不够现代化。

问题不在运行时，而在资产层：

- skill 只有 TypeScript metadata
- prompt 主要还是代码常量
- 缺少真正可读、可审查、可版本化的 markdown 资产

这会带来 3 个问题：

1. skill 定义不直观，产品和工程都不容易审
2. prompt 与 skill 边界不清楚
3. 后续做 plugin / MCP / subagent 时，资产层不够稳

所以这次不是重写 runtime，而是把 source of truth 换成 markdown assets。

## 2. Current Source of Truth

现在的真源如下：

### Skill assets

位置：

- `src/lib/ai/skills/definitions/*/SKILL.md`

每个 skill 都必须包含：

- `id`
- `title`
- `description`
- `scope`
- `pluginIds`
- `toolIds`
- `contextProviderIds`
- `promptKey`
- `outputSchema`

正文负责描述：

- responsibility
- output rules
- domain constraints

### Prompt assets

位置：

- `src/lib/ai/prompts/definitions/*.md`

每个 prompt 都必须包含：

- `key`
- `version`
- `skillId`

正文就是 system prompt。

## 3. Runtime Contract

运行时保持不变：

- registry 仍然是 typed contract
- workflow 仍然从 registry 取 prompt
- plugin runtime / eval / audit 不需要重写

现在只是把 registry 的输入从 TS 常量换成 markdown 文件。

这条路的好处是：

- 产品可读
- 工程可校验
- runtime 不被 prompt 文本污染
- 未来接 workspace plugin / MCP skill 时可以复用同一套装配方式

## 4. Validation Rules

当前已经内建的校验：

- prompt frontmatter 必须通过 schema
- skill frontmatter 必须通过 schema
- prompt frontmatter `key` 必须与 registry key 一致
- skill frontmatter `id` 必须与目录名一致

如果 markdown 资产写错，启动时就会直接失败，不允许静默漂移。

## 5. Production Deploy Rule

之前线上 AI 每次 CI 后会被关闭，根因是：

- chart 默认值把 `AI_ENABLED` 写成了 `"false"`
- 远程部署脚本使用 `helm upgrade --reset-values`
- 生产 values 没有显式覆盖 `AI_ENABLED`

这三个条件叠在一起，导致每次发布都会把 AI 配置重置成关闭。

现在的规则改成：

- `values.yaml` 不再默认写死 `AI_ENABLED`
- `values-prod.yaml` 显式写 `AI_ENABLED: "true"`
- `configmap.yaml` 只有在显式存在 `AI_ENABLED` 时才渲染这个变量

因此：

- 生产环境：明确开启
- 其他环境：如果没有显式 override，则走“有 key 即启用”的运行时逻辑

## 6. What This Means

这次改动的结论不是“AI 全部做完了”，而是：

- Juanie 的 AI runtime 骨架已经够现代
- 之前缺的是 markdown-based asset layer
- 这层现在已经补上

所以现在的形态是：

`typed runtime + markdown skills + markdown prompts + eval gates + deploy-safe config`

这才是 Juanie 当前阶段合理的 2026 形态。
