# Juanie 项目文档

> AI DevOps 平台 - 完整的技术文档

## 📚 文档导航

### 🚀 快速开始

- [快速开始指南](guides/quick-start.md) - 5 分钟上手
- [快速参考](guides/QUICK_REFERENCE.md) - 常用命令和配置
- [项目指南](../.kiro/steering/project-guide.md) - 技术栈、规范、原则

### 🏗️ 架构设计

#### 核心架构
- [认证架构](architecture/authentication-architecture.md) - Session + OAuth 2.0
- [数据库设计标准](architecture/database-design-standards.md) - Schema 设计规范
- [数据库 Schema 参考](architecture/database-schema-reference.md) - 完整的表结构
- [Monorepo 优化总结](architecture/monorepo-optimization-summary.md) - 单一依赖树

#### GitOps & CI/CD
- [GitOps 资源详解](architecture/gitops-resources-explained.md) - Flux CD 资源类型
- [GitOps 规模化最佳实践](architecture/gitops-scale-best-practices.md) - 性能优化
- [现代 CI/CD 流水线](architecture/modern-cicd-pipeline.md) - GitHub Actions + Flux
- [部署策略对比](architecture/deployment-strategies-comparison.md) - 蓝绿、金丝雀、滚动

#### 模板系统
- [模板系统 EJS 迁移](architecture/template-system-ejs-migration.md) - 从 Handlebars 到 EJS
- [K8s 模板设计](architecture/k8s-template-design.md) - Kustomize 模板结构

#### 项目初始化
- [项目初始化流程分析](architecture/project-initialization-flow-analysis.md) - 完整流程
- [初始化进度增强](architecture/initialization-progress-enhancement.md) - 进度系统设计

### 📖 操作指南

#### 基础设施
- [K3s 远程访问](guides/k3s-remote-access.md) - 配置远程 kubectl
- [K3s 优化清单](guides/k3s-optimization-checklist.md) - 资源优化
- [Flux 安装指南](guides/flux-installation.md) - Flux CD 安装
- [Flux HTTP 代理设置](guides/flux-http-proxy-setup.md) - 国内网络优化

#### 容器镜像
- [GitHub Container Registry 设置](guides/setup-github-container-registry.md) - GHCR 配置
- [ImagePullSecret 自动化](guides/imagepullsecret-automation-complete.md) - 自动注入镜像拉取凭证
- [自动 ImagePullSecret 设置](guides/auto-imagepullsecret-setup.md) - Kubernetes 配置

#### 认证与安全
- [认证部署指南](guides/authentication-deployment-guide.md) - 生产环境部署
- [认证安全最佳实践](guides/authentication-security-best-practices.md) - 安全配置

#### Monorepo 管理
- [Monorepo 最佳实践](guides/monorepo-best-practices.md) - Turborepo + Bun
- [单一依赖树优势](guides/single-dependency-tree-benefits.md) - 依赖管理
- [.gitignore 最佳实践](guides/gitignore-best-practices.md) - 忽略规则

#### 其他
- [生产就绪清单](guides/production-readiness-checklist.md) - 上线前检查
- [AI 模块使用](guides/ai-module-usage.md) - Ollama 集成
- [OpenTelemetry 集成](guides/opentelemetry-integration.md) - 可观测性

### 🔧 问题排查

> 完整的问题索引请查看 [Troubleshooting 索引](troubleshooting/README.md)

#### 🔴 高优先级问题

- [Handlebars 与 GitHub Actions 冲突](troubleshooting/template-system-handlebars-github-actions-conflict.md) - 模板系统迁移到 EJS
- [Drizzle Relations 循环依赖](troubleshooting/drizzle-relations-circular-dependency.md) - 数据库关系定义
- [Flux Source Controller 过载](troubleshooting/flux-source-controller-overload.md) - GitOps 资源限制
- [认证重构 Bug 修复](troubleshooting/authentication-refactoring-bug-fix.md) - Session 和 OAuth

#### 🟡 中优先级问题

- [Flux 性能优化](troubleshooting/flux-performance-optimization.md) - 完整优化方案
- [Flux 协调延迟](troubleshooting/flux-reconcile-delay.md) - 部署速度优化
- [初始化进度和 ImagePullSecret 修复](troubleshooting/initialization-progress-and-imagepullsecret-fixes.md) - 用户体验

#### 🟢 低优先级问题

