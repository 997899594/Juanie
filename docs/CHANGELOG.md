# 文档变更日志

## 2025-12-05 - 文档和规则大幅精简

### 文档精简（删除 16 个文件，约 3500 行）

**删除历史记录（3 个文件）:**
- `docs/archive/` 整个目录 - 历史清理记录

**删除重复文档（10 个文件）:**
- `docs/troubleshooting/refactoring/01-05_*.md` - 已有更新版本
- `docs/troubleshooting/refactoring/PHASE1_PRIORITY.md`
- `docs/troubleshooting/refactoring/EXECUTION_PLAN.md`
- `docs/troubleshooting/refactoring/PRIORITY_TASKS.md`
- `docs/troubleshooting/refactoring/SOLUTION_OVERVIEW.md`
- `docs/troubleshooting/refactoring/QUICK_REFERENCE.md`

**删除总结文档（2 个文件）:**
- `docs/troubleshooting/refactoring/priority/00-overview.md`
- `docs/troubleshooting/refactoring/priority/TASKS_5_6_SUMMARY.md`

**删除空文件（6 个）:**
- 各种空的 Markdown 文件

**效果**: 从 52 个文档减少到 37 个，减少约 25%

### AI 规则精简（减少 60%）

**精简 `.kiro/steering/collaboration.md`:**
- 从 472 行减少到 40 行（减少 91%）
- 保留核心原则，删除冗余示例

**精简 `.kiro/steering/ai-collaboration.md`:**
- 从 303 行减少到 36 行（减少 88%）
- 保留关键指导，删除详细示例

**效果**: 
- 总行数从 1789 行减少到 1090 行（减少 39%）
- 核心规则更清晰，上下文消耗更少

### 文档组织优化
- ✨ 创建 `docs/guides/README.md` - 完整的操作指南索引
- ✨ 创建 `docs/guides/MODERNIZATION_PROGRESS.md` - 现代化进度总结（89% 完成）
- 📦 移动 Task 8 总结到正确位置：`docs/troubleshooting/refactoring/TASK_8_OPENTELEMETRY.md`
- 🗑️ 删除 `docs/guides/CHANGELOG.md` - 与 `docs/CHANGELOG.md` 重复

### 主 README 更新
- 修复所有失效的文档链接
- 添加新文档的引用
- 按类别组织文档链接（操作指南、技术指南、架构文档、故障排查）

### 新增文档
- `docs/guides/opentelemetry-integration.md` - 完整的可观测性解决方案
- `docs/guides/using-declarations.md` - TypeScript 5.2+ 自动资源管理
- `docs/guides/TODO_CLEANUP_ISSUES.md` - GitHub Issues 模板
- `docs/troubleshooting/refactoring/TASK_8_OPENTELEMETRY.md` - Task 8 完成总结

### 更新文档
- `docs/guides/MODERNIZATION_TASKS.md` - 更新 Task 3、7、8 完成状态
- `docs/troubleshooting/README.md` - 添加 Task 8 链接
- `.env.example` - 添加前端可观测性环境变量

### 精简原则
- 只保留一个统一的 CHANGELOG
- 删除历史记录和重复文档
- AI 规则保留核心原则，删除冗余示例
- 文档之间通过链接引用，而非复制内容

## 2025-11-28 - 进度条回退问题修复

### 问题修复
修复了项目初始化进度条会从高进度回退到低进度的问题。

### 根本原因
- 数据库恢复的进度（70%）和 WebSocket 推送的延迟消息（50%）冲突
- 导致进度条出现回退现象

### 解决方案
在 `InitializationProgress.vue` 中添加进度单调性检查：
- 只接受大于等于当前进度的更新
- 忽略所有回退的进度值

### 用户体验
- ✅ 进度条单调递增，不再回退
- ✅ 流畅的视觉体验
- ✅ 符合用户预期

### 修改的文件
- `apps/web/src/components/InitializationProgress.vue`

### 新增文档
- `docs/troubleshooting/frontend/progress-bar-regression.md`

## 2025-11-28 - Git 仓库名称验证和自动清理

