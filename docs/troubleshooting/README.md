# 故障排查指南

本目录记录了项目开发过程中遇到的问题和解决方案，按类别组织。

## 目录结构

```
troubleshooting/
├── README.md                              # 本文件
├── FIXES_SUMMARY.md                       # 所有修复的总结
├── flux/                                  # Flux GitOps 相关问题
│   ├── ssh-authentication.md              # SSH 认证问题
│   ├── network-policy.md                  # 网络策略阻止 SSH 问题
│   ├── kustomization-reconciling.md       # Kustomization 卡住问题（新）
│   ├── gitops-authentication.md           # GitOps 认证方案
│   ├── gitops-auth-improvements.md        # 认证改进
│   ├── gitops-initialization-fix.md       # 初始化修复
│   ├── gitops-initialization-summary.md   # 初始化总结
│   ├── gitops-worker-fix.md               # Worker 修复
│   ├── QUICK_FIX_GITOPS.md                # 快速修复
│   └── REAL_FIX.md                        # 最终修复
├── git/                                   # Git 认证相关问题
│   ├── CORRECT_GIT_AUTH.md                # 正确的认证方案
│   ├── GIT_AUTH_FINAL_SUMMARY.md          # 认证最终总结
│   ├── GIT_AUTH_IMPLEMENTATION.md         # 认证实现
│   ├── GITLAB_TOKEN_SOLUTION.md           # GitLab Token 方案
│   ├── gitlab-repository-path-fix.md      # 仓库路径修复
│   └── gitlab-token-refresh.md            # Token 刷新
├── kubernetes/                            # Kubernetes 相关问题
│   └── namespace-timing.md                # 资源创建时机问题（新）
├── architecture/                          # 架构设计问题
│   ├── circular-dependency.md             # 循环依赖问题（已解决）
│   ├── audit-notifications-refactoring.md # AuditLogs/Notifications 重构（新）
│   └── code-redundancy.md                 # 代码冗余问题
└── refactoring/                           # 重构记录
    ├── CLEANUP_*.md                       # 清理记录
    ├── CORE_RESTRUCTURE*.md               # Core 包重构
    ├── INITIALIZATION_REFACTOR_PROPOSAL.md # 初始化重构方案
    ├── queue-cleanup.md                   # 队列清理
    ├── redundancy-analysis.md             # 冗余分析
    ├── service-architecture-review.md     # 架构审查
    └── core-package-consolidation.md      # 包整合
```

## 快速索引

### Flux GitOps 问题

| 问题 | 文档 | 严重程度 |
|------|------|----------|
| SSH URL 格式错误 | [flux/ssh-authentication.md](./flux/ssh-authentication.md#ssh-url-format) | 高 |
| known_hosts 缺失 | [flux/ssh-authentication.md](./flux/ssh-authentication.md#known-hosts-required) | 高 |
| identity 字段缺失 | [flux/secret-configuration.md](./flux/secret-configuration.md#identity-field) | 高 |
| 网络策略阻止 SSH | [flux/network-policy.md](./flux/network-policy.md) | 高 |
| Kustomization 卡在 Reconciling | [flux/kustomization-reconciling.md](./flux/kustomization-reconciling.md) | 高 |

### Kubernetes 问题

| 问题 | 文档 | 严重程度 |
|------|------|----------|
| Secret 创建时机错误 | [kubernetes/namespace-timing.md](./kubernetes/namespace-timing.md) | 中 |

### 架构问题

| 问题 | 文档 | 严重程度 | 状态 |
|------|------|----------|------|
| 循环依赖 | [architecture/circular-dependency.md](./architecture/circular-dependency.md) | 高 | ✅ 已解决 |
| AuditLogs/Notifications 层级错误 | [architecture/audit-notifications-refactoring.md](./architecture/audit-notifications-refactoring.md) | 高 | ✅ 已解决 |
| 代码冗余和重复 | [architecture/code-redundancy.md](./architecture/code-redundancy.md) | 中 | 🔄 进行中 |

### Git 问题

| 问题 | 文档 | 严重程度 |
|------|------|----------|
| OAuth Token 过期 | [git/oauth-token-expiry.md](./git/oauth-token-expiry.md) | 高 |

## 使用指南

### 查找问题

1. **按症状查找**：查看错误信息，在对应类别中搜索
2. **按组件查找**：根据出问题的组件（Flux、K8s 等）查找
3. **按严重程度**：优先查看高严重程度的问题

### 添加新问题

创建新文档时，请包含以下部分：

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

## 贡献

遇到新问题并解决后，请：

1. 在对应类别下创建文档
2. 更新本 README 的索引
3. 添加到快速索引表格

## 联系

如有问题，请联系开发团队。
