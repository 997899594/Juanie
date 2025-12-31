# API Gateway Silent Exit Issue - 调查中 🔍

## 问题
API Gateway 在创建 NestJS 应用时静默退出，错误代码 1，**没有输出任何错误信息**。

## 为什么不报错？

这是 Bun 运行时的一个已知问题：

1. **Bun 吞掉了错误** - 在模块初始化阶段，Bun 可能会捕获错误但不输出
2. **异步错误丢失** - Promise rejection 在某些情况下不会被正确传播
3. **进程退出太快** - 错误日志还没来得及刷新到 stdout，进程就退出了

### 解决方案

我们添加了以下调试代码来强制捕获和输出错误：

1. **延迟进程退出** - 在错误处理器中添加 `setTimeout`，确保日志输出
2. **详细的错误信息** - 输出错误的所有属性（type, message, stack, cause, code 等）
3. **多层错误捕获** - 在 bootstrap、NestFactory.create、全局错误处理器中都添加捕获

## 当前状态：✅ 已解决

API Gateway 成功启动！所有 NestJS 依赖注入问题已修复。

### 已完成的修复 ✅

1. **添加 CoreEventsModule 到 AppModule**
   - 问题：EventEmitterModule 未初始化，导致 `@OnEvent` 装饰器失败
   - 修复：在 `apps/api-gateway/src/app.module.ts` 中导入 `CoreEventsModule`
   - 位置：放在其他 Core modules 之前

2. **修复 FoundationModule 缺失导入**
   - 问题：`StorageModule` 和 `GitOpsResourcesModule` 在 index.ts 中导出但未在 FoundationModule 中导入
   - 修复：在 `packages/services/foundation/src/foundation.module.ts` 中添加导入和导出

3. **修复 main.ts 变量作用域问题**
   - 问题：`app` 变量在 try 块内声明，但在 catch 块外使用
   - 修复：将 `app` 声明移到 try 块外部

4. **添加全局错误处理器**
   - 添加 `unhandledRejection` 处理器
   - 添加 `uncaughtException` 处理器
   - 添加详细的错误日志

### 最新修复 ✅ (2025-01-22)

5. **修复 RbacService 依赖注入问题**
   - **错误**：`Nest can't resolve dependencies of the RbacService (?, PinoLogger)`
   - **原因**：缺少 `@Inject(DATABASE)` 装饰器
   - **修复**：添加 `@Inject(DATABASE)` 装饰器到构造函数参数
   - **文件**：`packages/services/foundation/src/rbac/rbac.service.ts`

6. **修复 GitProvidersModule 导出问题**
   - **错误**：`Nest can't resolve dependencies of the RepositoriesService (..., ?, GitLabClientService)`
   - **原因**：`GitProvidersModule` 只导出了 `GitProviderService`，没有导出 `GitHubClientService` 和 `GitLabClientService`
   - **修复**：在 `GitProvidersModule` 的 exports 中添加这两个服务
   - **文件**：`packages/services/foundation/src/git-providers/git-providers.module.ts`

7. **修复 ProjectInitializationModule 缺失导入**
   - **错误**：`Nest can't resolve dependencies of the ProjectInitializationService (..., ?, ...)`
   - **原因**：缺少 `GitProvidersModule` 导入
   - **修复**：在 imports 中添加 `GitProvidersModule`
   - **文件**：`packages/services/business/src/projects/initialization/initialization.module.ts`

8. **修复 WebhookModule 缺失导入**
   - **错误**：`Nest can't resolve dependencies of the GitPlatformSyncService (..., ?, ...)`
   - **原因**：缺少 `GitSyncLogsModule` 导入
   - **修复**：在 imports 中添加 `GitSyncLogsModule`
   - **文件**：`packages/services/business/src/gitops/webhooks/webhook.module.ts`

9. **修复 GitSyncModule 缺失导入**
   - **错误**：`Nest can't resolve dependencies of the OrganizationSyncService (..., ?, ...)`
   - **原因**：缺少 `OrganizationsModule` 导入
   - **修复**：在 imports 中添加 `OrganizationsModule`
   - **文件**：`packages/services/business/src/gitops/git-sync/git-sync.module.ts`

10. **修复 PinoLogger Scoped Provider 问题** ✅
   - **错误**：`InvalidClassScopeException: PinoLogger is marked as a scoped provider. Request and transient-scoped providers can't be used in combination with "get()" method.`
   - **原因**：nestjs-pino 默认将 PinoLogger 配置为 REQUEST scoped，不能在应用启动阶段使用 `app.get(PinoLogger)` 或 `app.useLogger(app.get(PinoLogger))`
   - **修复**：
     1. 移除 `app.useLogger(app.get(PinoLogger))` - LoggerModule.forRoot() 已自动配置
     2. 创建简单的 logger 对象用于启动阶段的日志输出（使用 console.log）
     3. 在请求处理阶段，NestJS 会自动注入正确的 PinoLogger 实例（带有 request context）
   - **文件**：`apps/api-gateway/src/main.ts`

### 🎉 问题已解决！

**最终状态**：API Gateway 成功启动并监听在 `http://localhost:3000`