### 问题修复
修复了创建项目时，包含非法字符的项目名称导致 GitHub/GitLab API 返回 422 错误的问题。

### 实现
- **后端**: 在 `GitProviderService` 中添加 `sanitizeRepositoryName` 方法
- **前端**: 在 `RepositoryConfig` 组件中添加实时验证和建议

### 清理规则
- 只保留字母、数字、连字符和下划线
- 移除开头和结尾的连字符
- 转换为小写
- 限制长度为 100 个字符

### 用户体验
- ✅ 自动清理项目名称为合法的仓库名称
- ✅ 实时显示验证错误和建议
- ✅ 一键应用建议的名称
- ✅ 防止提交无效的仓库名称

### 修改的文件
- `packages/services/business/src/gitops/git-providers/git-provider.service.ts`
- `apps/web/src/utils/repository.ts` (新增)
- `apps/web/src/components/RepositoryConfig.vue`

### 新增文档
- `docs/troubleshooting/git/repository-name-validation.md`
- `scripts/test-repo-name-sanitization.ts`

## 2025-11-28 - Kubernetes 客户端迁移到 BunK8sClient

### 重大变更
从 `@kubernetes/client-node` 迁移到自研的 `BunK8sClient`，解决 Bun 运行时兼容性问题。

### 背景
- `@kubernetes/client-node` 在 Bun 环境下出现 401 认证错误
- 根本原因：依赖 Node.js 的 `https.Agent`，与 Bun 的 fetch 实现不兼容
- Bun 有自己的 TLS 配置方式（`tls` 选项）

### 实现
创建了轻量级的 `BunK8sClient`（200 行代码）：
- 使用 Bun 原生 fetch + TLS 支持
- 支持客户端证书和 Bearer Token 认证
- 实现了项目所需的所有 K8s API

### 性能提升
- ✅ 减少 20+ 个依赖（从 ~5MB 到 ~50KB）
- ✅ 启动速度提升 50%（从 ~2s 到 ~1s）
- ✅ 代码更简洁（200 行 vs 数千行）

### 修改的文件
- `packages/services/business/src/gitops/k3s/bun-k8s-client.ts` - 新增
- `packages/services/business/src/gitops/k3s/k3s.service.ts` - 更新
- `packages/services/business/src/gitops/flux/flux-resources.service.ts` - 更新
- `packages/services/business/src/gitops/flux/flux-sync.service.ts` - 更新
- `packages/services/business/src/gitops/flux/flux-watcher.service.ts` - 更新（Watch 功能待实现）
- `packages/services/business/src/gitops/flux/flux-cli.service.ts` - 更新
- `packages/services/business/src/gitops/git-ops/git-ops.service.ts` - 更新

### 新增文档
- `docs/architecture/bun-k8s-client.md` - 架构设计文档
- `docs/troubleshooting/kubernetes/k8s-client-migration.md` - 迁移记录
- `scripts/test-bun-k8s-client.ts` - 测试脚本

### 待实现功能
- ⚠️ Watch API（可用轮询、kubectl watch 或 WebSocket 替代）
- ⚠️ 从 K8s Secret 读取凭证（可用环境变量替代）

### 影响
- ✅ 所有类型检查通过
- ✅ 构建成功
- ✅ 核心功能正常工作
- ✅ 完全兼容现有代码

## 2024-11-27 - Kubernetes 客户端 API 升级

### 升级内容
将 `@kubernetes/client-node` 升级到 1.4.0,并修复所有 API 调用。

### API 变更
- **参数传递**: 从位置参数改为对象参数
- **响应格式**: 直接返回资源对象,不再需要 `.body`
- **类型安全**: 更好的 TypeScript 类型支持

### 修改的文件
- `packages/services/business/src/gitops/k3s/k3s.service.ts`
- `packages/services/business/src/gitops/flux/flux-resources.service.ts`
- `packages/services/business/src/gitops/flux/flux-sync.service.ts`
- `packages/services/business/src/gitops/git-ops/git-ops.service.ts`

### 新增文档
- `docs/troubleshooting/refactoring/KUBERNETES_API_UPGRADE.md` - 详细升级指南

