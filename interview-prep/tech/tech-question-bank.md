# 技术问题库

## Q1：Juanie 的整体架构是什么？

**回答：**

Next.js API 接收意图，PostgreSQL 存状态，BullMQ worker 执行长任务，Kubernetes/Argo/Helm/CloudNativePG
负责基础设施控制，Atlas 负责 schema diff 和控制面迁移，SSE 推送实时状态，AI plugin runtime 基于平台证据生成结构化判断。

## Q2：为什么需要 BullMQ？

**回答：**

发布、初始化、迁移、删除都可能很慢，需要重试、恢复、日志、阶段状态和实时事件。HTTP 请求不应该持有这些长任务。

## Q3：平台自身发布和用户应用发布为什么不是同一条路径？

**回答：**

平台自身是 first-party control plane，适合 GitOps。用户应用发布频繁、状态实时、需要 schema gate、promotion、
AI 和任务中心，不适合每次都写 GitOps 指针。两者共享平台能力，但边界不同。

## Q4：控制面为什么用 Drizzle + Atlas？

**回答：**

Drizzle 对 TypeScript schema authoring 友好；Atlas 更适合 migration hash、validate、diff 和执行。
控制面迁移只走 Atlas，避免 Drizzle push、SQL 脚本和 Atlas 多路径冲突。

## Q5：子应用 schema 如何处理？

**回答：**

子应用可以用自己的 ORM 和 migration。Juanie 用 Atlas 做 diff/safety/repair 和 gate，实际迁移执行按
`juanie.yaml` 声明的工具、命令、工作目录和审批策略。

## Q6：Preview 如何直接基于分支最新 commit？

**回答：**

创建 preview 时解析远端分支或 MR/PR 的最新 commit，创建 preview environment 和 release 状态，
再由 release/deployment worker 执行构建/部署/验证。用户不需要为了 preview 再 push 空提交。

## Q7：SSE 的状态真源在哪里？

**回答：**

状态真源是数据库和 worker 事件，SSE 只是实时传输层。断线后 UI 应能通过重新查询恢复当前状态。

## Q8：AI 架构如何避免变成黑盒？

**回答：**

通过 provider adapter、markdown prompt/skill、plugin manifest、structured output、eval fixtures、
usage record、scope/permission 和 degraded reason。AI 输出不直接决定生产状态。

## Q9：如何处理 Kubernetes 更新冲突？

**回答：**

更新已有资源时要尊重 Kubernetes resourceVersion 或使用 patch 语义，避免 replace 时丢失 live metadata。
更重要的是能交给控制器的期望态尽量交给 Helm/Argo/Rollouts，不手写完整控制器。

## Q10：如果 release 卡住你怎么排查？

**回答：**

按链路查：release DB 状态 -> BullMQ job -> worker logs -> schema runner job -> deployment/K8s events ->
Argo/Rollout 状态 -> SSE 是否漏事件。不要直接从 UI 文案判断根因。

## Q11：如何设计幂等删除？

**回答：**

删除应先把项目置为 deleting，再由后台清理资源。每个清理步骤要可重复执行，不因资源已不存在而失败。
最终通过 SSE 通知列表移除。

## Q12：你认为这个项目最难的技术点是什么？

**回答：**

不是某个 API，而是保持边界干净：平台自身 GitOps 和子应用 release state machine 不混；Atlas 作为控制面迁移真源和子应用 safety
工具不混；AI 解释和确定性门禁不混；K8s helper 和控制器职责不混。
