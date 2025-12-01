# 文档中心

## 📚 文档导航

### 📖 入门指南 (`guides/`)
快速上手和日常开发必读文档

1. **[快速开始](./guides/quick-start.md)** - 5 分钟上手
2. **[开发指南](./guides/development.md)** - 本地开发环境搭建
3. **[服务器部署](./guides/deployment.md)** - 生产环境部署

### 🏗️ 架构文档 (`architecture/`)
系统设计和架构决策

1. **[系统架构](./architecture/architecture.md)** - 技术栈概览
2. **[三层服务架构](./architecture/three-tier-architecture.md)** - Foundation/Business/Extensions 分层
3. **[Bun K8s 客户端](./architecture/bun-k8s-client.md)** - 自研 Kubernetes 客户端实现
4. **[GitOps 指南](./architecture/gitops.md)** - Flux CD 配置
5. **[GitOps 深度解析](./architecture/gitops-deep-dive.md)** - GitOps 完整实现细节
6. **[SSE 实时通信](./architecture/simplified-sse-architecture.md)** - 服务端推送架构

### 🔥 深度技术教程 (`tutorials/`)
核心技术栈深度解析和实践指南

1. **[tRPC 全栈类型安全](./tutorials/trpc-fullstack-typesafety.md)** - 端到端类型安全实践
2. **[Monorepo + Turborepo](./tutorials/monorepo-turborepo.md)** - 现代化工程架构
3. **[Ollama AI 集成](./tutorials/ollama-ai-integration.md)** - 本地 AI 模型集成指南

### 📡 API 文档 (`api/`)
API 接口参考和使用说明

- **[API 参考](./API_REFERENCE.md)** - 完整 API 文档
- **[API 详细文档](./api/)** - 各模块 API 详细说明

### 🔧 问题排查 (`troubleshooting/`)
遇到问题时的诊断和解决方案

- **[问题排查索引](./troubleshooting/README.md)** - 所有问题的快速索引
- **[Flux GitOps 问题](./troubleshooting/flux/)** - SSH 认证、网络策略等
- **[Git 认证问题](./troubleshooting/git/)** - OAuth Token、Deploy Key 等
- **[Kubernetes 问题](./troubleshooting/kubernetes/)** - 资源创建、配置等
- **[架构问题](./troubleshooting/architecture/)** - 代码冗余、设计缺陷等
- **[重构记录](./troubleshooting/refactoring/)** - 历史重构和清理记录

### 📋 文档管理
- **[文档组织说明](./ORGANIZATION.md)** - 文档结构和编写规范
- **[文档变更日志](./CHANGELOG.md)** - 文档重要变更记录

---

## 🎯 文档原则

- **分类清晰** - 按用途分类到不同目录
- **只保留有用的** - 删除过时和重复内容
- **及时更新** - 代码变化时同步更新文档
- **实用为主** - 提供可执行的代码示例

## 📂 目录结构

```
docs/
├── README.md                    # 文档索引（本文件）
├── ORGANIZATION.md              # 文档组织说明
├── CHANGELOG.md                 # 文档变更日志
├── API_REFERENCE.md             # API 总览
├── guides/                      # 入门指南（7 个文件）
│   ├── quick-start.md
│   ├── development.md
│   ├── deployment.md
│   ├── flux-installation.md
│   └── ...
├── architecture/                # 架构文档（6 个文件）
│   ├── architecture.md
│   ├── three-tier-architecture.md
│   ├── gitops.md
│   ├── gitops-deep-dive.md
│   └── ...
├── troubleshooting/             # 问题排查（41 个文件）
│   ├── README.md                # 问题索引
│   ├── flux/                    # Flux GitOps 问题
│   ├── git/                     # Git 认证问题
│   ├── kubernetes/              # Kubernetes 问题
│   ├── architecture/            # 架构问题
│   └── refactoring/             # 重构记录
├── tutorials/                   # 深度教程
│   ├── trpc-fullstack-typesafety.md
│   ├── monorepo-turborepo.md
│   └── ollama-ai-integration.md
└── api/                         # API 详细文档
    └── README.md
```
