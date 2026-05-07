# PM 路线：产品策略

## 30 秒版本

Juanie 的策略不是做一个“功能最全的云平台”，而是先把 release 主链闭环做深：

项目创建 -> preview -> staging -> schema gate -> production promotion -> controlled rollout -> AI diagnosis -> audit。

## 战略判断

### 1. 先做发布闭环，不先做资源大杂烩

云平台很容易扩成数据库、缓存、域名、监控、日志、权限、账单、AI、市场全部都做。Juanie 应该避免这种发散。

核心判断是：所有能力都要服务 release confidence。

如果一个功能不能回答“这次能不能安全上线”，就应该晚一点做。

### 2. 把数据库变更放进发布主链

很多平台把数据库当成外部问题。Juanie 不能这样，因为真实生产事故里 schema 和 migration 是高频风险源。

产品上要把 schema gate 做成一等公民：

- 发布前检查。
- 阻断有解释。
- AI 给修复建议。
- 修复后可重新预检。
- 结果进入 release 历史。

### 3. AI 要跟主链路绑定

AI 如果只是全局助手，很容易变成噪音。Juanie 的 AI 应该在用户最需要判断的时刻出现：

- schema gate 阻断。
- release 卡住。
- preview 创建失败。
- production 待放量。
- 环境状态不清楚。

### 4. 默认环境少而清楚

默认只给用户两个持久环境更好：staging 和 production。Preview 按需求/分支生成。

这样心智简单：

- Preview：每个需求自己的验证场。
- Staging：团队默认验证场。
- Production：正式流量场。

## 不做什么

| 不做 | 原因 |
| --- | --- |
| 不强制子应用 GitOps | 容易制造脏历史，不如 release state machine 实时 |
| 不把 AI 到处塞 | 用户需要下一步，不需要每页大段 AI 文案 |
| 不把 production 做成随便直接部署 | 正式环境应该以提升和放量为主 |
| 不让用户维护两套 schema 真源 | 子应用随意 ORM，平台做 diff/safety/repair 和迁移门禁 |
| 不把 preview 当 staging 替代 | preview 是需求级，staging 是团队级 |

## 产品阶段

### Phase 1：发布可信

- 项目导入/创建稳定。
- Staging 首发稳定。
- Preview 基于分支最新 commit。
- Schema gate 能阻断并解释。
- Production promotion + controlled rollout 闭环。
- 删除项目能干净清理。

### Phase 2：智能诊断

- Release intelligence。
- Environment summary。
- Migration review。
- Envvar risk。
- Incident analysis。
- Task center 闭环。

### Phase 3：治理与规模化

- 团队级 quota。
- AI 成本归因。
- 更细粒度 RBAC。
- 策略引擎。
- 多项目 release dashboard。
- 更强 E2E 和 SLO。

## 面试金句

- “Juanie 不是要替代所有 DevOps 工具，而是把发布决策链统一起来。”
- “AI 不是入口，release 才是入口；AI 是 release 上的判断能力。”
- “我们把 schema 作为发布主链的一等公民，因为数据库事故不会因为平台不建模就不存在。”
- “子应用发布不强制 GitOps，是为了避免把实时发布状态变成 Git 历史噪音。”
