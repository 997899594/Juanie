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
3. **[GitOps 指南](./architecture/gitops.md)** - Flux CD 配置
4. **[GitOps 深度解析](./architecture/gitops-deep-dive.md)** - GitOps 完整实现细节
5. **[SSE 实时通信](./architecture/simplified-sse-architecture.md)** - 服务端推送架构

### 🔥 深度技术教程 (`tutorials/`)
核心技术栈深度解析和实践指南

1. **[tRPC 全栈类型安全](./tutorials/trpc-fullstack-typesafety.md)** - 端到端类型安全实践
2. **[Monorepo + Turborepo](./tutorials/monorepo-turborepo.md)** - 现代化工程架构
3. **[Ollama AI 集成](./tutorials/ollama-ai-integration.md)** - 本地 AI 模型集成指南

### 📡 API 文档 (`api/`)
API 接口参考和使用说明

- **[API 参考](./API_REFERENCE.md)** - 完整 API 文档
- **[API 详细文档](./api/)** - 各模块 API 详细说明

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
├── API_REFERENCE.md             # API 总览
├── guides/                      # 入门指南
│   ├── quick-start.md
│   ├── development.md
│   └── deployment.md
├── architecture/                # 架构文档
│   ├── architecture.md
│   ├── three-tier-architecture.md
│   ├── gitops.md
│   ├── gitops-deep-dive.md
│   └── simplified-sse-architecture.md
├── tutorials/                   # 深度教程
│   ├── trpc-fullstack-typesafety.md
│   ├── monorepo-turborepo.md
│   └── ollama-ai-integration.md
└── api/                         # API 详细文档
    └── README.md
```
