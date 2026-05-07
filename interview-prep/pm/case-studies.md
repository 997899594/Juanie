# PM 路线：案例表达

## 案例 1：Preview 创建现代化

**背景：** 用户希望基于某个分支直接创建 preview，看最新 commit，不想为了触发部署再提交一次。

**问题：** 传统做法把 preview 和 CI push 绑定太死，用户心智变成“我得制造一次提交”，这不现代。

**方案：** Juanie 解析远端分支最新 commit，创建 preview environment，持久化 preview build 状态，并走 release
状态机部署。

**价值：** 用户从“为了部署改代码”变成“选择分支生成环境”，preview 成为需求验证的一等入口。

## 案例 2：Schema 门禁

**背景：** 子应用经常出现 ORM 模型变化、migration 遗漏或迁移描述不准确。

**问题：** 如果平台只执行子应用脚本，无法提前知道 schema 风险；如果平台强制接管所有迁移，又会要求用户维护两套模型。

**方案：** Juanie 使用 Atlas 做 diff/safety/repair，实际迁移执行尊重 `juanie.yaml` 和子应用工具配置。

**价值：** 用户保留自己的 ORM 和迁移习惯，同时平台能在发布前识别风险并给出修复建议。

## 案例 3：Production 受控放量

**背景：** staging 已经验证，但 production 不应该默认一步全量。

**问题：** 很多平台只提供“部署成功/失败”，但生产发布还需要放量、暂停和回滚。

**方案：** Juanie 通过 promotion 创建 production release，必要时进入 controlled rollout，由 Argo Rollouts 管理。

**价值：** production 从一次性动作变成可控过程，用户能在 release detail 里看到候选版本、状态和下一步。

## 案例 4：AI 发布解释

**背景：** 发布详情页信息很多，用户不想在状态、日志、schema、环境变量之间来回推理。

**问题：** 信息多不等于判断清楚。

**方案：** AI 基于 release evidence 生成结构化摘要、风险、阻塞和下一步，并记录 plugin/skill/prompt/model/usage。

**价值：** 用户更快理解现场，同时平台保留审计和降级能力。
