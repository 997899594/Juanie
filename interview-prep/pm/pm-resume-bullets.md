# PM 简历表达

## 版本 1：偏产品策略

- 设计并推进 AI 原生 DevOps 发布控制平面，围绕 preview、schema safety、release orchestration、
  production rollout 和 AI diagnosis 建立从分支到生产的完整发布闭环。
- 将产品定位从部署面板升级为 release control plane，明确 preview/staging/production 环境分工，
  降低用户在发布、数据库变更和生产放量中的决策成本。
- 规划 AI release intelligence 能力，将模型输出从聊天式回答收敛为基于 release/environment/schema
  证据的结构化摘要、风险解释和任务建议。

## 版本 2：偏增长与指标

- 建立发布链路指标体系，覆盖 preview lead time、release success rate、schema gate resolution time、
  production rollout completion rate、MTTR 和 AI-assisted resolution rate。
- 围绕项目导入、首发构建、preview 创建、staging 提升和 production 放量梳理核心转化漏斗，
  定位并减少发布链路中的阻断和等待。

## 版本 3：偏平台治理

- 推动团队集成身份、环境策略、Secret/TLS/RBAC、安全门禁和审计能力产品化，使发布流程从个人脚本转向团队级治理。
- 将数据库 schema 风险纳入发布主链，通过 Atlas diff/safety、AI migration review 和修复任务降低生产数据库变更风险。

## 版本 4：偏 AI 产品

- 设计 AI plugin/runtime 产品模型，围绕 environment summary、release intelligence、incident intelligence、
  migration review 和 envvar risk 构建可治理、可审计、可评测的 AI DevOps 能力。
- 推动 prompt/skill markdown asset 化和 eval fixtures，引入 prompt version、skill id、plugin id、
  provider/model 和 usage 记录，提升 AI 输出可追踪性与产品可信度。
