# 文档变更日志

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
