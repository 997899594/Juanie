# Task 6: 使用统计和成本追踪 - 完成总结

## 任务概述

实现 AI 使用的统计、成本计算、配额管理和告警功能。

## 完成的工作

### 6.1 创建使用统计服务 ✅

**文件**: `packages/services/extensions/src/ai/usage/usage-tracking.service.ts`

**实现的功能**:

1. **使用记录**:
   - `record()` - 记录 AI 调用的 token 使用量和成本
   - `recordCacheHit()` - 记录缓存命中

2. **成本计算**:
   - `calculateCost()` - 基于模型定价自动计算成本
   - 内置主流模型定价配置 (Claude, GPT, GLM, Qwen, Ollama)
   - 支持输入和输出 token 的差异化定价

3. **统计聚合**:
   - `getStatistics()` - 多维度统计聚合
   - 支持按用户、项目、时间范围筛选
   - 按提供商和模型分组统计

4. **配额管理**:
   - `checkQuota()` - 检查配额使用情况
   - 支持 token 配额和成本配额
   - 计算使用百分比

5. **告警触发**:
   - `checkAndAlert()` - 检查并触发告警
   - 90% 使用量触发 Warning 级别告警
   - 100% 使用量触发 Critical 级别告警

6. **缓存统计**:
   - `getCacheHitRate()` - 计算缓存命中率
   - 支持按时间范围统计

**技术实现**:
- 使用 Drizzle ORM 访问数据库
- 使用 `@Inject(DATABASE)` 依赖注入
- 统一错误处理使用 `ErrorFactory.ai.inferenceFailed()`
- 成本以分为单位存储 (1 元 = 100 分)
- 支持多维度查询和聚合

**模型定价配置**:

内置了主流模型的定价 (每 1M tokens,单位:分):

- **Claude**: claude-3-5-sonnet (输入 ¥3.00, 输出 ¥15.00)
- **OpenAI**: gpt-4-turbo (输入 ¥10.00, 输出 ¥30.00)
- **智谱 GLM**: glm-4 (输入 ¥0.10, 输出 ¥0.10)
- **阿里 Qwen**: qwen2.5-coder (输入 ¥0.02, 输出 ¥0.02)
- **Ollama**: 所有本地模型免费 (¥0.00)

### 6.2 导出和注册 ✅

**文件**: 
- `packages/services/extensions/src/ai/usage/index.ts` - 导出服务
- `packages/services/extensions/src/ai/ai/ai.module.ts` - 注册到 NestJS 模块
- `packages/services/extensions/src/ai/ai/index.ts` - 导出到包级别

### 6.3 文档 ✅

**文件**: `packages/services/extensions/src/ai/usage/README.md`

**包含内容**:
- 功能概述
- 使用示例 (记录、统计、配额、告警、缓存)
- 模型定价表
- 配额管理说明
- 统计维度说明
- 缓存统计说明
- 数据模型定义
- 成本计算公式
- 错误处理说明
- 依赖列表
- 相关服务链接

## 验收标准检查

根据 `requirements.md` 中的需求 5:

- ✅ **5.1**: 记录每次 AI 调用的 token 使用量
  - 实现 `record()` 方法
  - 记录 promptTokens, completionTokens, totalTokens

- ✅ **5.2**: 计算每次调用的成本
  - 实现 `calculateCost()` 方法
  - 基于模型定价自动计算
  - 支持输入和输出 token 差异化定价

- ✅ **5.3**: 提供按用户、项目、模型的统计报表
  - 实现 `getStatistics()` 方法
  - 支持多维度筛选和聚合
  - 返回 byProvider 和 byModel 分组统计

- ✅ **5.4**: 支持设置月度使用配额
  - 实现 `checkQuota()` 方法
  - 支持 token 配额和成本配额
  - 自动计算当月使用情况

- ✅ **5.5**: 使用量超过配额 90% 时发送告警
  - 实现 `checkAndAlert()` 方法
  - 90% 触发 Warning 级别
  - 100% 触发 Critical 级别

