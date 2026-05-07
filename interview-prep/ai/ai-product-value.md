# AI 产品价值

## 30 秒版本

Juanie AI 的产品价值不是“更聪明的聊天”，而是让用户更快理解发布现场、更早发现风险、更少依赖资深工程师手工排障。

它直接服务四个用户目标：

- 发布前知道风险。
- 发布中知道卡点。
- 发布失败知道下一步。
- 发布后知道是否可以继续放量。

## 用户痛点

DevOps 场景里，用户最痛的不是缺少日志，而是缺少判断：

| 场景 | 用户真实问题 |
| --- | --- |
| 发布前 | 这次数据库变更会不会炸？ |
| 发布中 | 为什么一直卡在 migration 或 rollout？ |
| 发布失败 | 是代码、镜像、变量、数据库还是集群问题？ |
| Preview | 这个分支能不能马上看？ |
| Production | 我现在能不能继续放量？ |
| 环境变量 | 这个配置改动会不会影响连接、鉴权或数据安全？ |

AI 的产品价值就是把这些“需要资深工程师拼现场”的问题变成可理解、可追踪、可行动的提示。

## PM 视角的 AI 主线

Juanie AI 应该沿着用户旅程出现，而不是到处抢注意力：

1. 创建项目时：解释导入、CI、环境和数据库准备进度。
2. 创建 preview 时：说明源分支、commit、数据库策略和构建状态。
3. Schema gate 时：解释为什么阻断、影响范围、修复选项。
4. Release detail 时：总结变更、风险、阶段、下一步。
5. Production rollout 时：给出是否继续放量的证据提示。
6. Incident 时：把事件、状态、日志归纳成排障路径。

## 成功标准

AI 功能不能只看调用次数。更好的指标是：

| 指标 | 意义 |
| --- | --- |
| AI 摘要打开率 | 用户是否需要 AI 解释当前对象 |
| AI 建议采纳率 | AI 是否真正减少决策成本 |
| Schema 修复转化率 | 从阻断到修复 MR/PR 或配置调整的比例 |
| Incident 定位时间 | AI 是否缩短 MTTR |
| 发布失败后下一步点击率 | 用户是否从“懵”变成“知道做什么” |
| 输出重试率 | 模型输出是否稳定 |
| 降级率 | provider、配置、schema 输出失败是否可控 |
| Token 成本 / release | AI 成本是否和核心业务价值匹配 |

## 产品取舍

| 取舍 | 推荐答案 |
| --- | --- |
| 为什么不全自动修复？ | 生产 DevOps 场景风险高，AI 先做证据压缩和建议，写操作走审批或任务中心 |
| 为什么不做一个全局聊天入口？ | 全局聊天容易脱离上下文，Juanie 更适合对象页内的 release/environment/schema intelligence |
| 为什么要 eval？ | AI 输出不是 UI 文案，它会影响发布决策，必须像代码一样防回归 |
| 为什么要 usage 记录？ | 成本、质量、审计、问题复盘都依赖可追踪运行记录 |
| 为什么 AI 可以提升产品壁垒？ | Juanie 拥有结构化发布事实，通用聊天工具拿不到完整上下文和状态机 |

## 15 分钟深挖

可以把 AI 价值拆成三条产品线：

### 1. Release Intelligence

用户进入 release detail，不应该看到一堆状态块再自己推理。AI 应该回答：

- 这次发布是什么？
- 当前卡在哪？
- 哪些风险来自代码，哪些来自 schema，哪些来自运行态？
- 下一步是什么？

### 2. Environment Intelligence

环境页最容易变成资源堆叠。AI 应该回答：

- 这个环境当前是否健康？
- 它运行哪个 commit？
- 数据库和变量有没有明显风险？
- 和目标环境相比是否可以提升？

### 3. Schema / Incident Intelligence

这是 AI 最有商业价值的地方，因为排障和数据库变更是发布恐惧的核心来源。

AI 不直接替用户操作数据库，而是解释 diff、风险、缺失迁移、修复路径和验证方式。这样可以减少低级误操作，
也能让不熟悉数据库的人理解为什么发布被挡住。

## 反面设计

面试里可以主动说“我不会这么做”：

- 不会把 AI 入口塞满每个页面。
- 不会用 AI 文案替代真实状态。
- 不会把模型回复当作 release 成功条件。
- 不会让 AI 默认读取跨项目、跨团队数据。
- 不会让用户为了一句总结等待整个发布流程。

这能体现产品克制。

## 代码入口

| 主题 | 文件 |
| --- | --- |
| Release AI 服务 | `src/lib/ai/runtime/release-analysis-api.ts`, `src/lib/ai/runtime/release-plugin-service.ts` |
| Environment AI 服务 | `src/lib/ai/runtime/environment-analysis-api.ts`, `src/lib/ai/runtime/environment-plugin-service.ts` |
| Task center | `src/lib/ai/tasks/` |
| Evidence | `src/lib/ai/evidence/` |
| AI UI 输出模型 | `src/lib/ai/tasks/view-model.ts` |