**启动日志**：
```
✅ OpenTelemetry 已启动
📊 Prometheus 指标: http://localhost:9465/metrics
✅ Redis 连接成功，启用分布式限流
✅ NestJS 应用创建成功
🚀 API Gateway running on http://localhost:3000
📊 Health check: http://localhost:3000/health
🔌 tRPC endpoint: http://localhost:3000/trpc
🎛️  tRPC Panel: http://localhost:3000/panel
```

**非阻塞警告**（可选修复）：
- MinIO 连接警告：`Api key is used with unsecure connection`
- Qdrant 连接警告：`Failed to obtain server version`
- MinIO bucket setup error
- Ollama 连接失败（使用模拟响应）
- K8s 连接失败（开发环境正常）

### 问题模式总结

所有这些问题都是**模块依赖注入配置不完整**导致的：

1. **类型注入问题**：使用 `import type` 导入的类型在运行时不存在，需要使用 `@Inject(token)` 装饰器
2. **模块导出不完整**：Module 的 providers 中有服务，但 exports 中没有导出
3. **模块导入缺失**：Service 依赖其他模块的服务，但所在 Module 没有导入那个模块

### 修复策略

对于每个 `UnknownDependenciesException` 错误：
1. 查看错误信息中的服务名称和参数索引
2. 找到该服务的构造函数，确认缺失的依赖
3. 检查该依赖所在的模块是否被导入
4. 检查该依赖是否被正确导出

### 调查步骤 ✅

1. ✅ 检查 TypeScript 配置 - `experimentalDecorators` 和 `emitDecoratorMetadata` 已启用
2. ✅ 检查 Bun 配置 - `bunfig.toml` 配置正常
3. ✅ 添加详细错误日志 - 已在 main.ts 中添加
4. ✅ 捕获真实错误 - 通过延迟退出和详细日志成功捕获
5. ✅ 修复所有 NestJS 依赖注入问题
6. ✅ **应用成功启动** - 监听在 http://localhost:3000

### 受影响的服务

以下服务使用了 `@OnEvent` 装饰器（需要 CoreEventsModule）：
- `OrganizationSyncService` - 监听组织成员事件
- `GitSyncEventHandlerService` - 监听项目成员事件  
- `OrganizationEventHandlerService` - 监听组织创建和成员变更
- `WebhookEventListenerService` - 监听 Git 相关事件

## 相关文件
- `apps/api-gateway/src/main.ts` - 启动逻辑和错误处理（已修复）
- `apps/api-gateway/src/app.module.ts` - 模块导入（已修复）
- `packages/core/src/events/events.module.ts` - CoreEventsModule 定义
- `packages/services/foundation/src/foundation.module.ts` - Foundation 层模块（已修复）
- `packages/services/foundation/src/rbac/rbac.service.ts` - RBAC 服务（已修复）
- `packages/services/foundation/src/git-providers/git-providers.module.ts` - Git Providers 模块（已修复）
- `packages/services/business/src/projects/initialization/initialization.module.ts` - 项目初始化模块（已修复）
- `packages/services/business/src/gitops/webhooks/webhook.module.ts` - Webhook 模块（已修复）
- `packages/services/business/src/gitops/git-sync/git-sync.module.ts` - Git Sync 模块（已修复）

## 经验总结

### Bun 运行时的特殊性
- Bun 可能会吞掉模块初始化阶段的错误
- 需要添加详细的错误日志和延迟退出来捕获错误
- 使用 `setTimeout` 确保日志输出后再退出

### NestJS 依赖注入最佳实践
1. **类型注入**：使用 `import type` 的类型需要 `@Inject(token)` 装饰器
2. **模块导出**：providers 中的服务必须在 exports 中导出才能被其他模块使用
3. **模块导入**：Service 依赖其他模块的服务时，所在 Module 必须导入那个模块
4. **Scoped Providers**：REQUEST scoped 的 provider（如 PinoLogger）不能在应用启动阶段使用 `app.get()`

### 调试策略
1. 添加全局错误处理器（unhandledRejection, uncaughtException）
2. 在关键位置添加详细日志
3. 延迟进程退出，确保日志输出
4. 逐个修复依赖注入错误，每次修复后重新测试

### 日志优化 ✅ (2024-12-29)

11. **清理调试日志，统一使用 Pino**
   - **问题**：日志混合了多种格式（console.log + Pino + NestJS 默认）
   - **修复**：
     1. 删除所有 `console.log` 调试日志（main.ts, observability/tracing.ts）
     2. 移除 `logger: false` 配置，让 NestJS 使用 LoggerModule 提供的 Pino
     3. 移除 `app.useLogger(app.get('PinoLogger'))` - 避免 scoped provider 问题
   - **结果**：所有日志统一使用 Pino 结构化格式
   - **文档**：`docs/troubleshooting/pino-logger-configuration.md`

## 下一步（可选）

以下警告不影响应用运行，但可以优化：
1. 配置 MinIO 使用 HTTPS 连接
2. 配置 Qdrant 客户端跳过版本检查
3. 修复 MinIO bucket 初始化问题
4. 启动 Ollama 服务（或继续使用模拟响应）
5. 配置 K8s 连接（生产环境需要）
