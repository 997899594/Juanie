# 文档重组记录

## 执行时间
2025-11-26

## 重组目的

将 docs 目录中的问题解决类文档移到 `troubleshooting/` 目录，保持 `guides/` 和 `architecture/` 目录的纯净性和清晰性。

## 重组原则

### guides/ - 操作指南
**保留：** 如何使用和操作系统的指南
- 快速开始
- 开发环境设置
- 部署指南
- 安装指南

### architecture/ - 架构设计
**保留：** 系统架构设计和技术决策
- 总体架构
- 组件架构
- 技术选型
- 设计决策

### troubleshooting/ - 问题排查
**移入：** 所有问题解决、修复记录、重构记录
- 问题诊断
- 解决方案
- 修复记录
- 重构文档

## 移动的文档

### 从 guides/ 移到 troubleshooting/git/
- `CORRECT_GIT_AUTH.md` - Git 认证正确方案
- `GIT_AUTH_FINAL_SUMMARY.md` - Git 认证最终总结
- `GIT_AUTH_IMPLEMENTATION.md` - Git 认证实现
- `GITLAB_TOKEN_SOLUTION.md` - GitLab Token 解决方案
- `gitlab-repository-path-fix.md` - GitLab 仓库路径修复
- `gitlab-token-refresh.md` - GitLab Token 刷新

### 从 guides/ 移到 troubleshooting/flux/
- `gitops-auth-improvements.md` - GitOps 认证改进
- `gitops-authentication.md` - GitOps 认证方案
- `gitops-initialization-fix.md` - GitOps 初始化修复
- `gitops-initialization-summary.md` - GitOps 初始化总结
- `gitops-worker-fix.md` - GitOps Worker 修复
- `QUICK_FIX_GITOPS.md` - GitOps 快速修复
- `REAL_FIX.md` - GitOps 真正的修复
- `SSH_SECRET_FIX.md` - SSH Secret 修复

### 从 guides/ 移到 troubleshooting/
- `FIXES_SUMMARY.md` - 所有修复的总结

### 从 architecture/ 移到 troubleshooting/refactoring/
- `CLEANUP_*.md` - 各种清理记录
- `CORE_RESTRUCTURE*.md` - Core 包重构记录
- `DELETED_COMPONENTS_ANALYSIS.md` - 删除组件分析
- `FINAL_CLEANUP_SUMMARY.md` - 最终清理总结
- `IMMEDIATE_CLEANUP_TASKS.md` - 立即清理任务
- `INITIALIZATION_REFACTOR_PROPOSAL.md` - 初始化重构方案
- `queue-cleanup.md` - 队列清理
- `redundancy-analysis.md` - 冗余分析
- `REFACTORING_COMPLETE.md` - 重构完成
- `refactoring-phase1-complete.md` - 重构第一阶段完成
- `refactoring-plan.md` - 重构计划
- `service-architecture-review.md` - 服务架构审查
- `core-package-consolidation.md` - Core 包整合
- `DEPRECATED_CLEANUP_LOG.md` - 废弃清理日志

## 保留的文档

### guides/ (7个文件)
- `quick-start.md` - 快速开始
- `development.md` - 开发指南
- `deployment.md` - 部署指南
- `deployment-test.md` - 部署测试
- `flux-installation.md` - Flux 安装
- `k3s-remote-access.md` - K3s 远程访问
- `KNOWN_HOSTS_SERVICE.md` - KnownHostsService 使用

### architecture/ (6个文件)
- `architecture.md` - 总体架构
- `gitops.md` - GitOps 架构
- `gitops-deep-dive.md` - GitOps 深入解析
- `simplified-sse-architecture.md` - SSE 架构
- `three-tier-architecture.md` - 三层架构
- `TODO_FEATURES.md` - 待实现功能

## 新的 troubleshooting/ 结构