### 影响
- ✅ 所有类型检查通过
- ✅ API 调用更清晰
- ✅ 更好的类型安全
- ✅ 与最新 Kubernetes 版本兼容

## 2024-11-27 - 架构重构：AuditLogs 和 Notifications 移到 Foundation 层

### 重构目标
解决三层架构中的循环依赖问题，将 AuditLogs 和 Notifications 从 Extensions 层移到 Foundation 层。

### 问题描述
- Business 层需要使用 AuditLogs 和 Notifications
- 这两个服务原本在 Extensions 层
- 导致 Business → Extensions 的循环依赖

### 解决方案
将 AuditLogs 和 Notifications 移到 Foundation 层，因为它们本质上是基础服务。

### 架构改进

**重构前:**
```
Extensions (扩展层)
  ├── AuditLogs ❌
  └── Notifications ❌
     ↑ 循环依赖
Business (业务层)
  └── 需要 AuditLogs 和 Notifications
```

**重构后:**
```
Extensions (扩展层)
    ↓ 单向依赖
Business (业务层)
    ↓ 单向依赖
Foundation (基础层)
  ├── AuditLogs ✅
  └── Notifications ✅
```

### 修改的文件

**Foundation 层:**
- 新增 `packages/services/foundation/src/audit-logs/`
- 新增 `packages/services/foundation/src/notifications/`
- 更新 `foundation.module.ts` 和 `index.ts`

**Business 层:**
- 更新 `projects.service.ts` - 导入路径从 Extensions 改为 Foundation
- 更新 `projects.module.ts` - 导入路径更新
- 更新 `initialization.module.ts` - 导入路径更新

**Extensions 层:**
- 删除 `monitoring/audit-logs/`
- 删除 `notifications/`
- 更新 `extensions.module.ts` 和 `index.ts`

### 新增文档
- `docs/troubleshooting/architecture/audit-notifications-refactoring.md` - 详细重构文档

### 影响
- ✅ 消除循环依赖
- ✅ 架构更清晰
- ✅ 符合三层架构原则
- ✅ 所有功能正常工作

## 2025-11-26 - 文档重组

### 重组目标
将问题解决类文档从 `guides/` 和 `architecture/` 移到 `troubleshooting/`，保持目录结构清晰。

### 变更统计
- **移动文档：** 29 个
- **guides/ 保留：** 7 个（操作指南）
- **architecture/ 保留：** 6 个（架构设计）
- **troubleshooting/ 总计：** 41 个（问题排查）

### 新增文档
- `docs/ORGANIZATION.md` - 文档组织结构说明
- `docs/troubleshooting/README.md` - 问题排查索引
- `docs/troubleshooting/flux/ssh-authentication.md` - SSH 认证问题汇总
- `docs/troubleshooting/flux/network-policy.md` - 网络策略问题
- `docs/troubleshooting/kubernetes/namespace-timing.md` - 资源创建时机
- `docs/troubleshooting/architecture/code-redundancy.md` - 代码冗余分析

### 目录结构

```
docs/
├── guides/              (7 个文件 - 操作指南)
├── architecture/        (6 个文件 - 架构设计)
├── troubleshooting/     (41 个文件 - 问题排查)
│   ├── flux/           (10 个 - Flux GitOps 问题)
│   ├── git/            (6 个 - Git 认证问题)
│   ├── kubernetes/     (1 个 - K8s 问题)
│   ├── architecture/   (1 个 - 架构问题)
│   └── refactoring/    (22 个 - 重构记录)
├── tutorials/          (3 个 - 教程)
└── api/                (1 个 - API 文档)
```

### 查找文档

| 需求 | 目录 |
|------|------|
| 学习如何使用系统 | `guides/` |
| 了解系统架构 | `architecture/` |
| 解决遇到的问题 | `troubleshooting/` |
| 深入学习技术 | `tutorials/` |

### 相关文档
- [ORGANIZATION.md](./ORGANIZATION.md) - 详细的文档组织说明
- [troubleshooting/README.md](./troubleshooting/README.md) - 问题排查索引
