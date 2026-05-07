# PM 路线：指标体系

## 北极星指标

推荐北极星指标：

> 安全完成的生产发布次数。

它比“部署次数”更好，因为 Juanie 的价值不是多点按钮，而是让发布更可信。

## 一级指标

| 指标 | 为什么重要 |
| --- | --- |
| Release success rate | 发布是否稳定完成 |
| Lead time to preview | 分支到可访问 preview 的速度 |
| Lead time to staging | commit 到 staging 可验证的速度 |
| Production rollout completion rate | 生产受控放量是否闭环 |
| Schema gate resolution time | 数据库阻断到修复的速度 |
| MTTR | 发布失败后的恢复速度 |
| AI-assisted resolution rate | AI 是否帮助用户进入下一步 |

## 漏斗指标

### 创建/导入项目

- 仓库验证成功率。
- 配置注入成功率。
- 首发 CI 触发成功率。
- 首个 staging release 成功率。
- 创建失败后用户重试率。

### Preview

- Preview 创建成功率。
- 分支解析失败率。
- Preview 首屏可访问时间。
- Preview 提升到 staging 的比例。

### Release

- queued 到 running 时间。
- schema gate 阻断率。
- migration 成功率。
- deployment 成功率。
- verification 成功率。
- awaiting rollout 到 completed 时间。

### AI

- AI 生成成功率。
- AI 降级率。
- 用户展开 AI 依据率。
- AI 建议采纳率。
- AI 输出重试率。
- Token cost per release。

## 质量指标

| 指标 | 解释 |
| --- | --- |
| False positive schema block | 门禁误挡会损害信任 |
| False negative schema risk | 漏挡会造成事故 |
| AI hallucination report | AI 解释错误要可追踪 |
| SSE event delay | 实时体验是否可信 |
| Cleanup completeness | 删除项目是否无残留 |
| Release trace completeness | 排障链路是否能串起来 |

## 面试回答模板

如果面试官问“怎么衡量 Juanie 成功”，可以这样答：

> 我不会只看部署次数，因为部署次数增加可能只是用户更频繁地点按钮。Juanie 解决的是发布信心，
> 所以我会看安全完成的生产发布次数、发布成功率、schema gate resolution time、preview lead time、
> MTTR 和 AI-assisted resolution rate。这样能同时衡量效率、稳定性和智能能力的真实价值。
