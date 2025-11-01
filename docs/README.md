# 文档索引

欢迎来到 AI DevOps Platform 文档中心！

## � 快速导导航

### 入门指南
- [README](../README.md) - 项目概述和快速开始
- [项目结构](../PROJECT_STRUCTURE.md) - 详细的项目结构说明
- [架构文档](./ARCHITECTURE.md) - 系统架构和设计

### 开发指南
- [后端开发指南](./BACKEND_GUIDE.md) - 后端开发最佳实践
- [类型系统](../TYPE_ARCHITECTURE_FINAL.md) - 类型系统架构
- [类型统一](../TYPE_UNIFICATION_FINAL.md) - 类型统一方案
- [类型检查](../TYPE_CHECK_COMPLETE.md) - 类型检查完成报告

### 运维指南
- [部署指南](./DEPLOYMENT.md) - 部署和运维
- [环境变量](./ENVIRONMENT_VARIABLES.md) - 环境变量配置
- [监控指南](./MONITORING.md) - 监控和告警
- [故障排查](./TROUBLESHOOTING.md) - 常见问题和解决方案

## 📚 文档分类

### 架构设计
- [系统架构](./ARCHITECTURE.md)
  - 技术栈
  - 架构图
  - 核心模块
  - 数据流
  - 安全设计
  - 可扩展性

### 开发文档
- [后端开发](./BACKEND_GUIDE.md)
  - 核心概念
  - 开发流程
  - 代码规范
  - 性能优化
  - 常见问题

- [类型系统](../TYPE_ARCHITECTURE_FINAL.md)
  - 类型定义
  - Schema 设计
  - 类型推导
  - 最佳实践

### 运维文档
- [部署指南](./DEPLOYMENT.md)
  - 环境准备
  - 部署流程
  - 配置说明
  - 升级指南

- [监控指南](./MONITORING.md)
  - 监控指标
  - 告警规则
  - 日志管理
  - 性能分析

- [故障排查](./TROUBLESHOOTING.md)
  - 常见问题
  - 错误代码
  - 解决方案
  - 调试技巧

## 🔍 按主题查找

### 后端开发
- [创建新服务](./BACKEND_GUIDE.md#1-创建新服务)
- [添加类型定义](./BACKEND_GUIDE.md#2-添加类型定义)
- [创建路由](./BACKEND_GUIDE.md#3-创建路由)
- [错误处理](./BACKEND_GUIDE.md#3-错误处理)
- [性能优化](./BACKEND_GUIDE.md#性能优化)

### 类型系统
- [类型定义规范](../TYPE_ARCHITECTURE_FINAL.md#类型定义规范)
- [Schema 设计](../TYPE_ARCHITECTURE_FINAL.md#schema-设计)
- [类型推导](../TYPE_ARCHITECTURE_FINAL.md#类型推导)
- [类型检查](../TYPE_CHECK_COMPLETE.md)

### 部署运维
- [Docker 部署](./DEPLOYMENT.md#docker-部署)
- [K3s 部署](./DEPLOYMENT.md#k3s-部署)
- [环境配置](./ENVIRONMENT_VARIABLES.md)
- [监控配置](./MONITORING.md)
- [日志查看](./TROUBLESHOOTING.md#日志查看)

### 安全
- [认证流程](./ARCHITECTURE.md#2-认证流程)
- [授权机制](./ARCHITECTURE.md#2-授权)
- [数据安全](./ARCHITECTURE.md#3-数据安全)
- [审计日志](./ARCHITECTURE.md#4-审计)

## 🛠️ 工具和脚本

### 开发工具
```bash
# 类型检查
bun run type-check

# 代码检查
bun run lint

# 运行测试
bun test

# 构建项目
bun run build
```

### 数据库工具
```bash
# 生成迁移
bun run db:generate

# 应用迁移
bun run db:push

# 打开 Studio
bun run db:studio
```

### 部署工具
```bash
# 启动开发环境
docker-compose up -d

# 启动生产环境
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose logs -f
```

## 📝 文档贡献

### 如何贡献文档

1. 在 `docs/` 目录下创建或编辑 Markdown 文件
2. 遵循现有文档的格式和风格
3. 添加必要的代码示例和图表
4. 更新此索引文件
5. 提交 Pull Request

### 文档规范

- 使用 Markdown 格式
- 添加清晰的标题和目录
- 提供代码示例
- 包含实际的使用场景
- 保持文档更新

## 🔗 外部资源

### 技术文档
- [NestJS 文档](https://docs.nestjs.com/)
- [tRPC 文档](https://trpc.io/docs)
- [Vue 3 文档](https://vuejs.org/guide/)
- [Drizzle ORM 文档](https://orm.drizzle.team/docs/overview)
- [BullMQ 文档](https://docs.bullmq.io/)

### 学习资源
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Docker 文档](https://docs.docker.com/)
- [Kubernetes 文档](https://kubernetes.io/docs/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)

## 📞 获取帮助

如果你在文档中找不到答案：

1. 查看 [故障排查](./TROUBLESHOOTING.md)
2. 搜索 [GitHub Issues](https://github.com/your-org/ai-devops-platform/issues)
3. 在 [GitHub Discussions](https://github.com/your-org/ai-devops-platform/discussions) 提问
4. 联系团队: support@example.com

## 📅 文档更新日志

- 2024-01-XX: 创建文档索引
- 2024-01-XX: 添加后端开发指南
- 2024-01-XX: 完善架构文档
- 2024-01-XX: 更新部署指南

---

最后更新: 2024-01-XX
