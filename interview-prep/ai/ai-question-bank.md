# AI 问题库

## Q1：Juanie 的 AI 和普通 ChatOps 有什么区别？

**30 秒回答：**

普通 ChatOps 更像一个对话入口，Juanie AI 是发布控制平面里的智能层。它基于 release、environment、
schema、deployment、事件和日志这些结构化证据输出判断，并进入任务中心和审计。

**深挖：**

ChatOps 最大问题是上下文不稳定。用户问“为什么发布失败”，模型如果拿不到 release state、
schema gate、Kubernetes 状态和迁移配置，就只能猜。Juanie 的优势是平台本身拥有发布事实，所以 AI
可以基于 evidence builder 做结构化输出。

## Q2：AI 会不会误导生产发布？

**30 秒回答：**

Juanie 不让 AI 决定生产状态。AI 负责解释、分类、建议和生成任务；真正的发布通过状态机、schema gate、
Kubernetes 验证和受控放量决定。

**深挖：**

AI 输出有 scope、plugin id、skill id、prompt version、provider/model、usage 和 status 记录。
写操作要通过 task center 或确认流。这样即使 AI 错了，也能追踪、降级、撤回或重新生成。

## Q3：怎么保证 AI 输出稳定？

**回答结构：**

1. 输入稳定：从平台 evidence builder 取结构化上下文。
2. 输出稳定：使用 Zod schema 和 typed output。
3. 资产稳定：prompt/skill 是 markdown 真源，有 key/version。
4. 回归可测：eval fixtures 覆盖环境摘要、变量风险、发布计划、故障分析、迁移评审。
5. 运行可查：usage 记录模型、token、延迟和错误。

## Q4：为什么 AI 要做 plugin system？

**30 秒回答：**

因为 DevOps 平台里的 AI 不是一个能力，而是一组可治理能力。Plugin manifest 描述 scope、权限、
surface 和 capability，runtime 执行并审计，UI 根据对象页自然挂载。

**追问：为什么不用函数调用列表？**

函数调用只解决模型能调什么工具，不解决这个能力属于哪个团队/项目/环境/发布，不解决 UI 应该在哪出现，
不解决审计和权限边界。Plugin 是产品和治理单元。

## Q5：AI 如何参与 schema safety？

**回答：**

Atlas 和确定性规则负责 diff、检查和门禁，AI 负责解释风险和修复路径。比如出现缺失迁移，AI 可以基于
diff、迁移配置和目标环境策略解释“为什么挡住、可能影响什么、建议怎么修”，但不会直接越过门禁。

## Q6：为什么不让 AI 自动生成并合并迁移？

**回答：**

可以做辅助生成，但不应该默认自动合并。数据库迁移有不可逆风险，正确路径是 AI 生成修复建议或 MR/PR，
再经过 review、CI、schema gate 和 release 状态机。面试里可以说：Juanie 的目标是逐步自动化，
但在生产数据面前先保证审计和确认。

## Q7：AI 成本如何控制？

**回答：**

当前已经有 provider/model、token usage、latency 和 status 记录。后续可以围绕这些数据做：

- 团队级额度。
- 免费/Pro/Scale/Enterprise model policy。
- release 级成本归因。
- 缓存和显式刷新。
- 高价值场景优先触发，低价值说明不自动生成。

## Q8：AI 如果没有配置会怎样？

**回答：**

AI 不应该是主链路硬依赖。未配置或失败时，发布、schema gate、部署、放量这些确定性流程继续工作。
UI 展示降级原因，不伪装成 AI 正常生成。

## Q9：你如何向 PM 解释 AI 的商业价值？

**回答：**

我会说 Juanie AI 降低的是“发布判断成本”。资深工程师可以自己看日志、K8s、schema diff 和 CI，
但团队规模变大后，这些判断会变成瓶颈。AI 帮用户更快知道风险、卡点和下一步，从而提升发布成功率、
缩短 MTTR、减少误操作。

## Q10：你如何向技术面试官解释 AI 的工程成熟度？

**回答：**

我会从五个点讲：

- Provider adapter，而不是模型硬编码。
- Markdown prompt/skill assets，而不是散落常量。
- Plugin manifest/scope/permission，而不是页面随意调用。
- Structured output/eval fixtures，而不是纯自然语言。
- Usage/audit/degradation，而不是不可追踪黑盒。
