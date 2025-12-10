# AI 响应缓存服务

使用 Redis 缓存 AI 响应以降低成本和延迟。

## 功能

- **缓存键生成**: 基于配置和选项生成唯一的缓存键
- **缓存读写**: 读取和写入缓存的 AI 响应
- **缓存清除**: 清除指定缓存、所有缓存或按提供商清除
- **缓存统计**: 记录和查询缓存命中率
- **自动过期**: 默认 24 小时 TTL

## 使用示例

### 生成缓存键

```typescript
import { AICacheService } from '@juanie/service-extensions'

const cacheKey = cacheService.generateKey(
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
  },
  {
    messages: [
      { role: 'user', content: '你好' },
    ],
  },
)
```

### 读取缓存

```typescript
const cached = await cacheService.get(cacheKey)

if (cached) {
  console.log('缓存命中:', cached.content)
  return cached
}

// 缓存未命中,调用 AI
const result = await aiClient.complete(options)
```

### 写入缓存

```typescript
// 使用默认 TTL (24 小时)
await cacheService.set(cacheKey, result)

// 自定义 TTL (1 小时)
await cacheService.set(cacheKey, result, 3600)
```

### 清除缓存

```typescript
// 清除指定缓存
await cacheService.clear(cacheKey)

// 清除所有缓存
await cacheService.clearAll()

// 清除特定提供商的缓存
await cacheService.clearByProvider('anthropic')
```

### 获取统计信息

```typescript
const stats = await cacheService.getStats()

console.log(stats)
// {
//   hits: 150,
//   misses: 50,
//   total: 200,
//   hitRate: 75.0,
// }
```

### 重置统计

```typescript
await cacheService.resetStats()
```

### 获取缓存大小

```typescript
const size = await cacheService.getCacheSize()
console.log(`缓存中有 ${size} 个键`)
```

## 缓存键生成

缓存键基于以下因素生成:

- 提供商 (provider)
- 模型 (model)
- 温度 (temperature)
- 最大 tokens (maxTokens)
- 消息内容 (messages)
- 函数定义 (functions)
- 停止序列 (stopSequences)

使用 SHA256 哈希确保:
- 相同的请求生成相同的键
- 不同的请求生成不同的键
- 键长度固定,便于存储

## 缓存策略

### TTL (Time To Live)

- **默认**: 24 小时
- **可配置**: 通过 `set()` 方法的 `ttl` 参数
- **自动过期**: Redis 自动删除过期的键

### 缓存命中率

缓存命中率计算公式:

```
命中率 = (命中次数 / 总请求次数) × 100%
```

目标命中率: > 50%

### 缓存清除策略

1. **手动清除**: 通过 API 手动清除
2. **自动过期**: TTL 到期自动删除
3. **按需清除**: 按提供商或全部清除

## 性能优化

### 缓存命中的好处

- **降低成本**: 缓存命中不产生 AI 调用费用
- **降低延迟**: 从 Redis 读取比调用 AI 快得多
- **减少负载**: 减少对 AI 提供商的请求

### 缓存未命中的处理

- 缓存读取失败不影响主流程
- 自动记录未命中统计
- 继续调用 AI 并缓存结果

## 统计功能

### 记录统计

- `recordHit()` - 记录缓存命中
- `recordMiss()` - 记录缓存未命中

### 查询统计

- `getStats()` - 获取统计信息
  - hits: 命中次数
  - misses: 未命中次数
  - total: 总请求次数
  - hitRate: 命中率 (%)

### 重置统计

- `resetStats()` - 重置所有统计计数器

## Redis 键结构

### 缓存键

```
ai:cache:{sha256_hash}
```

示例:
```
ai:cache:a1b2c3d4e5f6...
```

### 统计键

```
ai:cache:stats:hits    # 命中次数
ai:cache:stats:misses  # 未命中次数
```

## 错误处理

### 缓存读写失败

- 读取失败: 返回 null,不影响主流程
- 写入失败: 记录日志,不影响主流程
- 统计失败: 记录日志,不影响主流程

### 缓存清除失败

- 抛出 `ErrorFactory.ai.inferenceFailed()` 错误
- 包含详细的错误信息

## 最佳实践

### 1. 合理设置 TTL

```typescript
// 短期缓存 (1 小时) - 用于频繁变化的内容
await cacheService.set(key, result, 3600)

// 中期缓存 (24 小时) - 默认值
await cacheService.set(key, result)

// 长期缓存 (7 天) - 用于稳定的内容
await cacheService.set(key, result, 7 * 24 * 3600)
```

### 2. 监控缓存命中率

```typescript
// 定期检查命中率
const stats = await cacheService.getStats()

if (stats.hitRate < 50) {
  console.warn('缓存命中率过低:', stats.hitRate)
  // 考虑调整缓存策略
}
```

### 3. 定期清理缓存

```typescript
// 在模型更新后清除缓存
await cacheService.clearByProvider('anthropic')

// 在系统维护时清除所有缓存
await cacheService.clearAll()
```

### 4. 处理缓存失败

```typescript
// 缓存读取失败时的降级处理
const cached = await cacheService.get(key)

if (!cached) {
  // 调用 AI
  const result = await aiClient.complete(options)
  
  // 尝试缓存结果
  await cacheService.set(key, result)
  
  return result
}

return cached
```

## 依赖

- `@juanie/core/tokens` - Redis 注入 token
- `@juanie/types` - 类型定义和错误工厂
- `ioredis` - Redis 客户端
- `node:crypto` - SHA256 哈希

## 相关服务

- `AIService` - 核心 AI 服务 (使用此服务进行缓存)
- `UsageTrackingService` - 使用统计 (记录缓存命中)
