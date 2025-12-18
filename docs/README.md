# 项目文档

欢迎来到 Juanie DevOps 平台文档中心。

---

## 📚 文档导航

### 🚀 [快速开始](./guides/quick-start.md)
新手入门，5 分钟了解项目

### 📖 [操作指南](./guides/)
功能使用、配置、部署指南

### 🏗️ [架构设计](./architecture/)
系统架构、模块设计、技术选型

### 🔧 [问题排查](./troubleshooting/)
常见问题、解决方案、最佳实践

### 🎓 [深入教程](./tutorials/)
技术深度解析、实战案例

### 📡 [API 参考](./api/)
API 接口文档

---

## 🎯 核心文档

### 基础设施
- **[K3s + Flux 安装指南（中国网络）](./troubleshooting/k3s-flux-reinstall-china-network.md)** ⭐
- [K3s 远程访问配置](./guides/k3s-remote-access.md)
- [Flux HTTP 代理设置](./guides/flux-http-proxy-setup.md)

### 架构设计
- [项目初始化流程分析](./architecture/project-initialization-flow-analysis.md)
- [K8s 模板设计](./architecture/k8s-template-design.md)
- [数据库 Schema 关系](./architecture/database-schema-relationships.md)

### 开发指南
- [AI 模块使用](./guides/ai-module-usage.md)
- [项目创建手动测试](./guides/project-creation-manual-testing.md)
- [部署测试](./guides/deployment-test.md)

### 技术教程
- [Monorepo + Turborepo](./tutorials/monorepo-turborepo.md)
- [tRPC 全栈类型安全](./tutorials/trpc-fullstack-typesafety.md)
- [Ollama AI 集成](./tutorials/ollama-ai-integration.md)

---

## 🔍 按技术栈查找

### 后端
- **NestJS**: [架构设计](./architecture/), [问题排查](./troubleshooting/nestjs/)
- **tRPC**: [全栈类型安全教程](./tutorials/trpc-fullstack-typesafety.md)
- **Drizzle ORM**: [Relations 问题](./troubleshooting/drizzle-relations-circular-dependency.md)
- **BullMQ**: [队列系统](./architecture/project-initialization-flow-analysis.md)

### 前端
- **Vue 3**: [组件开发](./guides/), [问题排查](./troubleshooting/frontend/)
- **Vite**: [配置优化](./guides/)
- **Tailwind CSS**: [样式系统](./guides/)
- **shadcn-vue**: [UI 组件库](./guides/)

### 基础设施
- **K3s**: [安装配置](./troubleshooting/k3s-flux-reinstall-china-network.md), [远程访问](./guides/k3s-remote-access.md)
- **Flux CD**: [性能优化](./troubleshooting/flux-performance-optimization.md), [代理配置](./guides/flux-http-proxy-setup.md)
- **Docker**: [镜像构建](./guides/)

### AI & 监控
- **Ollama**: [集成教程](./tutorials/ollama-ai-integration.md), [使用指南](./guides/ai-module-usage.md)
- **OpenTelemetry**: [集成指南](./guides/opentelemetry-integration.md)

---

## 📋 文档规范

### 文档分类

| 目录 | 用途 | 示例 |
|------|------|------|
| `guides/` | 操作指南、配置说明 | 如何配置 K3s |
| `architecture/` | 架构设计、技术选型 | 项目初始化流程 |
| `troubleshooting/` | 问题排查、解决方案 | Flux 性能优化 |
| `tutorials/` | 深入教程、实战案例 | tRPC 使用教程 |
| `api/` | API 接口文档 | REST/tRPC API |

### 命名规范

- 使用 **kebab-case**
- 描述性名称，体现文档核心内容
- 例如：`k3s-flux-reinstall-china-network.md`

### 文档结构

```markdown
# 标题

**日期**: YYYY-MM-DD  
**状态**: 进行中 / 已完成  
**相关**: 相关文档链接

## 概述
简要说明

## 详细内容
具体内容

## 相关资源
- 链接1
- 链接2
```

---

## 🤝 贡献指南

### 添加新文档

1. 确定文档类型（guide / architecture / troubleshooting / tutorial）
2. 在对应目录创建 markdown 文件
3. 遵循命名规范和文档结构
4. 更新相应的 README.md 索引

### 更新现有文档

1. 在文档末尾添加更新日志
2. 更新文档头部的日期和状态
3. 如果有重大变更，更新索引

### 归档过时文档

1. 将过时文档移到 `archive/` 目录
2. 在原位置添加重定向说明
3. 更新索引，移除过时链接

---

## 📊 文档统计

- **操作指南**: 15+ 篇
- **架构设计**: 5+ 篇
- **问题排查**: 10+ 篇
- **深入教程**: 3+ 篇

---

## 🔗 外部资源

### 官方文档
- [NestJS](https://docs.nestjs.com/)
- [Vue 3](https://vuejs.org/)
- [tRPC](https://trpc.io/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [K3s](https://docs.k3s.io/)
- [Flux CD](https://fluxcd.io/docs/)

### 社区资源
- [Turborepo](https://turbo.build/repo/docs)
- [Bun](https://bun.sh/docs)
- [shadcn-vue](https://www.shadcn-vue.com/)

---

## 📮 反馈

发现文档问题或有改进建议？

1. 创建 Issue 描述问题
2. 提交 PR 修复文档
3. 在团队讨论中提出

---

**最后更新**: 2024-12-18  
**维护者**: Juanie DevOps Team
