# PM 路线：用户场景

## 场景 1：导入现有仓库并首发

**用户目标：** 我有一个 GitHub/GitLab 仓库，希望不用手写一堆 DevOps 配置就能部署到可访问环境。

**Juanie 做什么：**

- 验证仓库和团队集成身份。
- 注入 Juanie 管理的 CI 和 `juanie.yaml`。
- 创建命名空间、环境、数据库、变量和 DNS/TLS。
- 触发首发构建。
- 通过 SSE 展示初始化进度。

**PM 重点：** 创建项目不是表单提交后让用户等，它应该是一条可感知、可恢复、可解释的初始化流程。

## 场景 2：基于分支创建 preview

**用户目标：** 我有一个需求分支，想直接看到最新 commit 的可访问环境，不想为了 preview 再提交一次代码。

**Juanie 做什么：**

- 解析远端分支最新 commit。
- 创建 preview environment。
- 复用 ApplicationSet scaffold。
- 触发对应 release。
- 持久化 preview build 状态。

**PM 重点：** Preview 是需求级验证能力，用户心智应该是“选分支 -> 生成可看环境”，不是“学部署系统”。

## 场景 3：Schema gate 阻断发布

**用户目标：** CI 报错说 schema 门禁没过，我想知道为什么、怎么修、是否危险。

**Juanie 做什么：**

- 使用 Atlas diff/safety 检查。
- 识别缺失 migration、危险变更或不一致状态。
- 在 release detail/schema 页面展示阻断原因。
- AI 给出解释和修复建议。
- 可进入修复 MR/PR 或重新预检路径。

**PM 重点：** 数据库门禁不能只是“红了”，必须给用户“为什么”和“下一步”。

## 场景 4：Staging 提升到 Production

**用户目标：** staging 已验证，希望把同一个版本提升到 production，代码和数据状态不要漂移。

**Juanie 做什么：**

- 基于源环境 release 创建 promotion。
- 保持 commit、artifact 和环境策略可追踪。
- production 可以进入 controlled rollout。
- release detail 指导用户继续放量、暂停或回滚。

**PM 重点：** 提升不是重新随便部署一次，而是把已验证版本作为候选版本推进。

## 场景 5：发布失败排障

**用户目标：** 发布失败了，我不想在 CI、K8s、数据库和日志之间来回翻。

**Juanie 做什么：**

- 收集 release、deployment、schema、workload 和事件上下文。
- 展示当前阶段和失败原因。
- AI 生成 incident analysis。
- 任务中心给出下一步动作。
- trace 串联 release/deployment/migration。

**PM 重点：** 好的 DevOps 产品不是只告诉用户失败，而是减少用户从失败到行动的时间。

## 场景 6：删除项目

**用户目标：** 删除项目时知道平台正在清理什么，最终不要留下资源和状态。

**Juanie 做什么：**

- 给项目进入 deleting 状态。
- 后台清理环境、数据库、release、K8s 资源和平台记录。
- SSE 通知列表移除。
- 避免重复删除造成脏状态。

**PM 重点：** 删除是生命周期的一部分，不是边角按钮。
