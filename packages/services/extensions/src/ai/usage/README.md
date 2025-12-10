# 使用统计和成本追踪服务

提供 AI 使用的统计、成本计算、配额管理和告警功能。

## 功能

- **使用记录**: 记录每次 AI 调用的 token 使用量和成本
- **成本计算**: 基于模型定价自动计算成本
- **统计聚合**: 按用户、项目、模型、提供商聚合统计
- **配额管理**: 设置月度 token 和成本配额
- **告警触发**: 使用量达到 90% 时触发告警
- **缓存统计**: 记录缓存命中并计算命中率

## 使用示例

### 记录使用

```typescript
import { UsageTrackingService } from '@juanie/service-extensions'

await usageTracking.record({
  userId: 'user-123',
  projectId: 'project-456',
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  usage: {
    promptTokens: 1000,
    completionTokens: 500,
    totalTokens: 1500,
  },
  timestamp: new Date(),
})
```

### 记录缓存命中

```typescript
await usageTracking.recordCacheHit({
  userId: 'user-123',
  projectId: 'project-456',
})
```

### 获取统计数据

```typescript
// 获取用户的统计
const stats = await usageTracking.getStatistics({
  userId: 'user-123',
})

console.log(stats)
// {
//   totalCalls: 100,
//   totalTokens: 150000,
//   totalCost: 4500, // 45.00 元
//   byProvider: {
//     anthropic: { calls: 50, tokens: 75000, cost: 2250 },
//     openai: { calls: 50, tokens: 75000, cost: 2250 },
//   },
//   byModel: {
//     'claude-3-5-sonnet-20241022': { calls: 50, tokens: 75000, cost: 2250 },
//     'gpt-4-turbo': { calls: 50, tokens: 75000, cost: 2250 },
//   },
// }

// 获取项目的统计
const projectStats = await usageTracking.getStatistics({
  projectId: 'project-456',
})

// 获取时间范围内的统计
const monthStats = await usageTracking.getStatistics({
  userId: 'user-123',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
})
```

### 检查配额

```typescript
const quotaStatus = await usageTracking.checkQuota({
  userId: 'user-123',
  monthlyTokenLimit: 1_000_000, // 100 万 tokens
  monthlyCostLimit: 10000, // 100 元
})

console.log(quotaStatus)
// {
//   exceeded: false,
//   usage: { tokens: 150000, cost: 4500 },
//   limits: { tokens: 1000000, cost: 10000 },
//   percentage: { tokens: 15, cost: 45 },
// }
```

### 检查并触发告警

```typescript
const alert = await usageTracking.checkAndAlert({
  userId: 'user-123',
  monthlyTokenLimit: 1_000_000,
  monthlyCostLimit: 10000,
})

if (alert.shouldAlert) {
  console.log(`[${alert.level}] ${alert.message}`)
  // 发送告警通知
}
```

### 获取缓存命中率

```typescript
const hitRate = await usageTracking.getCacheHitRate({
  userId: 'user-123',
})

console.log(`缓存命中率: ${hitRate.toFixed(2)}%`)
```

## 模型定价

服务内置了主流模型的定价配置 (每 1M tokens 的价格,单位:分):

### Claude 模型
- `claude-3-5-sonnet-20241022`: 输入 ¥3.00, 输出 ¥15.00
- `claude-3-opus-20240229`: 输入 ¥15.00, 输出 ¥75.00
- `claude-3-sonnet-20240229`: 输入 ¥3.00, 输出 ¥15.00
- `claude-3-haiku-20240307`: 输入 ¥0.25, 输出 ¥1.25

### OpenAI 模型
- `gpt-4-turbo`: 输入 ¥10.00, 输出 ¥30.00
- `gpt-4`: 输入 ¥30.00, 输出 ¥60.00
- `gpt-3.5-turbo`: 输入 ¥0.50, 输出 ¥1.50

### 智谱 GLM 模型
- `glm-4`: 输入 ¥0.10, 输出 ¥0.10
- `glm-4-flash`: 输入 ¥0.01, 输出 ¥0.01
- `glm-4v`: 输入 ¥0.10, 输出 ¥0.10

### 阿里 Qwen 模型
- `qwen2.5`: 输入 ¥0.04, 输出 ¥0.04
- `qwen2.5-coder`: 输入 ¥0.02, 输出 ¥0.02
- `qwenvl`: 输入 ¥0.08, 输出 ¥0.08

### Ollama 本地模型
- 所有本地模型: 免费 (¥0.00)

## 配额管理

配额管理支持:

- **用户级配额**: 限制单个用户的月度使用
- **项目级配额**: 限制单个项目的月度使用
- **Token 配额**: 限制 token 使用量
- **成本配额**: 限制成本支出

告警级别:

- **Warning (90%)**: 使用量达到配额的 90%
- **Critical (100%)**: 使用量超过配额

## 统计维度

支持多维度统计:

- **按用户**: 查看用户的总使用情况
- **按项目**: 查看项目的总使用情况
- **按提供商**: 对比不同 AI 提供商的使用
- **按模型**: 对比不同模型的使用
- **按时间**: 查看特定时间范围的使用

## 缓存统计

缓存统计功能:

- 记录缓存命中次数
- 计算缓存命中率
- 缓存命中不计入成本
- 支持按时间范围统计

## 数据模型

```typescript
interface UsageRecord {
  userId: string
  projectId?: string
  provider: AIProvider
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  timestamp: Date
}

interface UsageStatistics {
  totalCalls: number
  totalTokens: number
  totalCost: number
  byProvider: Record<string, { calls: number; tokens: number; cost: number }>
  byModel: Record<string, { calls: number; tokens: number; cost: number }>
}

interface QuotaConfig {
  userId?: string
  projectId?: string
  monthlyTokenLimit: number
  monthlyCostLimit: number // 以分为单位
}
```

## 成本计算

成本计算公式:

```
总成本 = (输入 tokens / 1,000,000) × 输入价格 + (输出 tokens / 1,000,000) × 输出价格
```

成本单位:
- 数据库存储: 分 (1 元 = 100 分)
- API 返回: 元 (需要除以 100)

## 错误处理

所有方法在失败时抛出 `ErrorFactory.ai.inferenceFailed()` 错误,包含详细的错误信息。

## 依赖

- `@juanie/core/database` - 数据库访问
- `@juanie/types` - 类型定义和错误工厂
- `drizzle-orm` - ORM 查询构建器

## 相关服务

- `AIService` - 核心 AI 服务 (调用此服务记录使用)
- `AICacheService` - AI 响应缓存 (调用此服务记录缓存命中)
