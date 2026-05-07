# PM 问题库

## Q1：Juanie 的目标用户是谁？

**回答：**

早期目标用户是需要快速上线但又不想牺牲发布安全的产品工程团队，尤其是小团队技术负责人、
后端工程师、产品工程师和平台工程师。PM/QA 也会通过 preview 和 release 状态参与协作。

## Q2：你怎么定义 Juanie 的核心价值？

**回答：**

不是“能部署”，而是“能更有信心地发布”。Juanie 把环境、schema、release、preview、production rollout、
AI 诊断和审计放到同一条主链里，减少发布风险和排障成本。

## Q3：为什么默认只给 staging 和 production 两个持久环境？

**回答：**

这样心智更清楚。Preview 负责需求/分支级验证，可以有很多个；staging 负责团队级验证；production 负责正式流量。
如果默认暴露太多环境，用户会不知道每个环境的职责，也会增加治理成本。

## Q4：Preview 和 staging 有什么区别？

**回答：**

Preview 是短生命周期、需求级、分支级环境，目标是让一个变更能被快速看见。Staging 是持久团队验证环境，
目标是承接集成验证和生产提升前的稳定版本。

## Q5：为什么 AI 是产品核心而不是附加能力？

**回答：**

因为发布过程中最贵的是判断。用户并不缺状态和日志，而是缺“这意味着什么、下一步做什么”。
Juanie 拥有 release/environment/schema 的结构化事实，AI 可以基于这些事实生成可信解释和任务。

## Q6：如何避免 AI 功能变成噪音？

**回答：**

AI 不做全局刷屏，而是在对象页和关键阶段出现，比如 schema gate、release detail、environment summary、
incident analysis。没有真实摘要时不要展示大块占位，输出要可折叠、有依据、可降级。

## Q7：你如何设计定价？

**回答：**

可以按项目/环境/团队席位作为基础，再按高级能力分层：

- Free：基础发布、preview 限额、少量 AI。
- Pro：更多 preview、schema safety、release intelligence。
- Scale：production rollout、团队治理、成本归因。
- Enterprise：自托管、SSO、审计、私有模型/密钥、策略引擎。

关键是 AI 成本要有 usage 和 quota 支撑，不能无限隐性补贴。

## Q8：如何判断 Juanie 是否达成 PMF？

**回答：**

看用户是否把 Juanie 当成发布主入口，而不是偶尔打开的部署面板。指标上看 production release 完成数、
preview lead time、schema gate resolution time、发布失败恢复时间、团队留存和 AI 建议采纳率。

## Q9：竞品很多，Juanie 的差异化是什么？

**回答：**

Juanie 不只做 CI/CD，也不只做 PaaS。它把 release 状态机、schema safety、preview、controlled rollout
和 AI intelligence 组合到一个控制平面里。差异化在“发布可信”而不是“资源更多”。

## Q10：如果只能做一个功能提升留存，你做什么？

**回答：**

我会优先保证 release 黄金路径稳定，特别是 preview、schema gate 和 production rollout。
AI 也重要，但 AI 必须服务这个路径。用户留存来自每次发布都能依赖平台，而不是某个炫酷功能。
