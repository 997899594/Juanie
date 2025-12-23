# 操作指南索引

> 如何使用和操作系统的指南文档

## 🚀 快速开始

- [快速开始指南](quick-start.md) - 5 分钟上手项目
- [快速参考](QUICK_REFERENCE.md) - 常用命令和配置速查

## 🏗️ 基础设施

### K3s & Kubernetes

- [K3s 远程访问配置](k3s-remote-access.md) - 配置 K3s 集群远程访问
- [K3s 优化清单](k3s-optimization-checklist.md) - K3s 资源优化和性能调优

### Flux CD

- [Flux 安装指南](flux-installation.md) - 安装和配置 Flux CD
- [Flux HTTP 代理设置](flux-http-proxy-setup.md) - 国内网络环境优化

### 容器镜像

- [GitHub Container Registry 设置](setup-github-container-registry.md) - GHCR 配置和使用
- [ImagePullSecret 自动化](imagepullsecret-automation-complete.md) - 自动注入镜像拉取凭证
- [自动 ImagePullSecret 设置](auto-imagepullsecret-setup.md) - Kubernetes 配置

## 🔐 认证与安全

- [认证部署指南](authentication-deployment-guide.md) - 生产环境部署
- [认证安全最佳实践](authentication-security-best-practices.md) - 安全配置和最佳实践

## 📦 Monorepo 管理

- [Monorepo 最佳实践](monorepo-best-practices.md) - Turborepo + Bun 完整指南
- [单一依赖树优势](single-dependency-tree-benefits.md) - 依赖管理策略
- [.gitignore 最佳实践](gitignore-best-practices.md) - 忽略规则配置

## 🤖 AI 模块

- [AI 模块使用](ai-module-usage.md) - Ollama 集成和使用

## 📊 可观测性

- [OpenTelemetry 集成](opentelemetry-integration.md) - 完整的可观测性解决方案

## 🚀 部署与测试

- [生产就绪清单](production-readiness-checklist.md) - 上线前检查清单
- [部署测试指南](deployment-test.md) - 测试部署流程
- [项目创建手动测试](project-creation-manual-testing.md) - 手动测试流程

## 📚 相关文档

- [架构文档](../architecture/) - 系统架构设计
- [问题排查](../troubleshooting/) - 问题诊断和解决方案
- [深入教程](../tutorials/) - 完整的实现教程
- [API 参考](../API_REFERENCE.md) - API 文档

## 📝 文档规范

根据 [文档组织规则](../ORGANIZATION.md)：

- **guides/** - 操作指南（本目录）- 告诉你"怎么做"
- **architecture/** - 架构设计 - 告诉你"为什么这样做"
- **troubleshooting/** - 问题排查 - 告诉你"出错了怎么办"
- **tutorials/** - 深入教程 - 告诉你"完整的实现过程"

## 🤝 贡献指南

添加新文档时，请：

1. 确保文档放在正确的目录
2. 使用清晰的文件命名（kebab-case）
3. 在本 README 中添加索引链接
4. 遵循 [文档模板](../ORGANIZATION.md#文档模板)

---

**最后更新**: 2024-12-22  
**维护者**: 开发团队
