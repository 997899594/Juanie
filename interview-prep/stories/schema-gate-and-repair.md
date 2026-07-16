# 故事：Schema 门禁与修复

## 30 秒版本

Schema gate 是 Juanie 的核心差异化。它解决的是“代码能部署，但数据库变更是否安全”的问题。
Juanie 用 Atlas 做 diff/safety/repair，用 AI 解释风险，用 release 状态机阻断或推进发布。

## Situation

子应用开发中常见：

- ORM 模型变了但忘了 migration。
- migration 顺序乱。
- migration 有，但不能准确表达目标 schema。
- preview 数据库策略选择错误，可能影响继承源。
- production 前才发现数据库不一致。

## Task

设计一个既现代又不过度接管的方案：

- 不强迫用户换 ORM。
- 不让平台猜用户迁移命令。
- 不让危险 schema 变更直接上线。
- 给用户清楚解释和修复路径。

## Action

- 控制面 migration 唯一走 Atlas。
- 子应用 migration 执行按 `juanie.yml`。
- 平台层使用 Atlas diff/safety 做门禁。
- schema repair 可以引导用户生成 MR/PR 或修复建议。
- AI migration review 把技术 diff 翻译成风险和下一步。

## Result

Schema 从“CI 脚本里的一行命令”变成 release 主链的一等公民。用户遇到阻断时不只是看到失败，而是知道：

- 哪个数据库有问题。
- 为什么这次发布不能继续。
- 应该补 migration、审批 destructive change，还是调整配置。

## 面试追问

**问：这会不会过度设计？**

回答：不会，因为数据库变更是生产事故高发区。过度设计是平台强制接管用户所有 ORM；Juanie 的设计是保留用户工具，
平台负责发布前安全判断和审计。

**问：AI 在这里是不是可有可无？**

回答：确定性 gate 可以没有 AI 也运行，但 AI 能显著降低理解成本。Atlas 告诉你 diff，AI 帮你解释 diff 为什么危险、
可能影响什么、下一步怎么修。
