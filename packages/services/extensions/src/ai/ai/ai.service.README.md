# 核心 AI 服务 (AI Service)

## 概述

`AIService` 是核心 AI 服务,整合了所有子服务,提供统一的 AI 调用接口。

## 功能

### 1. 统一 AI 接口

- 支持多个 AI 提供商 (Claude, GPT, GLM, Qwen, Ollama)
- 统一的调用接口,无需关心底层实现
- 自动适配器选择

### 2. 响应缓存

- 自动缓存 AI 响应,降低成本和延迟
- 基于请求参数生成缓存键
- 支持缓存命中率统计

### 3. 使用统计

- 自动记录每次 AI 调用
- 追踪 token 使用量和成本
- 支持配额管理和告警

### 4. 内容安全

- 自动过滤敏感信息
- 记录审计日志
- 支持自定义过滤规则

### 5. 错误处理

- 自动重试 (指数退避)
- 统一错误处理
- 详细错误日志

## 使用方法

### 基本用法

```typescript
import { AIService } from '@juanie/service-extensions'
import type { AIClientConfig, AICompletionOptions } from '@juanie/types'

// 注入服务
constructor(private aiService: AIService) {}

// 同步调用
async generateText() {
  const config: AIClientConfig = {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 1000,
  }

  const options: AICompletionOptions = {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is TypeScript?' },
    ],
  }

  const context = {
    userId: 'user-123',
    projectId: 'project-456',
  }

  const result = await this.aiService.complete(config, options, context)
  console.log(result.content)
  console.log('Tokens used:', result.usage.totalTokens)
}
```

### 流式调用

```typescript
async streamText() {
  const config: AIClientConfig = {
    provider: 'openai',
    model: 'gpt-4-turbo',
  }

  const options: AICompletionOptions = {
    messages: [
      { role: 'user', content: 'Write a short story about AI.' },
    ],
  }

  const context = {
    userId: 'user-123',
  }

  // 流式生成
  for await (const chunk of this.aiService.streamComplete(config, options, context)) {
    process.stdout.write(chunk)
  }
}
```

### 配额管理

```typescript
// 检查配额
const quotaStatus = await this.aiService.checkQuota('user-123', 1000000)
console.log('Used:', quotaStatus.used)
console.log('Remaining:', quotaStatus.remaining)
console.log('Percentage:', quotaStatus.percentage)

// 检查并触发告警
await this.aiService.checkAndAlert('user-123', 1000000)
// 如果使用量超过 90%,会触发告警
```

### 缓存管理

```typescript
// 获取缓存统计
const stats = await this.aiService.getCacheStats()
console.log('Hit rate:', stats.hitRate)
console.log('Total hits:', stats.hits)
console.log('Total misses:', stats.misses)

// 清除所有缓存
await this.aiService.clearCache()

// 清除特定提供商的缓存
await this.aiService.clearCache('anthropic')
```

## 集成示例

### 在 tRPC 路由中使用

```typescript
import { z } from 'zod'
import { publicProcedure, router } from '../trpc/trpc.service'
import { AIService } from '@juanie/service-extensions'

export const aiRouter = router({
  complete: publicProcedure
    .input(
      z.object({
        provider: z.enum(['anthropic', 'openai', 'zhipu', 'qwen', 'ollama']),
        model: z.string(),
        messages: z.array(
          z.object({
            role: z.enum(['system', 'user', 'assistant']),
            content: z.string(),
          })
        ),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const aiService = ctx.container.get(AIService)

      const config = {
        provider: input.provider,
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      }

      const options = {
        messages: input.messages,
      }

      const context = {
        userId: ctx.user.id,
        projectId: ctx.projectId,
      }

      return await aiService.complete(config, options, context)
    }),

  streamComplete: publicProcedure
    .input(
      z.object({
        provider: z.enum(['anthropic', 'openai', 'zhipu', 'qwen', 'ollama']),
        model: z.string(),
        messages: z.array(
          z.object({
            role: z.enum(['system', 'user', 'assistant']),
            content: z.string(),
          })
        ),
      })
    )
    .subscription(async function* ({ input, ctx }) {
      const aiService = ctx.container.get(AIService)

      const config = {
        provider: input.provider,
        model: input.model,
      }

      const options = {
        messages: input.messages,
      }

      const context = {
        userId: ctx.user.id,
      }

      for await (const chunk of aiService.streamComplete(config, options, context)) {
        yield { chunk }
      }
    }),
})
```

