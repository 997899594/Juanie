---
inclusion: always
---

# 文档组织规则

## 文档目录结构

```
docs/
├── guides/              # 操作指南 - 如何使用系统
├── architecture/        # 架构设计 - 系统设计和技术决策
├── troubleshooting/     # 问题排查 - 所有问题解决方案
├── tutorials/           # 教程 - 深入的技术教程
└── api/                 # API 文档
```

## 文档分类规则

### guides/ - 操作指南
**用途：** 如何使用和操作系统的指南

**应该放入：**
- 快速开始指南
- 开发环境设置
- 部署指南
- 安装指南
- 配置说明
- 使用手册

**不应该放入：**
- 问题解决方案
- 修复记录
- 重构文档
- 临时总结

### architecture/ - 架构设计
**用途：** 系统架构设计和技术决策文档

**应该放入：**
- 总体架构
- 组件架构
- 技术选型
- 设计决策
- 架构图
- 未来规划

**不应该放入：**
- 清理记录
- 重构过程
- 问题修复
- 临时分析

### troubleshooting/ - 问题排查
**用途：** 记录遇到的问题和解决方案

**应该放入：**
- 问题诊断
- 解决方案
- 修复记录
- 重构文档
- 清理记录
- 临时总结
- 问题分析

**子目录分类：**
- `flux/` - Flux GitOps 相关问题
- `git/` - Git 认证相关问题
- `kubernetes/` - Kubernetes 相关问题
- `architecture/` - 架构设计问题
- `refactoring/` - 重构和清理记录

## 创建新文档时的决策树

```
遇到问题并解决？
├─ 是 → troubleshooting/[category]/
│
写操作指南？
├─ 是 → guides/
│
设计架构？
├─ 是 → architecture/
│
深入教程？
└─ 是 → tutorials/
```

## 问题解决类文档模板

当创建问题解决类文档时，使用以下模板：

```markdown
# 问题标题

## 问题描述
简要描述问题现象

## 症状
- 错误信息
- 日志输出
- 观察到的行为

## 根本原因
解释为什么会出现这个问题

## 解决方案

### 方案 1: 标题
步骤...

### 方案 2: 标题（如果有）
步骤...

## 预防措施
如何避免再次出现

## 相关问题
链接到相关的问题文档

## 参考资料
- 官方文档链接
- 相关 Issue 链接
```

## 文档命名规范

- **操作指南**：小写-连字符（`quick-start.md`）
- **架构文档**：小写-连字符（`three-tier-architecture.md`）
- **问题文档**：描述性命名（`ssh-authentication.md`）
- **临时记录**：大写-下划线（`FIXES_SUMMARY.md`）

## 重要原则

1. **问题解决类文档必须放在 troubleshooting/**
2. **guides/ 只放操作指南，不放问题修复**
3. **architecture/ 只放架构设计，不放重构记录**
4. **所有临时总结、修复记录、清理文档都属于 troubleshooting/**

## 示例

### ✅ 正确的放置

- `guides/quick-start.md` - 快速开始指南
- `architecture/gitops.md` - GitOps 架构设计
- `troubleshooting/flux/ssh-authentication.md` - SSH 认证问题
- `troubleshooting/refactoring/CLEANUP_SUMMARY.md` - 清理总结

### ❌ 错误的放置

- `guides/GIT_AUTH_FIX.md` - 应该在 `troubleshooting/git/`
- `architecture/REFACTORING_PLAN.md` - 应该在 `troubleshooting/refactoring/`
- `guides/FIXES_SUMMARY.md` - 应该在 `troubleshooting/`

## 维护规则

1. **定期审查**：每月检查文档是否放在正确位置
2. **及时移动**：发现错误放置的文档立即移动
3. **更新索引**：移动文档后更新 `troubleshooting/README.md`
4. **清理过时**：删除过时的临时文档

## 相关文档

- [docs/ORGANIZATION.md](../../docs/ORGANIZATION.md) - 详细的文档组织说明
- [docs/CHANGELOG.md](../../docs/CHANGELOG.md) - 文档变更日志
- [docs/troubleshooting/README.md](../../docs/troubleshooting/README.md) - 问题排查索引
- [docs/troubleshooting/refactoring/DOCS_REORGANIZATION.md](../../docs/troubleshooting/refactoring/DOCS_REORGANIZATION.md) - 文档重组记录