## 技术亮点

1. **精确的成本计算**: 基于实际模型定价,支持输入输出差异化定价
2. **多维度统计**: 支持按用户、项目、提供商、模型、时间范围统计
3. **灵活的配额管理**: 支持 token 和成本双重配额限制
4. **智能告警**: 分级告警机制 (Warning/Critical)
5. **缓存统计**: 独立统计缓存命中,不计入成本
6. **类型安全**: 使用 TypeScript 严格模式
7. **依赖注入**: 使用 NestJS DI 系统
8. **错误处理**: 统一使用 `ErrorFactory.ai.inferenceFailed()`

## 数据库 Schema

使用现有的 `aiUsage` 表:

```sql
CREATE TABLE "ai_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "prompt_tokens" integer NOT NULL,
  "completion_tokens" integer NOT NULL,
  "total_tokens" integer NOT NULL,
  "cost" integer NOT NULL,
  "cached" boolean NOT NULL DEFAULT false,
  "timestamp" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "ai_usage_user_idx" ON "ai_usage"("user_id");
CREATE INDEX "ai_usage_project_idx" ON "ai_usage"("project_id");
CREATE INDEX "ai_usage_timestamp_idx" ON "ai_usage"("timestamp");
CREATE INDEX "ai_usage_provider_model_idx" ON "ai_usage"("provider", "model");
```

## 使用示例

```typescript
// 记录使用
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

// 获取统计
const stats = await usageTracking.getStatistics({
  userId: 'user-123',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
})

// 检查配额
const quotaStatus = await usageTracking.checkQuota({
  userId: 'user-123',
  monthlyTokenLimit: 1_000_000,
  monthlyCostLimit: 10000,
})

// 检查告警
const alert = await usageTracking.checkAndAlert({
  userId: 'user-123',
  monthlyTokenLimit: 1_000_000,
  monthlyCostLimit: 10000,
})

if (alert.shouldAlert) {
  console.log(`[${alert.level}] ${alert.message}`)
}

// 获取缓存命中率
const hitRate = await usageTracking.getCacheHitRate({
  userId: 'user-123',
})
```

## 统计数据示例

```typescript
{
  totalCalls: 100,
  totalTokens: 150000,
  totalCost: 4500, // 45.00 元
  byProvider: {
    anthropic: { calls: 50, tokens: 75000, cost: 2250 },
    openai: { calls: 50, tokens: 75000, cost: 2250 },
  },
  byModel: {
    'claude-3-5-sonnet-20241022': { calls: 50, tokens: 75000, cost: 2250 },
    'gpt-4-turbo': { calls: 50, tokens: 75000, cost: 2250 },
  },
}
```

## 配额检查示例

```typescript
{
  exceeded: false,
  usage: { tokens: 150000, cost: 4500 },
  limits: { tokens: 1000000, cost: 10000 },
  percentage: { tokens: 15, cost: 45 },
}
```

## 告警示例

```typescript
// Warning 级别 (90%)
{
  shouldAlert: true,
  level: 'warning',
  message: 'AI 使用配额即将超限! Tokens: 92.5%, 成本: 91.0%',
}

// Critical 级别 (100%)
{
  shouldAlert: true,
  level: 'critical',
  message: 'AI 使用配额已超限! Tokens: 1050000/1000000, 成本: ¥105.00/¥100.00',
}
```

## 下一步

Task 6 已完成。根据任务列表,下一个任务是 **Task 7: 实现 AI 响应缓存**。

## 相关文件

- `packages/services/extensions/src/ai/usage/usage-tracking.service.ts`
- `packages/services/extensions/src/ai/usage/index.ts`
- `packages/services/extensions/src/ai/usage/README.md`
- `packages/services/extensions/src/ai/ai/ai.module.ts`
- `packages/services/extensions/src/ai/ai/index.ts`
- `packages/core/src/database/schemas/ai-usage.schema.ts`
