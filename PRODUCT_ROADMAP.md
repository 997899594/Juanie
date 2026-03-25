# Juanie Product Roadmap

## 定位

Juanie 的产品定位收敛为：

**AI 原生发布控制平面**

它解决的核心问题不是“帮用户多配几个 DevOps 页面”，而是：

- 安全发布
- 可审计迁移
- 可控审批
- 面向分支和 PR 的临时环境
- 发布失败后的自动判断与下一步建议

Juanie 不再把自己定义为通用 CI 平台、通用 Kubernetes 面板或通用 Webhook 管理器。

## 产品支柱

未来产品只围绕 4 个支柱展开：

### 1. Release Control

- release-first 发布模型
- preDeploy / postDeploy / manual migration
- 环境保护与审批
- promote / rollback / retry

### 2. Preview Environments

- 基于分支 / PR 的临时环境
- 自动回收
- 可分享链接
- 可选临时数据库策略

### 3. Release Intelligence

- 发布前风险总结
- 迁移计划解释
- 发布失败自动归因
- 推荐下一步动作

### 4. Platform Governance

- 环境级权限
- 生产保护策略
- 配额 / 使用量 / 成本归因
- 审计与变更追踪

## 明确裁剪

以下能力不再作为核心产品方向：

### 项目级自定义 Webhook

项目级“部署通知 Webhook”不构成核心差异化，也不属于发布控制平面的中心能力。

处理原则：

- 从产品导航移除
- 从项目页面移除
- 删除用户侧 CRUD API
- 不再继续扩展这块功能

保留项：

- 平台内部 registry webhook
  说明：这是镜像推送触发 release 的基础设施，不属于用户业务功能

### 手工 YAML 流水线编辑器

这类能力不再作为核心方向投入。后续仅在明确有平台化价值时再评估。

### 资源浏览器

资源浏览器保留排障用途，但不作为产品主叙事继续扩张。

## 当前阶段优先级

### P0

- 清理非核心业务入口
- 把首页与项目首页完全对齐 release-first 心智
- 补 release 风险与失败原因模型

### P1

- Preview environments
- release diff
- environment TTL / 自动清理
- production policy engine

### P2

- AI 风险总结
- 发布失败自动归因
- 成本 / 配额 / 使用量
- 更细粒度权限

## 当前进度

### Release Control

- 已完成：release-first 主链、迁移编排、审批/重试、发布详情、发布列表、基础 release diff
- 当前进度：约 75%

### Preview Environments

- 已完成：preview 环境自动解析、创建、域名、过期回收、环境页与发布页展示
- 当前进度：约 60%

### Release Intelligence

- 已完成：风险等级、问题码、下一步动作、列表与详情摘要、服务端 release list 投影
- 当前进度：约 55%

### Platform Governance

- 已完成：基础角色、审计与一部分生产审批语义
- 当前进度：约 20%

### 当前最大硬债

- Drizzle 基线已在开发库重置，但历史 migration 体系仍是“开发期新基线”，不是可追溯生产迁移链
- 配额、成本、策略引擎仍未进入主线

## 设计原则

- 产品页面必须围绕 release 和 environment 组织，而不是围绕杂项工具组织
- 不再增加与核心发布控制无关的后台能力
- 平台基础设施与用户业务能力严格分层
- AI 能力必须进入发布决策链，而不是停留在 marketing 文案

## 当前执行决策

本轮先执行：

1. 删除项目级 Webhook 业务入口与 CRUD API
2. 保留 registry webhook 基础设施
3. 后续直接进入 Preview environments 与 release intelligence 开发
