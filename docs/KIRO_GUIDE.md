# Kiro AI 使用指南

本文档介绍如何使用 Kiro AI 助手来提高 Juanie 项目的开发效率。

---

## 🤖 什么是 Kiro？

Kiro 是一个智能 AI 编程助手，集成在 IDE 中，可以帮助你：
- 理解和分析代码
- 生成和重构代码
- 调试和修复问题
- 编写文档和测试
- 优化性能和架构

---

## 🚀 快速开始

### 1. 基本对话

直接向 Kiro 提问或描述需求：

```
你: 帮我创建一个新的项目管理服务

Kiro: 我会帮你创建一个完整的项目管理服务...
```

### 2. 引用文件

使用 `#File` 或 `#Folder` 引用特定文件或文件夹：

```
你: 分析 #File:apps/api-gateway/src/app.module.ts 的结构

你: 重构 #Folder:packages/services/projects 中的代码
```

### 3. 查看问题

使用 `#Problems` 查看当前文件的问题：

```
你: 修复 #Problems 中的所有错误
```

### 4. 查看终端输出

使用 `#Terminal` 查看终端输出：

```
你: 分析 #Terminal 中的错误信息
```

### 5. 查看 Git 差异

使用 `#Git Diff` 查看代码变更：

```
你: 审查 #Git Diff 中的改动
```

---

## 💡 常见使用场景

### 场景 1: 创建新功能

**需求**: 创建一个新的成本优化建议功能

```
你: 我需要在成本追踪服务中添加一个成本优化建议功能，
    分析项目的资源使用情况，提供优化建议。

Kiro: 我会帮你创建这个功能，包括：
1. 在 packages/services/cost-tracking 中添加优化建议服务
2. 创建数据库 schema
3. 添加 tRPC 路由
4. 创建前端组件

[Kiro 会自动创建所需的文件和代码]
```

### 场景 2: 修复 Bug

**问题**: 项目创建后无法正确初始化仓库

```
你: #File:packages/services/projects/src/project-orchestrator.service.ts
    项目创建后仓库初始化失败，请帮我调试

Kiro: 我看到了问题，在 createProject 方法中...
[Kiro 会分析代码并提供修复方案]
```

### 场景 3: 代码重构

**需求**: 重构项目服务，提高代码质量

```
你: 重构 #Folder:packages/services/projects，
    改进代码结构，添加错误处理，优化性能

Kiro: 我会进行以下重构：
1. 提取公共逻辑到工具函数
2. 添加完善的错误处理
3. 优化数据库查询
4. 添加缓存层

[Kiro 会逐步重构代码]
```

### 场景 4: 编写测试

**需求**: 为项目服务编写单元测试

```
你: 为 #File:packages/services/projects/src/projects.service.ts
    编写完整的单元测试

Kiro: 我会创建测试文件并编写测试用例...
[Kiro 会创建测试文件并编写测试代码]
```

### 场景 5: 性能优化

**问题**: 项目列表加载缓慢

```
你: #File:apps/api-gateway/src/routers/projects.router.ts
    项目列表查询很慢，请帮我优化性能

Kiro: 我会进行以下优化：
1. 添加数据库索引
2. 实现查询缓存
3. 优化关联查询
4. 添加分页

[Kiro 会提供优化方案并实施]
```

### 场景 6: 架构设计

**需求**: 设计一个新的微服务架构

```
你: 我想将部署管理拆分成独立的微服务，
    请帮我设计架构并实施

Kiro: 我会设计以下架构：
1. 服务拆分方案
2. 服务间通信方式
3. 数据一致性保证
4. 部署和监控方案

[Kiro 会提供详细的架构设计]
```

---

## 🎯 最佳实践

### 1. 明确描述需求

❌ **不好的提问**:
```
你: 帮我改一下代码
```

✅ **好的提问**:
```
你: 在 #File:packages/services/projects/src/projects.service.ts 中，
    添加一个方法来批量归档项目，需要：
    1. 支持批量操作
    2. 添加事务处理
    3. 发送通知
    4. 记录审计日志
```

### 2. 提供上下文

使用 `#File`、`#Folder`、`#Problems` 等提供上下文：

```
你: 我在 #File:apps/web/src/views/Projects.vue 中遇到类型错误，
    #Problems 显示 "Property 'name' does not exist"，
    请帮我修复
```

### 3. 分步骤进行

对于复杂任务，分步骤进行：

```
你: 第一步：创建数据库 schema
    第二步：创建服务层
    第三步：创建 API 路由
    第四步：创建前端组件
```

### 4. 验证结果

让 Kiro 帮你验证修改：

```
你: 检查刚才的修改是否有语法错误或类型问题
```

### 5. 请求解释

如果不理解某段代码，请求解释：

```
你: 解释 #File:packages/core/queue/src/workers/project-initialization.worker.ts
    中的工作流程
```

---

## 🔧 高级技巧

