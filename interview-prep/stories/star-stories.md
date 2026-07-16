# STAR 故事库

## 故事 1：把 Juanie 从部署面板重构成发布控制平面

**Situation：** 早期系统里环境、部署、数据库、preview、AI 和生产放量概念分散，容易出现多条路径和用户心智不清。

**Task：** 重新定义主链路，让用户围绕 release 和 environment 完成从分支到生产的闭环。

**Action：**

- 区分平台自身发布和用户应用发布。
- 明确 preview/staging/production 职责。
- 引入 schema gate、promotion、controlled rollout。
- 清理旧部署路径和重复迁移路径。
- 将 AI 放到 release/environment/schema 证据链里。

**Result：** 系统讲法从“部署功能集合”变成“AI 原生发布控制平面”，面试和产品表达更统一。

## 故事 2：Schema gate 阻断发布但给出修复路径

**Situation：** 子应用可能忘记生成 migration，或 migration 和 ORM 最终 schema 不一致。

**Task：** 既不要强迫用户维护两套 schema，又要在发布前发现风险。

**Action：**

- 控制面迁移只走 Atlas。
- 子应用迁移执行尊重 `juanie.yml`。
- 平台用 Atlas 做 diff/safety/repair。
- AI migration review 解释风险和下一步。

**Result：** 数据库安全成为 release 主链能力，而不是 CI 失败后用户自己猜。

## 故事 3：Preview 创建不再要求用户多提交一次

**Situation：** 用户希望基于现有远端分支最新 commit 创建 preview，不想为了触发 preview 制造空提交。

**Task：** 让 preview 心智变成“选分支生成环境”。

**Action：**

- 解析远端 branch/MR latest commit。
- 持久化 preview build source/status。
- 通过 ApplicationSet 和 release 状态机创建环境。
- 加强数据库策略保护。

**Result：** Preview 更接近现代开发体验，减少用户对 CI 触发细节的理解成本。

## 故事 4：AI 从聊天变成平台能力

**Situation：** 单纯聊天式 AI 很容易脱离上下文，也很难审计。

**Task：** 让 AI 成为可信的 DevOps 能力。

**Action：**

- 设计 plugin manifest、scope、permission 和 surface。
- prompt/skill markdown 资产化。
- 输出 schema 化。
- 引入 eval fixtures。
- 记录 usage、model、prompt version 和 degraded reason。

**Result：** AI 可以进入 release/environment/schema 主流程，同时保持可治理和可追踪。
