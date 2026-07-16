# PM 路线：Roadmap

## 当前阶段目标

当前最重要的是让黄金路径稳定：

1. 导入或创建项目。
2. 平台注入正确 CI 和 `juanie.yml`。
3. Staging 首发成功。
4. Preview 可基于分支最新 commit 创建。
5. Preview 可提升到 staging。
6. Staging 可提升到 production。
7. Production release 可完成 controlled rollout。
8. Schema gate、AI 解释、SSE 进度和删除清理闭环。

## 近期优先级

### P0：发布链路可靠性

- 更完整 E2E。
- release/deployment/schema 状态一致性。
- 长任务超时和重试策略。
- 删除项目幂等清理。

### P1：AI 闭环

- AI 摘要和任务中心更紧密。
- AI 输出带依据和可折叠详情。
- schema repair 建议更可执行。
- usage 和成本归因进入团队视图。

### P2：治理

- 团队 binding 默认身份更可视。
- 环境级权限和审批策略。
- Secret/TLS/RBAC 基线产品化。
- 审计日志检索体验。

### P3：规模化

- 多项目 release dashboard。
- SLO 和健康画像。
- 更细粒度策略引擎。
- 插件生态和 MCP 扩展。

## 不建议过早做

- 插件市场。
- 自动写生产数据库。
- 大而全监控平台。
- 复杂账单系统。
- 子应用全量 GitOps 化。
- 用户自定义任意 prompt。

原因是这些会把主链路冲散。Juanie 现在应该先把“发布可信”做到极稳。

## AI Roadmap

| 阶段 | 能力 |
| --- | --- |
| 当前 | provider adapter, markdown prompt/skill, plugin runtime, eval fixtures, task center |
| 下一步 | 更强 AI 依据展示、AI 任务闭环、成本归因、团队 quota |
| 再下一步 | 写操作审批、跨 release 学习、组织级知识库、MCP 受控扩展 |
| 长期 | release copilot 从解释走向半自动编排，但关键生产动作仍可审计 |