```
troubleshooting/
├── README.md                              # 索引和使用指南
├── FIXES_SUMMARY.md                       # 所有修复总结
├── flux/                                  # Flux GitOps 问题
│   ├── ssh-authentication.md              # SSH 认证（新）
│   ├── network-policy.md                  # 网络策略（新）
│   ├── gitops-authentication.md           # 认证方案
│   ├── gitops-auth-improvements.md        # 认证改进
│   ├── gitops-initialization-fix.md       # 初始化修复
│   ├── gitops-initialization-summary.md   # 初始化总结
│   ├── gitops-worker-fix.md               # Worker 修复
│   ├── QUICK_FIX_GITOPS.md                # 快速修复
│   ├── REAL_FIX.md                        # 最终修复
│   └── SSH_SECRET_FIX.md                  # SSH Secret 修复
├── git/                                   # Git 认证问题
│   ├── CORRECT_GIT_AUTH.md                # 正确方案
│   ├── GIT_AUTH_FINAL_SUMMARY.md          # 最终总结
│   ├── GIT_AUTH_IMPLEMENTATION.md         # 实现
│   ├── GITLAB_TOKEN_SOLUTION.md           # GitLab 方案
│   ├── gitlab-repository-path-fix.md      # 路径修复
│   └── gitlab-token-refresh.md            # Token 刷新
├── kubernetes/                            # Kubernetes 问题
│   └── namespace-timing.md                # 资源创建时机（新）
├── architecture/                          # 架构问题
│   └── code-redundancy.md                 # 代码冗余（新）
└── refactoring/                           # 重构记录
    ├── CLEANUP_*.md                       # 清理记录
    ├── CORE_RESTRUCTURE*.md               # Core 重构
    ├── INITIALIZATION_REFACTOR_PROPOSAL.md # 初始化重构
    ├── queue-cleanup.md                   # 队列清理
    ├── redundancy-analysis.md             # 冗余分析
    ├── service-architecture-review.md     # 架构审查
    ├── core-package-consolidation.md      # 包整合
    └── DEPRECATED_CLEANUP_LOG.md          # 废弃日志
```

## 统计

### 移动的文档数量
- 从 guides/ 移出：15 个
- 从 architecture/ 移出：14 个
- **总计：29 个文档**

### 保留的文档数量
- guides/：7 个
- architecture/：6 个
- **总计：13 个文档**

### 新增的文档
- `troubleshooting/flux/ssh-authentication.md` - SSH 认证问题汇总
- `troubleshooting/flux/network-policy.md` - 网络策略问题
- `troubleshooting/kubernetes/namespace-timing.md` - 资源创建时机
- `troubleshooting/architecture/code-redundancy.md` - 代码冗余
- `troubleshooting/README.md` - 索引
- `docs/ORGANIZATION.md` - 文档组织说明

## 收益

### 1. 目录更清晰
- `guides/` 只包含操作指南
- `architecture/` 只包含架构设计
- `troubleshooting/` 集中所有问题解决方案

### 2. 更容易查找
- 按问题类型分类（flux/git/kubernetes/architecture）
- 统一的索引和快速查找表
- 清晰的文档命名

### 3. 更好的维护
- 临时文档有明确的归属
- 重构记录集中管理
- 避免文档混乱

### 4. 更好的新人体验
- 快速找到操作指南
- 清晰的架构文档
- 完整的问题解决方案

## 后续维护

### 添加新文档时
1. 确定文档类型（指南/架构/问题）
2. 放到对应目录
3. 更新索引

### 定期审查
1. 每月检查文档是否过时
2. 合并重复内容
3. 更新链接

### 文档命名
- 操作指南：小写-连字符（quick-start.md）
- 架构文档：小写-连字符（three-tier-architecture.md）
- 问题文档：描述性命名（ssh-authentication.md）
- 临时记录：大写-下划线（FIXES_SUMMARY.md）

## 相关文档

- [docs/ORGANIZATION.md](../../ORGANIZATION.md) - 文档组织结构说明
- [troubleshooting/README.md](../README.md) - 问题排查索引
