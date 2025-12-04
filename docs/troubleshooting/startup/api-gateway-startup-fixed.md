# API Gateway 启动问题已解决

## 问题总结

**日期**: 2024-12-02  
**状态**: ✅ 已解决

## 根本原因

**Redis 服务未运行**: BullMQ 模块需要 Redis 连接,但 Redis 服务没有启动,导致应用在初始化 BullMQ 时挂起。

## 解决步骤

### 1. 识别问题

通过添加调试日志发现应用卡在 `AppModule dependencies initialized` 之后,怀疑是某个异步服务初始化问题。

### 2. 检查 Redis 连接

```bash
# 检查 Redis 连接
redis-cli ping
# 输出: Could not connect to Redis at 127.0.0.1:6379: Connection refused
```

### 3. 启动 Redis 服务

```bash
# 启动 Redis 服务
redis-server --daemonize yes --port 6379

# 验证连接
redis-cli ping
# 输出: PONG
```

### 4. 验证修复

启动 API Gateway:
```bash
npx ts-node src/main.ts
```

成功输出:
```
🔧 Creating NestJS application...
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [InstanceLoader] DatabaseModule dependencies initialized +21ms
[Nest] LOG [InstanceLoader] ConfigModule dependencies initialized +1ms
[Nest] LOG [InstanceLoader] EventEmitterModule dependencies initialized +1ms
[Nest] LOG [InstanceLoader] BullModule dependencies initialized +0ms
...
[Nest] LOG [InstanceLoader] TrpcAdapter dependencies initialized +0ms
✅ Application created successfully
🔧 Setting up global exception filter...
✅ Global exception filter set up
🔧 Setting up validation pipe...
✅ Validation pipe set up
🔧 Setting up TRPC adapter...
✅ TRPC adapter set up
🔧 Starting application on port 3001...
[Nest] LOG [NestApplication] Nest application successfully started +1ms
🚀 API Gateway is running on http://localhost:3001
```

## 功能验证

### Webhook 端点测试

```bash
# 测试 Webhook 健康检查
curl -X POST http://localhost:3001/webhooks/health

# 响应:
{
  "status": "ok",
  "timestamp": "2024-12-02T10:34:31.000Z",
  "service": "webhook-handler"
}
```

## 修复的问题列表

在解决启动问题的过程中,还修复了以下问题:

### 1. ✅ 缺少 NestJS 依赖

**问题**: `Cannot resolve module "@nestjs/core"`

**解决**: 在 `apps/api-gateway/package.json` 中添加了必要的 NestJS 依赖:
- @nestjs/common
- @nestjs/core
- @nestjs/platform-express
- @nestjs/config
- @nestjs/event-emitter
- @nestjs/bullmq
- reflect-metadata
- rxjs

### 2. ✅ TypeScript 模块解析问题

**问题**: `moduleResolution: "bundler"` 导致模块解析失败

**解决**: 在 `apps/api-gateway/tsconfig.json` 中改为 `moduleResolution: "node"`

### 3. ✅ Core 包导出问题

**问题**: `@juanie/core/errors` 模块找不到

**解决**: 在 `packages/core/package.json` 中添加了 `./errors` 导出配置

### 4. ✅ CodeReviewService 不存在

**问题**: `ai-code-review.router.ts` 导入了不存在的服务

**解决**: 暂时注释掉相关代码,添加 TODO 标记

### 5. ✅ Redis 连接问题

**问题**: BullMQ 需要 Redis 但服务未启动

**解决**: 启动 Redis 服务

## 预防措施

### 1. 添加启动前检查脚本

创建 `scripts/check-dependencies.ts`:

```typescript
#!/usr/bin/env bun

// 检查 Redis 是否运行
async function checkRedis() {
  try {
    const redis = new Redis(process.env.REDIS_URL)
    await redis.ping()
    console.log('✅ Redis is running')
    redis.disconnect()
  } catch (error) {
    console.error('❌ Redis is not running')
    console.error('Please start Redis: redis-server --daemonize yes')
    process.exit(1)
  }
}

// 检查数据库
async function checkDatabase() {
  // 检查数据库连接
}

await checkRedis()
await checkDatabase()
```

### 2. 更新开发文档

在 `docs/guides/quick-start.md` 中添加 Redis 启动说明:

```markdown
## 启动开发环境

1. 启动 Redis:
   ```bash
   redis-server --daemonize yes
   ```

2. 启动 Docker 服务:
   ```bash
   bun run docker:up
   ```

3. 启动开发服务器:
   ```bash
   bun run dev
   ```
```

### 3. 添加健康检查端点

在 API Gateway 中添加健康检查端点,检查所有依赖服务:

```typescript
@Get('/health')
async health() {
  return {
    status: 'ok',
    redis: await this.checkRedis(),
    database: await this.checkDatabase(),
    timestamp: new Date().toISOString(),
  }
}
```

### 4. 改进错误处理

在 `main.ts` 中添加的全局错误处理已经可以捕获未处理的异常:

```typescript
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  process.exit(1)
})
```

## 相关文档

- [API Gateway 启动问题排查](./api-gateway-startup-issue.md) - 详细的排查过程
- [快速开始指南](../../guides/quick-start.md) - 开发环境设置
- [架构文档](../../ARCHITECTURE.md) - 系统架构说明

## 总结

这次问题的根本原因是 Redis 服务未启动,导致 BullMQ 模块初始化时挂起。通过添加调试日志和系统性排查,成功定位并解决了问题。

同时,在解决过程中还修复了多个依赖和配置问题,使 API Gateway 能够正常启动。

**关键经验**:
1. 异步服务初始化问题很难排查,需要添加详细的日志
2. 依赖服务(如 Redis)的状态检查应该在启动前进行
3. 良好的错误处理和日志记录对问题排查至关重要
