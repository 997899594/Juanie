# Redis Rate Limit 修复说明

## 🐛 问题描述

API Gateway 启动时出现错误：

```
TypeError: this.redis.defineCommand is not a function
```

**错误原因**: `@fastify/rate-limit` 插件期望接收一个 `ioredis` 客户端实例，但代码中传入的是 Redis URL 字符串。

---

## ✅ 解决方案

### 修改内容

在 `apps/api-gateway/src/main.ts` 中：

1. **导入 ioredis**
```typescript
import Redis from 'ioredis'
```

2. **创建 Redis 客户端实例**
```typescript
// 如果配置了 Redis，使用 Redis 存储（生产环境推荐）
if (process.env.REDIS_URL) {
  try {
    const redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    })
    
    // 测试连接
    await redis.connect()
    console.log('✅ Redis 连接成功，启用分布式限流')
    
    rateLimitConfig.redis = redis
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn('⚠️ Redis 连接失败，使用内存限流:', errorMessage)
  }
}
```

### 修改前后对比

**修改前** ❌:
```typescript
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  cache: 10000,
  allowList: ['127.0.0.1'],
  redis: process.env.REDIS_URL, // ❌ 错误：传入字符串
})
```

**修改后** ✅:
```typescript
const rateLimitConfig: any = {
  max: 100,
  timeWindow: '1 minute',
  cache: 10000,
  allowList: ['127.0.0.1'],
}

if (process.env.REDIS_URL) {
  try {
    const redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    })
    
    await redis.connect()
    console.log('✅ Redis 连接成功，启用分布式限流')
    
    rateLimitConfig.redis = redis // ✅ 正确：传入客户端实例
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn('⚠️ Redis 连接失败，使用内存限流:', errorMessage)
  }
}

await fastify.register(rateLimit, rateLimitConfig)
```

---

## 🎯 功能说明

### Rate Limiting 配置

- **max**: 100 - 每个时间窗口最多 100 个请求
- **timeWindow**: '1 minute' - 时间窗口为 1 分钟
- **cache**: 10000 - 缓存 10000 个 IP 地址
- **allowList**: ['127.0.0.1'] - 白名单（本地请求不限流）

### Redis 配置

- **maxRetriesPerRequest**: 3 - 每个请求最多重试 3 次
- **enableReadyCheck**: true - 启用就绪检查
- **lazyConnect**: true - 延迟连接（手动调用 connect）

### 降级策略

如果 Redis 连接失败，系统会自动降级到**内存限流**模式：
- ✅ 单机环境：使用内存存储，功能正常
- ⚠️ 多机环境：每台机器独立限流，无法共享状态

---

## 🚀 启动说明

### 1. 不使用 Redis（开发环境）

如果 `.env` 中没有配置 `REDIS_URL`，系统会使用内存限流：

```bash
# .env 中不设置 REDIS_URL
bun run dev
```

输出：
```
🚀 API Gateway running on http://localhost:3000
```

### 2. 使用 Redis（生产环境推荐）

配置 Redis URL 后，系统会使用分布式限流：

```bash
# .env
REDIS_URL=redis://localhost:6379
```

启动：
```bash
bun run dev
```

输出：
```
✅ Redis 连接成功，启用分布式限流
🚀 API Gateway running on http://localhost:3000
```

### 3. Redis 连接失败

如果 Redis 配置错误或服务未启动，系统会自动降级：

输出：
```
⚠️ Redis 连接失败，使用内存限流: Connection refused
🚀 API Gateway running on http://localhost:3000
```

---

## 📊 测试限流

### 测试命令

```bash
# 快速发送 150 个请求（超过限制）
for i in {1..150}; do
  curl -s http://localhost:3000/health > /dev/null
  echo "Request $i"
done
```

### 预期结果

- 前 100 个请求：正常返回 200
- 第 101-150 个请求：返回 429 Too Many Requests

### 响应示例

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded, retry in 1 minute"
}
```

---

## 🔧 依赖说明

### 已安装的依赖

在 `apps/api-gateway/package.json` 中：

```json
{
  "dependencies": {
    "@fastify/rate-limit": "^10.3.0",
    "ioredis": "^5.4.2"
  }
}
```

### 如果缺少依赖

```bash
cd apps/api-gateway
bun add ioredis
```

---

## 🎯 最佳实践

### 开发环境

- 不配置 Redis，使用内存限流
- 限流阈值可以设置得宽松一些

### 生产环境

- **必须配置 Redis**，实现分布式限流
- 根据实际情况调整限流参数
- 监控限流指标

### 限流参数建议

```typescript
// 开发环境
{
  max: 1000,
  timeWindow: '1 minute',
}

// 生产环境 - API
{
  max: 100,
  timeWindow: '1 minute',
}

// 生产环境 - 登录接口
{
  max: 5,
  timeWindow: '5 minutes',
}
```

---

## 📝 相关文档

- [@fastify/rate-limit 文档](https://github.com/fastify/fastify-rate-limit)
- [ioredis 文档](https://github.com/redis/ioredis)
- [Redis 官方文档](https://redis.io/docs/)

---

## ✅ 验证修复

运行以下命令验证修复：

```bash
# 1. 启动 Redis（如果使用）
docker-compose up -d dragonfly

# 2. 启动 API Gateway
bun run dev

# 3. 检查日志
# 应该看到：
# ✅ Redis 连接成功，启用分布式限流
# 🚀 API Gateway running on http://localhost:3000

# 4. 测试限流
curl http://localhost:3000/health
```

---

**修复日期**: 2024-01-20  
**状态**: ✅ 已修复  
**影响范围**: API Gateway 启动流程
