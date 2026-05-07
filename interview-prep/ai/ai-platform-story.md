# AI 平台故事

## 30 秒版本

Juanie 的 AI 不是独立聊天框，而是发布控制平面里的决策辅助层。它读取 release、environment、
deployment、schema、变量、日志和事件这些真实证据，输出结构化风险、摘要、修复建议和任务项。

一句话讲：

> Juanie 用 AI 缩短“看懂发布现场”的时间，但不让 AI 绕过门禁、审批和审计。

## 为什么 DevOps 平台需要 AI

发布事故通常不是因为没有工具，而是因为事实分散：

- CI 里有构建日志。
- Kubernetes 里有 Pod 状态。
- 数据库里有迁移历史。
- Git 里有 commit 和 MR。
- 平台里有 release 状态。
- 团队聊天里有人工判断。

AI 的价值不是替代这些系统，而是把这些证据压缩成可行动判断：

- 这次发布卡在哪个阶段？
- schema gate 为什么阻断？
- 环境变量变更有没有风险？
- 这次 incident 更像是应用启动失败、路由失败、迁移失败还是资源不足？
- 下一步应该重试、回滚、修 migration、还是进入 production rollout？

## Juanie 的 AI 定位

Juanie 的 AI 处在三个层次：

| 层次 | 作用 | 示例 |
| --- | --- | --- |
| 解释层 | 把复杂状态变成用户可读摘要 | environment summary, release recap |
| 判断层 | 对风险和异常做结构化分类 | migration review, envvar risk, incident analysis |
| 行动层 | 把判断变成任务中心里的下一步 | 修复 schema、查看日志、继续放量、暂停发布 |

它不是“随便问模型”。AI 输出必须带 scope、prompt version、skill、plugin、provider、model 和 usage
记录。这样当用户质疑“为什么 AI 这么说”时，平台能追溯当时用了什么证据、什么 prompt、什么模型和什么结果。

## 3 分钟版本

我会把 Juanie 的 AI 讲成“证据优先的 release intelligence”。

传统 DevOps 工具通常把信息展示出来，但让用户自己拼结论。比如一个发布失败，用户要自己看 CI、
deployment、Pod、Ingress、数据库、日志和 commit。Juanie 的主流程已经把 release、deployment、
schema gate、migration 和 rollout 建模成状态机，所以 AI 可以拿到更干净的上下文。

这带来两个好处：

1. AI 不需要凭空猜，它拿到的是平台已经归一化过的证据。
2. AI 的结果可以回写到平台任务，而不是停留在一段无法执行的文本。

比如 schema gate 发现迁移不匹配，AI 不只是说“可能有风险”，而是结合 Atlas diff、迁移配置、
环境策略和 release 阶段给出风险分类、解释、建议动作。用户可以继续走修复 MR/PR、重新预检、
或阻断发布，而不是复制一段模型回答去手工操作。

## AI 必须遵守的边界

| 边界 | 说明 |
| --- | --- |
| 不替代状态机 | release 成功与否由平台状态和实际验证决定，不由模型一句话决定 |
| 不绕过 schema gate | AI 可以解释和建议修复，但不能直接把风险变成通过 |
| 不偷拿跨 scope 数据 | release 插件不能默认读取整个团队数据，environment 插件只读对应环境上下文 |
| 不隐藏降级 | AI 未配置、超时或失败时，UI 必须有可理解的降级状态 |
| 不制造不可审计动作 | 写操作必须进入 task center 或明确确认流 |

## 面试里最有说服力的点

可以这样讲：

> 我们没有把 AI 当成一个漂浮助手，而是把它产品化成平台能力单元：plugin manifest 定义能力和权限，
> markdown skill/prompt 作为可审查资产，runtime 负责结构化输出和 usage 审计，eval fixtures
> 防止提示词和模型变更带来回归。最终 AI 输出进入 release/environment 页面和任务中心。

这句话能同时体现产品、架构和工程成熟度。

## 追问准备

**问：为什么不直接做 ChatOps？**

ChatOps 适合操作入口，但它不天然拥有 release 状态、schema gate、环境策略和 rollout 审计。
Juanie 先把控制平面事实建好，再让 AI 基于这些事实回答和行动。这样 AI 更可信。

**问：AI 错了怎么办？**

AI 结果不直接修改生产状态。它的输出结构化、有 scope、有 usage 记录，并通过 task center 或人工确认进入动作。
关键门禁仍由确定性逻辑、Atlas diff、Kubernetes 状态和 release 状态机控制。

**问：AI 是否会增加成本？**

会，所以 Juanie 需要模型策略、显式触发、缓存、usage 记录、团队 quota 和降级策略。当前已有 usage 记录和
provider/model 元数据，后续可以继续做成本归因和预算控制。

## 代码入口

| 主题 | 文件 |
| --- | --- |
| AI 配置 | `src/lib/ai/config.ts` |
| 内建插件 | `src/lib/ai/plugins/builtins.ts` |
| Prompt 资产 | `src/lib/ai/prompts/definitions/` |
| Skill 资产 | `src/lib/ai/skills/definitions/` |
| Runtime | `src/lib/ai/runtime/` |
| Usage 审计 | `src/lib/ai/runtime/usage-service.ts` |
| Eval fixtures | `src/lib/ai/evals/fixtures/` |
