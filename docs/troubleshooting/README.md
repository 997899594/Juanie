# 问题排查指南

本目录包含项目开发和运维过程中遇到的问题及解决方案。

## 📋 问题分类

### 🎨 模板系统

- [Handlebars 与 GitHub Actions 语法冲突](template-system-handlebars-github-actions-conflict.md) - 迁移到 EJS 解决分隔符冲突 🔴

### 💾 数据库

- [Drizzle Relations 循环依赖](drizzle-relations-circular-dependency.md) - 关系定义导致的循环依赖问题 🔴
- [Drizzle Relations Undefined 错误](drizzle-relations-undefined-error.md) - 导入顺序导致的 undefined 错误 🔴

### 🔄 GitOps & Flux CD

- [Flux 协调延迟](flux-reconcile-delay.md) - Flux 资源协调速度慢的问题 🟡
- [Flux Source Controller 过载](flux-source-controller-overload.md) - Source Controller 资源不足 🔴
- [Flux 性能优化](flux-performance-optimization.md) - 完整的 Flux 性能优化方案 🟡
- [Flux Kustomization 协调](flux-kustomization-reconciling.md) - Kustomization 协调问题
- [Flux 网络策略](flux-network-policy.md) - 网络策略配置问题
- [Flux SSH 认证](flux-ssh-authentication.md) - SSH 认证问题
- [GitOps Kustomization 路径未找到](gitops-kustomization-path-not-found.md) - Kustomization 路径配置错误 🟡

### ☸️ Kubernetes & K3s

- [K8s Deployment 错误的镜像名称](k8s-deployment-wrong-image-name.md) - 模板渲染失败导致镜像名称错误 🔴
- [K3s Flux 重装（国内网络）](k3s-flux-reinstall-china-network.md) - 国内网络环境下的 Flux 安装 🟢
- [K3s 远程访问 IP 变更](k3s-remote-access-ip-change.md) - K3s 服务器 IP 变更后的配置更新 🟢
- [K8s Namespace 时序](k8s-namespace-timing.md) - Namespace 创建时序问题
- [K8s 快速参考](k8s-quick-reference.md) - Kubernetes 常见问题快速参考

### 🔐 认证系统

- [认证重构 Bug 修复](authentication-refactoring-bug-fix.md) - Session 和 OAuth 相关问题 🔴
- [GitHub Token 401 错误](github-token-401-error.md) - OAuth 令牌失效问题 🟢

### 🚀 项目初始化

- [项目初始化成功分析](project-initialization-success-analysis.md) - 完整的初始化流程分析和最佳实践 🟢
- [凭证同步命名空间时序问题](credential-sync-namespace-timing.md) - 凭证同步时的正常警告日志 🟢
- [初始化进度和 ImagePullSecret 修复](initialization-progress-and-imagepullsecret-fixes.md) - 进度显示和镜像拉取凭证问题 🟡
- [模板中缺少 GitHub Workflow](missing-github-workflow-in-template.md) - 模板文件缺失问题 🟡

### 📦 Git 仓库

- [Git 仓库名称验证](git-repository-name-validation.md) - 仓库名称验证规则

## 🔍 按严重程度

### 🔴 高优先级（影响核心功能）

1. [Handlebars 与 GitHub Actions 语法冲突](template-system-handlebars-github-actions-conflict.md) - 项目初始化失败
2. [Drizzle Relations 循环依赖](drizzle-relations-circular-dependency.md) - 应用启动失败
3. [Drizzle Relations Undefined 错误](drizzle-relations-undefined-error.md) - 数据库关系错误
4. [Flux Source Controller 过载](flux-source-controller-overload.md) - GitOps 不可用
5. [认证重构 Bug 修复](authentication-refactoring-bug-fix.md) - 认证系统故障

### 🟡 中优先级（影响性能或体验）

