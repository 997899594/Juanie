# 需求文档：上游工具迁移

## 简介

本规范解决了从自定义实现系统性迁移到成熟的上游工具和 SDK 的问题，覆盖整个代码库。目标是减少维护负担、提高可靠性，并利用经过实战检验的解决方案。

## 术语表

- **上游工具（Upstream Tool）**: 由原始供应商或社区提供的官方 SDK、库或工具
- **自定义实现（Custom Implementation）**: 手写代码，重复了上游工具中已有的功能
- **SDK**: 软件开发工具包 - API 或服务的官方客户端库
- **迁移（Migration）**: 用上游工具等效替换自定义代码的过程
- **系统（System）**: AI DevOps 平台代码库

## 需求

### 需求 1：GitHub API 迁移

**用户故事：** 作为开发者，我希望使用 GitHub 官方 SDK 而不是手写的 API 调用，以便获得官方支持、自动更新和内置最佳实践。

#### 验收标准

1. WHEN 系统需要与 GitHub API 交互时，THE 系统 SHALL 使用 `@octokit/rest` 官方 SDK
2. THE 系统 SHALL 删除所有手写的对 `api.github.com` 的 `fetch()` 调用
3. WHEN GitHub API 发生变化时，THE 系统 SHALL 只需更新 SDK 版本
4. THE 系统 SHALL 利用 Octokit 内置的重试逻辑、速率限制和错误处理
5. THE 系统 SHALL 使用 Octokit 的 TypeScript 类型而不是自定义类型定义

### 需求 2：GitLab API 迁移

**用户故事：** 作为开发者，我希望使用 GitLab 官方 SDK 而不是手写的 API 调用，以便获得社区支持和自动 API 更新。

#### 验收标准

1. WHEN 系统需要与 GitLab API 交互时，THE 系统 SHALL 使用 `@gitbeaker/rest` 官方 SDK
2. THE 系统 SHALL 删除所有手写的对 `gitlab.com/api` 的 `fetch()` 调用
3. WHEN GitLab API 发生变化时，THE 系统 SHALL 只需更新 SDK 版本
4. THE 系统 SHALL 利用 Gitbeaker 内置的重试逻辑和错误处理
5. THE 系统 SHALL 使用 Gitbeaker 的 TypeScript 类型而不是自定义类型定义

### 需求 3：Kubernetes 客户端整合

**用户故事：** 作为开发者，我希望使用单一的官方 Kubernetes 客户端，以便在整个代码库中保持一致的 K8s 交互。

#### 验收标准

1. THE 系统 SHALL 仅使用 `@kubernetes/client-node` 官方 SDK 进行所有 K8s 操作
2. THE 系统 SHALL 删除任何重复的 K8s 客户端实现（例如，单独的 K3sService）
3. WHEN K8s API 发生变化时，THE 系统 SHALL 只需更新官方客户端版本
4. THE 系统 SHALL 使用官方客户端内置的身份验证和配置加载
5. THE 系统 SHALL 利用官方客户端的 TypeScript 类型

### 需求 4：Flux CLI 包装器优化

**用户故事：** 作为开发者，我希望围绕 Flux CLI 的包装代码最少，以便利用 Flux 的原生能力而无需不必要的抽象。

#### 验收标准

1. THE 系统 SHALL 直接使用 Flux CLI 进行所有 Flux 操作
2. THE 系统 SHALL 删除 Core 层和 Business 层之间重复的 Flux 服务实现
3. WHEN Flux CLI 发生变化时，THE 系统 SHALL 只需更新 CLI 版本
4. THE 系统 SHALL 使用 Flux 原生的 YAML 生成而不是自定义生成器
5. THE 系统 SHALL 利用 Flux 内置的协调和健康检查

### 需求 5：数据库 ORM 利用

**用户故事：** 作为开发者，我希望充分利用 Drizzle ORM 的能力，以便避免编写原始 SQL 并受益于类型安全的查询。

#### 验收标准

1. THE 系统 SHALL 使用 Drizzle 的关系查询 API 进行所有复杂查询
2. THE 系统 SHALL 删除所有 Drizzle 提供等效功能的原始 SQL 查询
3. THE 系统 SHALL 使用 Drizzle 的事务 API 而不是手动事务管理
4. THE 系统 SHALL 利用 Drizzle 的类型推断来获取查询结果
5. THE 系统 SHALL 使用 Drizzle 的迁移系统进行模式更改

### 需求 6：队列系统简化

**用户故事：** 作为开发者，我希望使用 BullMQ 的原生功能，以便避免自定义队列管理代码。

#### 验收标准

1. THE 系统 SHALL 使用 BullMQ 内置的作业事件而不是自定义事件发布器
2. THE 系统 SHALL 使用 BullMQ 内置的重试和退避策略
3. THE 系统 SHALL 使用 BullMQ 内置的作业进度跟踪
4. THE 系统 SHALL 利用 BullMQ 内置的作业优先级
5. THE 系统 SHALL 使用 BullMQ 内置的作业调度功能

### 需求 7：Redis 客户端优化

