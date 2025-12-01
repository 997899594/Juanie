# 故障排查指南

本目录记录了项目开发过程中遇到的问题和解决方案，按类别组织。

## 快速导航

### 最新问题（2025-11-28）
- [Bun K8s 客户端实现](../architecture/bun-k8s-client.md) - 自研 K8s 客户端，替代 @kubernetes/client-node
- [Kubernetes 客户端迁移](./kubernetes/k8s-client-migration.md) - 完整的迁移记录和验证
- [迁移总结](./kubernetes/MIGRATION_SUMMARY.md) - 迁移成果和经验总结
- [快速参考](./kubernetes/QUICK_REFERENCE.md) - BunK8sClient API 使用指南
- [仓库名称验证](./git/repository-name-validation.md) - Git 仓库名称规范和自动清理
- [进度条回退问题](./frontend/progress-bar-regression.md) - 修复初始化进度条回退

### 常见问题
- [Flux SSH 认证](flux/ssh-authentication.md)
- [Namespace 创建时机](kubernetes/namespace-timing.md)
- [NestJS ConfigModule 问题](nestjs/config-module-issue.md)

## 目录结构

```
troubleshooting/
├── flux/              # Flux GitOps 相关问题
├── kubernetes/        # Kubernetes 相关问题
├── nestjs/            # NestJS 框架相关问题
├── architecture/      # 架构设计问题
└── refactoring/       # 重构和清理记录
```

## Flux GitOps 问题

- [SSH 认证问题](flux/ssh-authentication.md)
- [网络策略阻止 SSH](flux/network-policy.md)
- [Kustomization 卡住](flux/kustomization-reconciling.md)

## Kubernetes 问题

- [Namespace 创建时机](kubernetes/namespace-timing.md)
- [K8s 客户端迁移](kubernetes/k8s-client-migration.md)

## Git 问题

- [仓库名称验证](git/repository-name-validation.md)

## 前端问题

- [进度条回退问题](frontend/progress-bar-regression.md)

## NestJS 问题

- [ConfigModule 跨包问题](nestjs/config-module-issue.md)

## 架构问题

- [循环依赖](architecture/circular-dependency.md)
- [代码冗余](architecture/code-redundancy.md)
- [审计日志重构](architecture/audit-notifications-refactoring.md)

## 重构记录

- [文档重组](refactoring/DOCS_REORGANIZATION.md)
- [架构重构总结](refactoring/REFACTORING_SUMMARY.md)

## 相关文档

- [架构文档](../architecture/) - 系统架构设计
- [开发指南](../guides/) - 开发和部署指南