- [K3s Flux 重装（国内网络）](troubleshooting/k3s-flux-reinstall-china-network.md) - 网络环境
- [GitHub Token 401 错误](troubleshooting/github-token-401-error.md) - 令牌过期

#### 📚 更多问题

查看 [完整问题列表](troubleshooting/README.md) - 包含 19 个已解决问题

### 🎓 深入教程

- [Monorepo + Turborepo](tutorials/monorepo-turborepo.md) - 完整的 Monorepo 设置
- [tRPC 全栈类型安全](tutorials/trpc-fullstack-typesafety.md) - 端到端类型安全
- [Ollama AI 集成](tutorials/ollama-ai-integration.md) - 本地 AI 模型

### 📋 其他文档

- [API 参考](API_REFERENCE.md) - API 文档
- [架构概览](ARCHITECTURE.md) - 系统架构
- [变更日志](CHANGELOG.md) - 版本历史
- [路线图](ROADMAP.md) - 未来计划
- [文档组织](ORGANIZATION.md) - 文档结构说明

## 🗂️ 文档结构

```
docs/
├── README.md                    # 本文件
├── guides/                      # 操作指南
│   ├── quick-start.md          # 快速开始
│   ├── QUICK_REFERENCE.md      # 快速参考
│   └── ...
├── architecture/                # 架构设计
│   ├── authentication-architecture.md
│   ├── template-system-ejs-migration.md
│   └── ...
├── troubleshooting/            # 问题排查
│   ├── template-system-handlebars-github-actions-conflict.md
│   ├── flux-performance-optimization.md
│   └── ...
├── tutorials/                   # 深入教程
│   ├── monorepo-turborepo.md
│   └── ...
└── archive/                     # 历史文档
    └── ...
```

## 🔍 快速查找

### 按主题

- **模板系统**: [EJS 迁移](architecture/template-system-ejs-migration.md) | [GitHub Actions 冲突](troubleshooting/template-system-handlebars-github-actions-conflict.md)
- **GitOps**: [资源详解](architecture/gitops-resources-explained.md) | [性能优化](troubleshooting/flux-performance-optimization.md)
- **认证**: [架构](architecture/authentication-architecture.md) | [部署](guides/authentication-deployment-guide.md) | [安全](guides/authentication-security-best-practices.md)
- **数据库**: [设计标准](architecture/database-design-standards.md) | [Schema 参考](architecture/database-schema-reference.md)
- **Monorepo**: [最佳实践](guides/monorepo-best-practices.md) | [优化总结](architecture/monorepo-optimization-summary.md)

### 按场景

- **新手入门**: [快速开始](guides/quick-start.md) → [项目指南](../.kiro/steering/project-guide.md)
- **部署上线**: [生产就绪清单](guides/production-readiness-checklist.md) → [K3s 优化](guides/k3s-optimization-checklist.md)
- **性能优化**: [Flux 性能](troubleshooting/flux-performance-optimization.md) → [K3s 资源优化](architecture/k3s-resource-optimization-implementation.md)
- **问题排查**: [Troubleshooting 索引](troubleshooting/README.md)

## 📝 文档规范

### 文档分类

- **guides/** - 操作指南，告诉你"怎么做"
- **architecture/** - 架构设计，告诉你"为什么这样做"
- **troubleshooting/** - 问题排查，告诉你"出错了怎么办"
- **tutorials/** - 深入教程，告诉你"完整的实现过程"

### 命名规范

- 使用 kebab-case: `template-system-ejs-migration.md`
- 描述性命名: 文件名应清楚表达内容
- 避免缩写: 使用完整单词

### 文档模板

每个文档应包含：

1. **标题和概述** - 简短描述文档内容
2. **目标读者** - 谁应该阅读这个文档
3. **前置知识** - 需要了解什么
4. **主要内容** - 详细说明
5. **相关文档** - 链接到相关资源
6. **最后更新** - 日期和负责人

## 🤝 贡献文档

1. 遵循文档规范
2. 使用清晰的标题层级
3. 添加代码示例
4. 更新索引文件
5. 运行 `biome check --write` 格式化

## 📞 获取帮助

- 查看 [Troubleshooting](troubleshooting/README.md)
- 阅读 [快速参考](guides/QUICK_REFERENCE.md)
- 参考 [项目指南](../.kiro/steering/project-guide.md)

---

**最后更新**: 2024-12-22  
**维护者**: 开发团队
