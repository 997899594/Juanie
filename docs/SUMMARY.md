# 文档目录

本文档提供完整的项目文档索引。

---

## 📖 主要文档

- [项目文档首页](./README.md)
- [项目架构](./ARCHITECTURE.md)
- [API 参考](./API_REFERENCE.md)
- [变更日志](./CHANGELOG.md)
- [文档组织](./ORGANIZATION.md)

---

## 🚀 快速开始

- [快速开始指南](./guides/quick-start.md)
- [项目指南](../.kiro/steering/project-guide.md)

---

## 📚 操作指南 (Guides)

### 基础设施
- [K3s 远程访问配置](./guides/k3s-remote-access.md)
- [Flux 安装指南](./guides/flux-installation.md)
- [Flux HTTP 代理设置](./guides/flux-http-proxy-setup.md)

### 开发指南
- [AI 模块使用](./guides/ai-module-usage.md)
- [项目创建手动测试](./guides/project-creation-manual-testing.md)
- [部署测试](./guides/deployment-test.md)
- [OpenTelemetry 集成](./guides/opentelemetry-integration.md)

### 现代化指南
- [2025 实用指南](./guides/pragmatic-2025-guide.md)
- [现代化进度](./guides/MODERNIZATION_PROGRESS.md)
- [现代化任务](./guides/MODERNIZATION_TASKS.md)

---

## 🏗️ 架构设计 (Architecture)

- [项目初始化流程分析](./architecture/project-initialization-flow-analysis.md)
- [K8s 模板设计](./architecture/k8s-template-design.md)
- [数据库 Schema 关系](./architecture/database-schema-relationships.md)
- [进度系统设计](./architecture/progress-system-final.md)
- [Bun K8s 客户端](./architecture/bun-k8s-client.md)

---

## 🔧 问题排查 (Troubleshooting)

### 基础设施
- ⭐ [K3s + Flux 重装指南（中国网络）](./troubleshooting/k3s-flux-reinstall-china-network.md)
- [Flux 性能优化](./troubleshooting/flux-performance-optimization.md)
- [Flux Source Controller 过载](./troubleshooting/flux-source-controller-overload.md)
- [Flux Reconcile 延迟](./troubleshooting/flux-reconcile-delay.md)

### GitOps
- [GitOps 同步架构修复](./troubleshooting/gitops-sync-architecture-fix.md)
- [GitOps Kustomization 路径错误](./troubleshooting/gitops-kustomization-path-not-found.md)

### 架构
- [统一模板系统实现](./troubleshooting/unified-template-system-implementation.md)

### 数据库
- [Drizzle Relations 循环依赖](./troubleshooting/drizzle-relations-circular-dependency.md)
- [Drizzle Relations Undefined 错误](./troubleshooting/drizzle-relations-undefined-error.md)

### 分类索引
- [AI 相关](./troubleshooting/ai/)
- [架构相关](./troubleshooting/architecture/)
- [Bun 相关](./troubleshooting/bun/)
- [Flux 相关](./troubleshooting/flux/)
- [前端相关](./troubleshooting/frontend/)
- [Git 相关](./troubleshooting/git/)
- [Kubernetes 相关](./troubleshooting/kubernetes/)
- [NestJS 相关](./troubleshooting/nestjs/)
- [重构记录](./troubleshooting/refactoring/)
- [启动问题](./troubleshooting/startup/)

---

## 🎓 深入教程 (Tutorials)

- [Monorepo + Turborepo](./tutorials/monorepo-turborepo.md)
- [tRPC 全栈类型安全](./tutorials/trpc-fullstack-typesafety.md)
- [Ollama AI 集成](./tutorials/ollama-ai-integration.md)

---

## 📡 API 参考

- [API 文档](./api/README.md)

---

## 🔍 按技术栈索引

### 后端技术
- **NestJS**: [架构设计](./architecture/), [问题排查](./troubleshooting/nestjs/)
- **tRPC**: [全栈类型安全](./tutorials/trpc-fullstack-typesafety.md)
- **Drizzle ORM**: [Relations 问题](./troubleshooting/drizzle-relations-circular-dependency.md), [Schema 设计](./architecture/database-schema-relationships.md)
- **BullMQ**: [队列系统](./architecture/project-initialization-flow-analysis.md)
- **PostgreSQL**: [数据库设计](./architecture/database-schema-relationships.md)
- **Redis**: [缓存配置](./guides/)

### 前端技术
- **Vue 3**: [组件开发](./guides/), [问题排查](./troubleshooting/frontend/)
- **Vite**: [配置优化](./guides/)
- **Tailwind CSS**: [样式系统](./guides/)
- **shadcn-vue**: [UI 组件](./guides/)
- **Pinia**: [状态管理](./guides/)

### 基础设施
- **K3s**: [安装配置](./troubleshooting/k3s-flux-reinstall-china-network.md), [远程访问](./guides/k3s-remote-access.md)
- **Flux CD**: [安装](./guides/flux-installation.md), [性能优化](./troubleshooting/flux-performance-optimization.md), [代理配置](./guides/flux-http-proxy-setup.md)
- **Docker**: [镜像构建](./guides/), [镜像源配置](./troubleshooting/k3s-flux-reinstall-china-network.md)
- **Kubernetes**: [模板设计](./architecture/k8s-template-design.md), [问题排查](./troubleshooting/kubernetes/)

### AI & 监控
- **Ollama**: [集成教程](./tutorials/ollama-ai-integration.md), [使用指南](./guides/ai-module-usage.md)
- **OpenTelemetry**: [集成指南](./guides/opentelemetry-integration.md)
- **Jaeger**: [追踪配置](./guides/opentelemetry-integration.md)

### 工具链
- **Bun**: [K8s 客户端](./architecture/bun-k8s-client.md), [问题排查](./troubleshooting/bun/)
- **Turborepo**: [Monorepo 教程](./tutorials/monorepo-turborepo.md)
- **Biome**: [代码格式化](./guides/)
- **TypeScript**: [类型安全](./tutorials/trpc-fullstack-typesafety.md)

---

## 📊 文档状态

### 最近更新
- 2024-12-18: K3s + Flux 重装指南（中国网络）
- 2024-12-18: Flux Reconcile 延迟问题
- 2024-12-18: 文档整理和分类

### 待完善
- [ ] 前端组件开发指南
- [ ] 部署流程详细文档
- [ ] 监控告警配置
- [ ] 安全最佳实践

---

## 🤝 贡献

欢迎贡献文档！请参考：
- [文档规范](./README.md#-文档规范)
- [贡献指南](./README.md#-贡献指南)

---

**最后更新**: 2024-12-18
