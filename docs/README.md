# 📚 AI DevOps Platform 文档中心

欢迎来到 AI DevOps Platform 文档中心！这里提供了完整的项目文档，帮助你快速上手和深入了解系统。

## 🚀 快速导航

### 新手入门
- [快速开始](./getting-started/quick-start.md) - 5 分钟快速启动项目
- [项目概述](../README.md) - 了解项目特性和技术栈

### 核心文档
- [系统架构](./architecture/overview.md) - 架构设计和技术选型
- [开发指南](./development/setup.md) - 开发环境搭建和工作流程
- [部署指南](./deployment/docker.md) - Docker 和 K3s 部署方案

## 📖 文档分类

### 入门指南 (Getting Started)
- [快速开始](./getting-started/quick-start.md) - 项目安装、配置和启动

### 架构设计 (Architecture)
- [系统架构](./architecture/overview.md) - 整体架构、技术栈、核心模块
- [服务说明](./architecture/services.md) - 微服务架构和服务职责
- [数据库设计](./architecture/database.md) - 数据库 Schema 和配置

### 开发指南 (Development)
- [开发环境搭建](./development/setup.md) - 本地开发环境配置
- [Shadcn 最佳实践](./SHADCN_BEST_PRACTICE.md) - UI 组件开发规范
- [包开发指南](./PACKAGE_DEVELOPMENT.md) - Monorepo 包开发流程

### 部署运维 (Deployment)
- [Docker 部署](./deployment/docker.md) - Docker Compose 部署方案
- [K3s 部署](./deployment/k3s.md) - Kubernetes 集群部署
- [监控配置](./deployment/monitoring.md) - Prometheus 和 Grafana 配置

### 配置说明 (Configuration)
- [环境变量](./ENVIRONMENT_VARIABLES.md) - 所有环境变量说明
- [配置指南](./CONFIGURATION.md) - 系统配置详解
- [Docker 环境配置](./DOCKER_ENV_SHARING.md) - Docker 环境变量共享

### 故障排查 (Troubleshooting)
- [常见问题](./troubleshooting/common-issues.md) - 常见问题和解决方案

### API 文档 (API Documentation)
- [API 文档索引](./api/README.md) - 完整的 API 文档

### 归档文档 (Archive)
- [归档文档](./archive/) - 历史文档和已完成的迁移指南

## 🔍 快速查找指南

### 我想...

#### 开始使用项目
1. 阅读 [项目概述](../README.md) 了解项目特性
2. 按照 [快速开始](./getting-started/quick-start.md) 安装和启动
3. 查看 [系统架构](./architecture/overview.md) 理解整体设计

#### 开发新功能
1. 阅读 [开发环境搭建](./development/setup.md) 配置开发环境
2. 查看 [服务说明](./architecture/services.md) 了解服务架构
3. 参考 [包开发指南](./PACKAGE_DEVELOPMENT.md) 创建新服务

#### 部署到生产环境
1. 阅读 [Docker 部署](./deployment/docker.md) 了解部署方案
2. 配置 [环境变量](./ENVIRONMENT_VARIABLES.md)
3. 设置 [监控配置](./deployment/monitoring.md)

#### 解决问题
1. 查看 [常见问题](./troubleshooting/common-issues.md)
2. 检查 [配置指南](./CONFIGURATION.md) 确认配置正确
3. 查看日志和监控数据

## 🛠️ 常用命令

### 开发命令
```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 类型检查
bun run type-check

# 代码检查
bun run lint

# 运行测试
bun test
```

### 数据库命令
```bash
# 生成迁移
bun run db:generate

# 应用迁移
bun run db:push

# 打开 Drizzle Studio
bun run db:studio
```

### Docker 命令
```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 📝 文档贡献指南

我们欢迎你为文档做出贡献！

### 文档编写规范

1. **使用中文** - 所有文档使用中文编写，代码注释使用英文
2. **清晰的标题** - 使用有意义的标题和子标题
3. **添加目录** - 超过 3 个章节的文档应添加目录
4. **代码示例** - 提供可运行的代码示例
5. **保持更新** - 及时更新过时的内容

### 文档结构规范

每个文档应包含：
- **标题和简介** - 说明文档的目的和内容
- **目录** - 方便快速定位（可选）
- **主要内容** - 详细的说明和示例
- **相关链接** - 链接到相关文档
- **最后更新时间** - 标注更新日期

### 文档审核流程

1. **创建或编辑文档** - 在 `docs/` 目录下创建或编辑 Markdown 文件
2. **更新索引** - 在本文件中添加文档链接
3. **检查链接** - 确保所有链接有效
4. **提交 PR** - 提交 Pull Request 等待审核
5. **合并发布** - 审核通过后合并到主分支

### 文档生命周期

```
创建 → 审核 → 发布 → 维护 → 归档/删除
```

- **创建**: 编写新文档
- **审核**: 团队成员审核内容
- **发布**: 合并到主分支
- **维护**: 定期更新内容
- **归档**: 过时文档移至 `archive/` 目录
- **删除**: 完全过时的文档可以删除

### 文档更新流程

1. **定期审查** - 每季度审查文档准确性
2. **及时更新** - 功能变更时同步更新文档
3. **标注日期** - 在文档底部标注最后更新时间
4. **版本管理** - 重大变更时保留历史版本

## 🔗 外部资源

### 技术文档
- [NestJS 文档](https://docs.nestjs.com/) - 后端框架
- [tRPC 文档](https://trpc.io/docs) - 类型安全的 API
- [Vue 3 文档](https://vuejs.org/guide/) - 前端框架
- [Drizzle ORM 文档](https://orm.drizzle.team/docs/overview) - 数据库 ORM
- [BullMQ 文档](https://docs.bullmq.io/) - 消息队列

### 学习资源
- [TypeScript 手册](https://www.typescriptlang.org/docs/) - TypeScript 官方文档
- [Docker 文档](https://docs.docker.com/) - 容器化技术
- [Kubernetes 文档](https://kubernetes.io/docs/) - 容器编排
- [PostgreSQL 文档](https://www.postgresql.org/docs/) - 数据库

### 工具文档
- [Bun 文档](https://bun.sh/docs) - JavaScript 运行时
- [Turbo 文档](https://turbo.build/repo/docs) - Monorepo 构建工具
- [Biome 文档](https://biomejs.dev/) - 代码检查和格式化

## 📞 获取帮助

如果你在文档中找不到答案：

1. 📖 查看 [常见问题](./troubleshooting/common-issues.md)
2. 🔍 搜索 [GitHub Issues](https://github.com/your-org/ai-devops-platform/issues)
3. 💬 在 [GitHub Discussions](https://github.com/your-org/ai-devops-platform/discussions) 提问
4. 📧 联系团队: support@example.com

## 📅 文档更新日志

- 2024-11-03: 重组文档结构，统一文档索引
- 2024-01-XX: 添加 API 文档
- 2024-01-XX: 完善架构文档
- 2024-01-XX: 创建文档中心

---

**最后更新**: 2024-11-03  
**维护者**: AI DevOps Platform Team