**用户故事：** 作为开发者，我希望充分利用 ioredis 的能力，以便避免自定义 Redis 包装代码。

#### 验收标准

1. THE 系统 SHALL 使用 ioredis 内置的连接池
2. THE 系统 SHALL 使用 ioredis 内置的重试策略
3. THE 系统 SHALL 使用 ioredis 内置的发布/订阅功能
4. THE 系统 SHALL 利用 ioredis 内置的 Lua 脚本支持
5. THE 系统 SHALL 在需要时使用 ioredis 内置的集群支持

### 需求 8：事件系统整合

**用户故事：** 作为开发者，我希望直接使用 EventEmitter2，以便避免自定义事件包装代码。

#### 验收标准

1. THE 系统 SHALL 直接使用 `@nestjs/event-emitter` 的 EventEmitter2
2. THE 系统 SHALL 删除自定义事件发布器包装器
3. THE 系统 SHALL 使用 EventEmitter2 内置的通配符支持
4. THE 系统 SHALL 利用 EventEmitter2 内置的异步事件处理
5. THE 系统 SHALL 使用 EventEmitter2 内置的错误处理

### 需求 9：日志系统简化

**用户故事：** 作为开发者，我希望直接使用 Pino 日志记录器，以便避免自定义日志包装器。

#### 验收标准

1. THE 系统 SHALL 在所有服务中直接使用 `nestjs-pino`
2. THE 系统 SHALL 删除自定义日志记录器包装类
3. THE 系统 SHALL 使用 Pino 内置的子日志记录器功能
4. THE 系统 SHALL 利用 Pino 内置的序列化器
5. THE 系统 SHALL 使用 Pino 内置的日志级别和过滤

### 需求 10：代码重复消除

**用户故事：** 作为开发者，我希望消除重复实现，以便只在一个地方维护代码。

#### 验收标准

1. WHEN 功能存在于多个层时，THE 系统 SHALL 只保留正确层的实现
2. THE 系统 SHALL 删除 Core 层和 Business 层 Flux 实现之间 95%+ 的重复代码
3. THE 系统 SHALL 将 K8s 客户端实现整合到单个服务中
4. THE 系统 SHALL 删除重复的 YAML 生成器实现
5. THE 系统 SHALL 删除重复的错误处理代码

### 需求 11：依赖版本管理

**用户故事：** 作为开发者，我希望集中管理依赖，以便避免版本冲突和安全问题。

#### 验收标准

1. THE 系统 SHALL 在根 `package.json` 中定义所有上游工具版本
2. THE 系统 SHALL 使用 `resolutions` 字段在工作区中强制执行一致的版本
3. WHEN 有安全更新可用时，THE 系统 SHALL 只需更新根依赖
4. THE 系统 SHALL 运行 `bun run reinstall` 以应用版本更改
5. THE 系统 SHALL 验证 `node_modules` 中不存在重复版本

### 需求 12：迁移验证

**用户故事：** 作为开发者，我希望自动验证迁移，以便确保不会丢失任何功能。

#### 验收标准

1. WHEN 迁移完成时，THE 系统 SHALL 通过所有现有测试
2. THE 系统 SHALL 验证与先前实现的 API 兼容性
3. THE 系统 SHALL 测量并报告代码减少指标
4. THE 系统 SHALL 验证 TypeScript 编译无错误
5. THE 系统 SHALL 通过集成测试验证运行时功能

### 需求 13：文档更新

**用户故事：** 作为开发者，我希望更新文档，以便了解如何正确使用上游工具。

#### 验收标准

1. WHEN 采用上游工具时，THE 系统 SHALL 更新项目指南中的导入示例
2. THE 系统 SHALL 记录 SDK 配置和最佳实践
3. THE 系统 SHALL 为每个上游工具提供迁移指南
4. THE 系统 SHALL 更新架构图以反映上游工具的使用
5. THE 系统 SHALL 记录版本更新程序

### 需求 14：错误处理标准化

**用户故事：** 作为开发者，我希望使用上游工具的原生错误处理，以便避免自定义错误转换代码。

#### 验收标准

1. THE 系统 SHALL 直接使用 SDK 提供的错误类型
2. THE 系统 SHALL 删除自定义错误转换层
3. WHEN SDK 抛出错误时，THE 系统 SHALL 仅在添加业务上下文时将其包装在特定于域的错误中
4. THE 系统 SHALL 利用 SDK 错误代码和消息
5. THE 系统 SHALL 使用 SDK 重试机制而不是自定义重试逻辑

### 需求 15：类型安全增强

**用户故事：** 作为开发者，我希望使用 SDK 提供的 TypeScript 类型，以便在没有手动类型定义的情况下获得准确的类型检查。

#### 验收标准

1. THE 系统 SHALL 删除重复 SDK 类型的自定义类型定义
2. THE 系统 SHALL 使用 SDK 类型推断来获取 API 响应
3. THE 系统 SHALL 利用 SDK 泛型类型进行类型安全操作
4. THE 系统 SHALL 使用 SDK 判别联合类型来处理变体类型
5. THE 系统 SHALL 验证在 SDK 提供类型时不使用 `any` 类型