1. [Flux 协调延迟](flux-reconcile-delay.md) - 部署速度慢
2. [Flux 性能优化](flux-performance-optimization.md) - 整体性能问题
3. [GitOps Kustomization 路径未找到](gitops-kustomization-path-not-found.md) - 配置错误
4. [初始化进度和 ImagePullSecret 修复](initialization-progress-and-imagepullsecret-fixes.md) - 用户体验问题
5. [模板中缺少 GitHub Workflow](missing-github-workflow-in-template.md) - 模板问题

### 🟢 低优先级（配置或环境问题）

1. [项目初始化成功分析](project-initialization-success-analysis.md) - 最佳实践参考
2. [凭证同步命名空间时序问题](credential-sync-namespace-timing.md) - 正常的时序警告
3. [K3s 远程访问 IP 变更](k3s-remote-access-ip-change.md) - 配置更新
4. [K3s Flux 重装（国内网络）](k3s-flux-reinstall-china-network.md) - 网络环境
5. [GitHub Token 401 错误](github-token-401-error.md) - 令牌过期

## 📊 问题统计

| 类别 | 已解决 | 进行中 | 总计 |
|------|--------|--------|------|
| 模板系统 | 1 | 0 | 1 |
| 数据库 | 2 | 0 | 2 |
| GitOps & Flux | 7 | 0 | 7 |
| Kubernetes | 4 | 0 | 4 |
| 认证系统 | 2 | 0 | 2 |
| 项目初始化 | 4 | 0 | 4 |
| Git 仓库 | 1 | 0 | 1 |
| **总计** | **21** | **0** | **21** |

## 🎯 常见问题快速索引

### "项目初始化失败"

1. 检查 [Handlebars 与 GitHub Actions 冲突](template-system-handlebars-github-actions-conflict.md)
2. 检查 [模板中缺少 GitHub Workflow](missing-github-workflow-in-template.md)
3. 检查 [初始化进度和 ImagePullSecret 修复](initialization-progress-and-imagepullsecret-fixes.md)

### "Flux 部署很慢"

1. 查看 [Flux 协调延迟](flux-reconcile-delay.md)
2. 查看 [Flux 性能优化](flux-performance-optimization.md)
3. 查看 [Flux Source Controller 过载](flux-source-controller-overload.md)

### "数据库关系报错"

1. 查看 [Drizzle Relations 循环依赖](drizzle-relations-circular-dependency.md)
2. 查看 [Drizzle Relations Undefined 错误](drizzle-relations-undefined-error.md)

### "GitHub OAuth 失败"

1. 查看 [GitHub Token 401 错误](github-token-401-error.md)
2. 查看 [认证重构 Bug 修复](authentication-refactoring-bug-fix.md)

### "Flux 网络问题"

1. 查看 [Flux 网络策略](flux-network-policy.md)
2. 查看 [Flux SSH 认证](flux-ssh-authentication.md)
3. 查看 [K3s Flux 重装（国内网络）](k3s-flux-reinstall-china-network.md)

## 📝 文档规范

每个问题文档应包含：

1. **问题描述** - 症状、影响范围、严重程度
2. **根本原因** - 为什么会出现这个问题
3. **尝试过的方案** - 失败的尝试和原因
4. **最终解决方案** - 正确的解决方法
5. **验证步骤** - 如何确认问题已解决
6. **相关文档** - 链接到相关资源
7. **经验教训** - 避免类似问题的建议

详见 [文档组织规范](../ORGANIZATION.md#问题排查模板)

## 🤝 贡献指南

遇到新问题时：

1. 在本目录创建文档（不要创建子目录）
2. 使用描述性文件名（kebab-case）
3. 遵循 [问题排查模板](../ORGANIZATION.md#问题排查模板)
4. 更新本索引文件
5. 添加到 [docs/README.md](../README.md)

## 📞 获取帮助

- 查看 [快速参考](../guides/QUICK_REFERENCE.md)
- 阅读 [架构文档](../architecture/)
- 参考 [项目指南](../../.kiro/steering/project-guide.md)

---

**最后更新**: 2024-12-22  
**维护者**: 开发团队
