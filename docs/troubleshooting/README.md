# 问题排查指南

> 常见问题的诊断和解决方案

## 🔥 常见问题

### K8s / Flux 相关
- [Bun + K8s mTLS 连接](bun-k8s-mtls-solution.md) - Bun 运行时 K8s 连接方案
- [K8s 连接修复总结](k8s-connection-fix-summary.md) - K8s 连接问题汇总
- [Flux SSH 认证](flux-ssh-authentication.md) - Flux Git 仓库 SSH 认证
- [Flux 网络策略](flux-network-policy.md) - Flux 网络配置
- [Flux 性能优化](flux-performance-optimization.md) - Flux 性能调优
- [Flux Source Controller 过载](flux-source-controller-overload.md) - Source Controller 问题
- [K3s 远程访问 IP 变更](k3s-remote-access-ip-change.md) - K3s IP 变更处理
- [K3s 清理和状态](k3s-cleanup-and-11444a-status.md) - K3s 清理操作
- [K3s Flux 重装（中国网络）](k3s-flux-reinstall-china-network.md) - 国内网络环境安装

### 部署相关
- [GitOps Kustomization 路径未找到](gitops-kustomization-path-not-found.md) - Kustomization 路径问题
- [K8s Deployment 错误镜像名](k8s-deployment-wrong-image-name.md) - 镜像名称错误
- [Kustomization 数字名称最佳实践](kustomization-numeric-name-best-practice.md) - 数字命名规范
- [YAML 数字名称最终方案](yaml-numeric-name-final-solution.md) - YAML 数字处理
- [Next.js Hostname 绑定修复](nextjs-hostname-binding-fix.md) - Next.js 网络配置

### 认证 / 权限相关
- [GitHub Token 401 错误](github-token-401-error.md) - GitHub 认证失败
- [GitHub Username Unknown 调查](github-username-unknown-investigation.md) - GitHub 用户名问题
- [GHCR TLS 证书修复](ghcr-tls-certificate-fix.md) - GHCR 证书问题
- [GHCR Hosts 修复](ghcr-hosts-fix-final.md) - GHCR 域名解析
- [ImagePullSecret 多用户修复](imagepullsecret-multi-user-fix.md) - 多用户镜像拉取
- [多租户 GitHub Packages 修复](multi-tenant-github-packages-fix.md) - 多租户镜像仓库
- [Credential Sync Namespace 时序](credential-sync-namespace-timing.md) - 凭证同步时序

### 模板 / 工作流相关
- [模板渲染调试增强](template-rendering-debug-enhancement.md) - 模板调试
- [模板渲染 ProjectId Undefined](template-rendering-projectid-undefined.md) - ProjectId 问题
- [模板系统 Handlebars GitHub Actions 冲突](template-system-handlebars-github-actions-conflict.md) - 模板引擎冲突
- [Workflow Project Slug 缺失](workflow-project-slug-missing.md) - Workflow 变量缺失
- [GitHub Actions 部署触发失败](github-actions-deployment-trigger-failure.md) - Actions 触发问题

### 数据库相关
- [Drizzle Relations 循环依赖](drizzle-relations-circular-dependency.md) - Drizzle 循环依赖
- [Drizzle Relations Undefined 错误](drizzle-relations-undefined-error.md) - Relations 未定义
- [ProjectSlug 移除完成](projectslug-removal-complete.md) - Schema 字段移除

### 日志 / 调试相关
- [日志最佳实践](LOGGING-BEST-PRACTICES.md) - 日志规范
- [Pino Logger 配置](pino-logger-configuration.md) - Pino 配置指南
- [API Gateway 静默退出](api-gateway-silent-exit.md) - 启动问题诊断

### 其他
- [正确的解决方案](CORRECT_SOLUTION.md) - 通用问题解决思路
- [TypeScript 缓存问题](typescript-cache-issue-gitops-refactoring.md) - TS 缓存清理

## 📋 问题分类

### 按严重程度
- 🔴 **Critical**: K8s 连接失败、部署失败、认证失败
- 🟡 **Warning**: 性能问题、配置警告
- 🟢 **Info**: 最佳实践、优化建议

### 按组件
- **K8s/Flux**: 集群、GitOps、部署
- **认证**: OAuth、JWT、GitHub/GitLab
- **数据库**: Drizzle、PostgreSQL、Schema
- **模板**: EJS、变量渲染、工作流
- **日志**: Pino、调试、追踪

## 🔍 诊断流程

### 1. 收集信息
```bash
# 查看日志
bun run dev:api

# 查看 K8s 资源
kubectl get pods -n <namespace>
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>

# 查看 Flux 状态
flux get all -n <namespace>
flux logs -n flux-system
```

### 2. 定位问题
- 检查错误日志
- 查看相关资源状态
- 验证配置是否正确

### 3. 查找解决方案
- 搜索本文档
- 查看 [归档问题](../archive/troubleshooting/)
- 查阅官方文档

### 4. 应用修复
- 测试修复方案
- 验证问题解决
- 更新文档

## 📝 报告问题

### 问题模板
```markdown
## 问题描述
简要描述问题

## 环境信息
- OS: macOS / Linux
- Runtime: Bun 1.x / Node.js 20.x
- K8s: K3s v1.x

## 复现步骤
1. 步骤 1
2. 步骤 2
3. 步骤 3

## 错误日志
```
粘贴错误日志
```

## 预期行为
描述预期的正确行为

## 实际行为
描述实际发生的情况
```

### 提交问题
1. 搜索是否已有相同问题
2. 使用问题模板
3. 提供完整的错误日志
4. 标注严重程度和组件

## 🔗 相关资源

- [架构文档](../architecture/)
- [操作指南](../guides/)
- [历史问题](../archive/troubleshooting/)
- [项目指南](../../.kiro/steering/project-guide.md)

---

**提示**: 如果问题已解决，请考虑将解决方案添加到本文档！