### 1. 批量操作

```
你: 在 #Folder:packages/services 中的所有服务添加错误处理中间件
```

### 2. 代码审查

```
你: 审查 #Git Diff 中的改动，检查：
    1. 代码质量
    2. 安全问题
    3. 性能问题
    4. 最佳实践
```

### 3. 生成文档

```
你: 为 #Folder:packages/services/projects 生成 API 文档
```

### 4. 数据库迁移

```
你: 创建数据库迁移，添加 cost_optimization_suggestions 表
```

### 5. 性能分析

```
你: 分析 #File:apps/api-gateway/src/routers/projects.router.ts
    的性能瓶颈并提供优化建议
```

---

## 📚 项目特定指南

### 创建新服务

```
你: 创建一个新的服务 @juanie/service-resource-monitoring，
    用于监控 K8s 资源使用情况，包括：
    1. 服务模块和类型定义
    2. 数据库 schema
    3. tRPC 路由
    4. 前端组件
```

### 添加新路由

```
你: 在 apps/web/src/router/index.ts 中添加资源监控页面路由，
    路径为 /monitoring/resources
```

### 创建数据库表

```
你: 在 packages/core/database/src/schemas/ 中创建
    resource-metrics.schema.ts，包含以下字段：
    - id (uuid)
    - projectId (uuid)
    - resourceType (varchar)
    - metrics (jsonb)
    - timestamp (timestamp)
```

### 添加 UI 组件

```
你: 在 apps/web/src/components/ 中创建 ResourceMetricsChart.vue，
    使用 ECharts 展示资源使用趋势
```

---

## ⚠️ 注意事项

### 1. 敏感信息

不要在对话中包含敏感信息（密码、密钥等）：

❌ **不要这样做**:
```
你: 使用密码 "mypassword123" 连接数据库
```

✅ **应该这样做**:
```
你: 从环境变量中读取数据库密码
```

### 2. 代码审查

Kiro 生成的代码需要人工审查：

```
你: 生成代码后，请帮我检查：
    1. 类型安全
    2. 错误处理
    3. 边界情况
    4. 性能影响
```

### 3. 测试验证

重要功能需要编写测试：

```
你: 为刚才创建的功能编写单元测试和集成测试
```

### 4. 文档更新

修改代码后更新文档：

```
你: 更新 docs/API_REFERENCE.md，添加新的 API 端点文档
```

---

## 🎓 学习资源

### Kiro 官方文档

- [Kiro 使用指南](https://kiro.ai/docs)
- [最佳实践](https://kiro.ai/docs/best-practices)
- [示例项目](https://kiro.ai/examples)

### 项目相关

- [项目概览](./PROJECT_OVERVIEW.md)
- [架构设计](./ARCHITECTURE.md)
- [开发指南](./DEVELOPMENT.md)
- [API 参考](./API_REFERENCE.md)

---

## 💬 示例对话

### 完整的功能开发流程

```
你: 我需要添加一个项目健康度评分功能

Kiro: 好的，我会帮你实现这个功能。让我先了解一下需求：
      1. 评分标准是什么？
      2. 需要考虑哪些指标？
      3. 评分结果如何展示？

你: 评分标准：
    - 代码质量 (30%)
    - 测试覆盖率 (20%)
    - 部署频率 (20%)
    - 故障率 (15%)
    - 文档完整性 (15%)
    
    需要在项目详情页展示评分和详细分析

Kiro: 明白了，我会创建以下内容：
      1. 数据库 schema (project_health_scores)
      2. 服务层 (ProjectHealthService)
      3. tRPC 路由 (projectHealth.calculate)
      4. 前端组件 (ProjectHealthScore.vue)
      5. 定时任务 (每日计算评分)

      开始实施吗？

你: 开始吧

Kiro: [开始创建文件和代码...]
      
      ✅ 已创建 packages/core/database/src/schemas/project-health-scores.schema.ts
      ✅ 已创建 packages/services/project-health/src/project-health.service.ts
      ✅ 已创建 apps/api-gateway/src/routers/project-health.router.ts
      ✅ 已创建 apps/web/src/components/ProjectHealthScore.vue
      ✅ 已创建 packages/core/queue/src/workers/health-score-calculation.worker.ts
      
      功能已完成！需要我：
      1. 运行数据库迁移
      2. 编写测试
      3. 更新文档

你: 是的，请全部完成

Kiro: [继续完成剩余任务...]
```

---

## 🤝 反馈和改进

如果 Kiro 的回答不符合预期：

1. **提供更多上下文**: 使用 `#File`、`#Folder` 等
2. **明确需求**: 详细描述期望的结果
3. **分步骤进行**: 将复杂任务拆分成小步骤
4. **请求解释**: 让 Kiro 解释它的思路

---

**最后更新**: 2024-01-20  
**维护者**: Juanie Team

**提示**: Kiro 是你的编程伙伴，善用它可以大大提高开发效率！
