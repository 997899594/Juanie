# 文档变更日志

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