### 在 NestJS 控制器中使用

```typescript
import { Controller, Post, Body } from '@nestjs/common'
import { AIService } from '@juanie/service-extensions'

@Controller('ai')
export class AIController {
  constructor(private aiService: AIService) {}

  @Post('complete')
  async complete(@Body() body: any) {
    const config = {
      provider: body.provider,
      model: body.model,
    }

    const options = {
      messages: body.messages,
    }

    const context = {
      userId: body.userId,
      projectId: body.projectId,
    }

    return await this.aiService.complete(config, options, context)
  }
}
```

## 工作流程

### 同步调用流程

```
1. 安全过滤 (ContentFilterService)
   ↓
2. 检查缓存 (AICacheService)
   ↓ (缓存未命中)
3. 调用 AI (AIClientFactory)
   ↓
4. 缓存结果 (AICacheService)
   ↓
5. 记录使用统计 (UsageTrackingService)
   ↓
6. 记录审计日志 (ContentFilterService)
   ↓
7. 返回结果
```

### 流式调用流程

```
1. 安全过滤 (ContentFilterService)
   ↓
2. 流式调用 AI (AIClientFactory)
   ↓
3. 逐块返回 (yield)
   ↓
4. 记录使用统计 (UsageTrackingService)
   ↓
5. 记录审计日志 (ContentFilterService)
```

## 错误处理

### 自动重试

服务会自动重试失败的请求 (最多 3 次),使用指数退避策略:

- 第 1 次重试: 延迟 1 秒
- 第 2 次重试: 延迟 2 秒
- 第 3 次重试: 延迟 4 秒

### 不重试的错误

以下错误不会重试:

- 配额超限错误
- 内容过滤错误
- 敏感信息阻止错误

### 错误示例

```typescript
try {
  const result = await this.aiService.complete(config, options, context)
} catch (error) {
  if (error.message.includes('quota')) {
    // 处理配额超限
    console.error('Quota exceeded')
  } else if (error.message.includes('filtered')) {
    // 处理内容过滤
    console.error('Content filtered')
  } else {
    // 其他错误
    console.error('AI call failed:', error.message)
  }
}
```

## 性能优化

### 缓存策略

- 同步调用自动使用缓存
- 流式调用不使用缓存 (需要实时返回)
- 缓存 TTL: 24 小时
- 缓存键基于: provider + model + messages + temperature + maxTokens

### Token 估算

流式调用中,token 使用量通过字符数粗略估算:

```
tokens ≈ characters / 4
```

这是一个近似值,实际 token 数量可能有所不同。

## 配置

### 环境变量

```bash
# AI Provider API Keys
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
ZHIPU_API_KEY=xxx
QWEN_API_KEY=xxx

# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# Redis (缓存)
REDIS_URL=redis://localhost:6379

# 配额设置
AI_DEFAULT_MONTHLY_QUOTA=1000000  # tokens
AI_QUOTA_WARNING_THRESHOLD=0.9   # 90%

# 缓存设置
AI_CACHE_TTL=86400  # 24 hours

# 重试设置
AI_MAX_RETRIES=3
AI_RETRY_BASE_DELAY=1000  # ms
```

## 监控和可观测性

### 关键指标

- `ai.requests.total` - AI 请求总数
- `ai.requests.duration` - 请求延迟
- `ai.tokens.total` - Token 使用总量
- `ai.cache.hit_rate` - 缓存命中率
- `ai.errors.total` - 错误总数

### 日志

服务会记录以下日志:

- AI 请求开始
- AI 请求成功/失败
- 缓存命中/未命中
- 配额告警
- 敏感信息检测

## 最佳实践

1. **始终提供上下文**: 传递 `userId` 和 `projectId` 以便追踪和统计
2. **合理设置参数**: 根据任务选择合适的 `temperature` 和 `maxTokens`
3. **使用流式调用**: 对于长文本生成,使用流式调用提供更好的用户体验
4. **监控配额**: 定期检查配额使用情况,避免超限
5. **清理缓存**: 定期清理过期或不需要的缓存

## 相关文档

- [AI 客户端工厂](./ai-client-factory.ts)
- [缓存服务](../cache/README.md)
- [使用统计服务](../usage/README.md)
- [内容过滤服务](../security/README.md)
- [AI 模块架构](./README.md)
