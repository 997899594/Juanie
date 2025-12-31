# Juanie DevOps 平台文档

> 现代化的 DevOps 平台，基于 K3s + Flux CD + NestJS + Vue 3

## 📚 快速导航

### 🚀 快速开始
- [快速开始指南](guides/quick-start.md) - 5 分钟上手
- [项目指南](../.kiro/steering/project-guide.md) - 开发规范和最佳实践
- [环境配置](.env.example) - 环境变量配置

### 🏗️ 架构文档
- [架构总览](architecture/README.md) - 系统架构概述
- [分层架构](architecture/layered-architecture-analysis.md) - 三层服务架构
- [Business 层架构](architecture/business-layer-architecture.md) - 业务层设计
- [数据库设计](architecture/database-schema-reference.md) - 数据库 Schema
- [认证架构](architecture/authentication-architecture.md) - OAuth + JWT 认证

### 📖 操作指南
- [部署指南](guides/deployment-test.md) - 项目部署流程
- [K3s 远程访问](guides/k3s-remote-access.md) - K3s 集群配置
- [Flux 安装](guides/flux-installation.md) - Flux CD 安装
- [GitHub Container Registry](guides/setup-github-container-registry.md) - GHCR 配置
- [Monorepo 最佳实践](guides/monorepo-best-practices.md) - Turborepo + Bun

### 🔧 问题排查
- [常见问题](troubleshooting/README.md) - 问题索引
- [K8s 连接问题](troubleshooting/bun-k8s-mtls-solution.md) - Bun + K8s mTLS
- [Flux 问题](troubleshooting/flux-ssh-authentication.md) - Flux SSH 认证
- [日志配置](troubleshooting/pino-logger-configuration.md) - Pino Logger
- [API Gateway 问题](troubleshooting/api-gateway-silent-exit.md) - 启动问题

### 🎓 深入教程
- [Monorepo + Turborepo](tutorials/monorepo-turborepo.md) - Monorepo 架构
- [tRPC 全栈类型安全](tutorials/trpc-fullstack-typesafety.md) - tRPC 使用
- [Ollama AI 集成](tutorials/ollama-ai-integration.md) - AI 功能集成

### 📦 API 参考
- [API 文档](api/README.md) - tRPC API 参考

## 🗂️ 文档组织

```
docs/
├── README.md                    # 本文件 - 文档导航
├── CHANGELOG.md                 # 变更日志
├── ROADMAP.md                   # 产品路线图
│
├── architecture/                # 架构设计文档（25 个）
│   ├── README.md               # 架构总览
│   ├── layered-architecture-analysis.md
│   ├── business-layer-architecture.md
│   ├── database-schema-reference.md
│   └── ...
│
├── guides/                      # 操作指南（20 个）
│   ├── README.md               # 指南索引
│   ├── quick-start.md
│   ├── deployment-test.md
│   └── ...
│
├── troubleshooting/             # 问题排查（33 个）
│   ├── README.md               # 问题索引
│   ├── bun-k8s-mtls-solution.md
│   ├── flux-ssh-authentication.md
│   └── ...
│
├── tutorials/                   # 深入教程（3 个）
│   ├── monorepo-turborepo.md
│   ├── trpc-fullstack-typesafety.md
│   └── ollama-ai-integration.md
│
└── api/                         # API 参考
    └── README.md
```

## 🎯 文档规范

### 文档分类
- **architecture/** - 架构设计、技术决策、系统设计
- **guides/** - 操作指南、配置教程、最佳实践
- **troubleshooting/** - 问题排查、修复记录、调试技巧
- **tutorials/** - 深入教程、技术解析、学习资料
- **archive/** - 历史文档、已完成项目、重构记录

### 命名规范
- 使用 kebab-case: `k8s-connection-fix.md`
- 英文文件名优先
- 描述性命名: `bun-k8s-mtls-solution.md` 而不是 `fix-1.md`

### 文档结构
```markdown
# 标题

> 一句话描述

## 问题描述 / 背景

## 解决方案 / 设计

## 实现细节

## 参考资料
```

## 🔍 查找文档

### 按主题查找
- **K8s/Flux**: `guides/k3s-*.md`, `troubleshooting/flux-*.md`
- **认证/权限**: `architecture/authentication-*.md`, `architecture/RBAC-*.md`
- **数据库**: `architecture/database-*.md`
- **GitOps**: `architecture/gitops-*.md`
- **AI**: `guides/ai-*.md`, `tutorials/ollama-*.md`

### 按类型查找
- **快速参考**: `guides/QUICK_REFERENCE.md`
- **生产检查清单**: `guides/production-readiness-checklist.md`
- **最佳实践**: `guides/*-best-practices.md`
- **安全指南**: `guides/*-security-*.md`

## 📝 贡献文档

### 新增文档
1. 确定文档类型（architecture/guides/troubleshooting/tutorials）
2. 使用规范的文件名
3. 遵循文档结构模板
4. 更新相应的 README.md 索引

### 更新文档
1. 保持文档简洁、准确
2. 添加代码示例和截图
3. 更新修改日期
4. 删除过时内容

### 归档文档
- 重构完成后的过程记录 → `archive/refactoring/`
- 已解决的临时问题 → `archive/troubleshooting/`
- 已完成的规格 → `archive/specs/`

## 🔗 相关资源

- [项目仓库](https://github.com/your-org/juanie)
- [问题追踪](https://github.com/your-org/juanie/issues)
- [变更日志](CHANGELOG.md)
- [路线图](ROADMAP.md)

---

**最后更新**: 2025-12-29  
**文档版本**: 2.0 (整理后)
