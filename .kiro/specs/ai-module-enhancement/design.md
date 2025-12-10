# AI 模块增强 - 设计文档

## 概述

本设计文档描述了 AI DevOps 平台中 AI 模块的增强方案。基于现有的 AI 基础设施（位于 `packages/services/extensions/src/ai/`），我们将扩展支持多模型、RAG、提示词管理等核心功能。

**设计原则**:
- 使用适配器模式实现多模型支持
- 利用现有的三层服务架构（Foundation/Business/Extensions）
- 优先使用成熟的开源库和工具
- 保持类型安全和端到端类型推导
- 遵循项目的错误处理和可观测性标准

**技术栈**:
- 后端: NestJS + TypeScript
- 数据库: PostgreSQL + Drizzle ORM
- 缓存: Redis (ioredis)
- 向量数据库: Qdrant
- AI SDK: Vercel AI SDK (统一接口)
- 流式传输: Server-Sent Events (SSE)
- 测试: Vitest + fast-check (PBT)

## 架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        API Gateway (tRPC)                    │
│                    apps/api-gateway/src/routers/             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│              Extensions Layer (AI Services)                  │
│           packages/services/extensions/src/ai/               │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ AI Service   │  │ RAG Service  │  │ Prompt Mgmt  │      │
│  │              │  │              │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│  ┌──────┴──────────────────┴──────────────────┴───────┐    │
│  │           AI Client Factory (Adapter Pattern)       │    │
│  │                                                      │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │    │
│  │  │ Claude  │ │  GPT-4  │ │  GLM-4  │ │ Qwen2.5 │  │    │
│  │  │ Adapter │ │ Adapter │ │ Adapter │ │ Adapter │  │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │    │
│  │  ┌─────────┐                                        │    │
│  │  │ Ollama  │                                        │    │
│  │  │ Adapter │                                        │    │
│  │  └─────────┘                                        │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                    Core Infrastructure                       │
│                    packages/core/src/                        │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Database    │  │    Redis     │  │   Qdrant     │      │
│  │  (Drizzle)   │  │   (Cache)    │  │  (Vectors)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────────────────────────────────────┘
```

### 服务层次

按照项目的三层架构:

1. **Extensions Layer** (`packages/services/extensions/src/ai/`)
   - `ai/ai.service.ts` - 核心 AI 服务
   - `ai/ai-client-factory.ts` - 客户端工厂
   - `ai/adapters/` - 各模型适配器
   - `rag/rag.service.ts` - RAG 服务
   - `prompts/prompt.service.ts` - 提示词管理
   - `conversations/conversation.service.ts` - 对话历史
   - `usage/usage-tracking.service.ts` - 使用统计
   - `cache/ai-cache.service.ts` - 响应缓存
   - `security/content-filter.service.ts` - 安全过滤

2. **Core Layer** (`packages/core/src/`)
   - `database/schemas/` - 数据库 Schema
   - `events/` - 事件定义
   - `utils/` - 工具函数

3. **API Gateway** (`apps/api-gateway/src/routers/`)
   - `ai.router.ts` - AI 相关路由
   - `ai-code-review.router.ts` - 代码审查路由

## 组件和接口

### 1. 统一 AI 客户端接口

基于现有的 `packages/types/src/ai.types.ts`,扩展支持多模型提供商。

```typescript
// packages/types/src/ai.types.ts (扩展现有类型)

/**
 * AI 提供商类型
 */
export type AIProvider = 'anthropic' | 'openai' | 'zhipu' | 'qwen' | 'ollama'

/**
 * 扩展 AIModel 类型以支持更多模型
 */
export type AIModel =
  | 'qwen2.5-coder:7b'
  | 'deepseek-coder:6.7b'
  | 'codellama:7b'
  | 'mistral:7b'
  | 'llama3.1:8b'
  // Claude 模型
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  // OpenAI 模型
  | 'gpt-4-turbo'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  // 智谱 GLM 模型
  | 'glm-4'
  | 'glm-4-flash'
  | 'glm-4v'
  // 阿里 Qwen 模型
  | 'qwen2.5'
  | 'qwen2.5-coder'
  | 'qwenvl'

/**
 * AI 客户端配置
 */
export interface AIClientConfig {
  provider: AIProvider
  model: AIModel
  apiKey?: string
  baseURL?: string
  temperature?: number
  maxTokens?: number
}

/**
 * AI 消息
 */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string
  name?: string
  functionCall?: {
    name: string
    arguments: string
  }
}

/**
 * AI 完成选项
 */
export interface AICompletionOptions {
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  functions?: AIFunction[]
  stopSequences?: string[]
}

/**
 * AI 完成结果
 */
export interface AICompletionResult {
  content: string
  finishReason: 'stop' | 'length' | 'function_call' | 'content_filter'
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  functionCall?: {
    name: string
    arguments: Record<string, unknown>
  }
}

/**
 * AI 函数定义
 */
export interface AIFunction {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema
}
```

```typescript
// packages/services/extensions/src/ai/ai/ai-client.interface.ts

import type { AIClientConfig, AICompletionOptions, AICompletionResult } from '@juanie/types'

export interface IAIClient {
  complete(options: AICompletionOptions): Promise<AICompletionResult>
  streamComplete(options: AICompletionOptions): AsyncIterable<string>
}
```

### 2. AI 客户端工厂

```typescript
// packages/services/extensions/src/ai/ai/ai-client-factory.ts

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { createOpenAI } from '@ai-sdk/openai'
import { createOllama } from 'ollama-ai-provider'
import type { IAIClient } from './ai-client.interface'
import type { AIClientConfig } from '@juanie/types'
import { ClaudeAdapter } from './adapters/claude.adapter'
import { OpenAIAdapter } from './adapters/openai.adapter'
import { ZhipuAdapter } from './adapters/zhipu.adapter'
import { QwenAdapter } from './adapters/qwen.adapter'
import { OllamaAdapter } from './adapters/ollama.adapter'

@Injectable()
export class AIClientFactory {
  constructor(private configService: ConfigService) {}

  createClient(config: AIClientConfig): IAIClient {
    // 从环境变量获取 API 密钥
    const apiKey = config.apiKey || this.getApiKey(config.provider)

    switch (config.provider) {
      case 'anthropic':
        return new ClaudeAdapter({ ...config, apiKey })
      case 'openai':
        return new OpenAIAdapter({ ...config, apiKey })
      case 'zhipu':
        return new ZhipuAdapter({ ...config, apiKey })
      case 'qwen':
        return new QwenAdapter({ ...config, apiKey })
      case 'ollama':
        return new OllamaAdapter(config, this.configService)
      default:
        throw new Error(`Unsupported provider: ${config.provider}`)
    }
  }

  private getApiKey(provider: string): string | undefined {
    const keyMap: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      zhipu: 'ZHIPU_API_KEY',
      qwen: 'QWEN_API_KEY',
    }

    const envKey = keyMap[provider]
    return envKey ? this.configService.get<string>(envKey) : undefined
  }
}
```

### 3. 模型适配器

每个适配器实现 `IAIClient` 接口:

```typescript
// packages/services/extensions/src/ai/ai/adapters/claude.adapter.ts

import { anthropic } from '@ai-sdk/anthropic'
import { generateText, streamText } from 'ai'
import type { IAIClient, AIClientConfig, AICompletionOptions, AICompletionResult } from '../ai-client.interface'

export class ClaudeAdapter implements IAIClient {
  private model: ReturnType<typeof anthropic>

  constructor(private config: AIClientConfig) {
    this.model = anthropic(config.model, {
      apiKey: config.apiKey,
    })
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const result = await generateText({
      model: this.model,
      messages: options.messages,
      temperature: options.temperature ?? this.config.temperature,
      maxTokens: options.maxTokens ?? this.config.maxTokens,
      tools: options.functions ? this.convertFunctionsToTools(options.functions) : undefined,
    })

    return {
      content: result.text,
      finishReason: result.finishReason,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
      functionCall: result.toolCalls?.[0] ? {
        name: result.toolCalls[0].toolName,
        arguments: result.toolCalls[0].args,
      } : undefined,
    }
  }

  async *streamComplete(options: AICompletionOptions): AsyncIterable<string> {
    const result = await streamText({
      model: this.model,
      messages: options.messages,
      temperature: options.temperature ?? this.config.temperature,
      maxTokens: options.maxTokens ?? this.config.maxTokens,
    })

    for await (const chunk of result.textStream) {
      yield chunk
    }
  }

  getModel() {
    return this.model
  }

  private convertFunctionsToTools(functions: AIFunction[]) {
    // Convert OpenAI-style functions to Vercel AI SDK tools
    return Object.fromEntries(
      functions.map(fn => [
        fn.name,
        {
          description: fn.description,
          parameters: fn.parameters,
        },
      ])
    )
  }
}
```

类似的适配器用于:
- `OpenAIAdapter` - GPT-4, GPT-3.5
- `ZhipuAdapter` - GLM-4, GLM-4-Flash, GLM-4V
- `QwenAdapter` - Qwen2.5, Qwen2.5-Coder, QwenVL
- `OllamaAdapter` - 本地模型(复用现有的 `packages/services/extensions/src/ai/ollama.client.ts`)

```typescript
// packages/services/extensions/src/ai/ai/adapters/ollama.adapter.ts

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OllamaClient } from '../../ollama.client'
import type { IAIClient } from '../ai-client.interface'
import type { AIClientConfig, AICompletionOptions, AICompletionResult } from '@juanie/types'

export class OllamaAdapter implements IAIClient {
  private ollamaClient: OllamaClient

  constructor(
    private config: AIClientConfig,
    configService: ConfigService
  ) {
    this.ollamaClient = new OllamaClient(configService)
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const systemMessage = options.messages.find(m => m.role === 'system')
    const userMessages = options.messages.filter(m => m.role === 'user')
    const prompt = userMessages.map(m => m.content).join('\n\n')

    const response = await this.ollamaClient.generate({
      model: this.config.model,
      prompt,
      system: systemMessage?.content,
      temperature: options.temperature ?? this.config.temperature,
      maxTokens: options.maxTokens ?? this.config.maxTokens,
    })

    return {
      content: response,
      finishReason: 'stop',
      usage: {
        promptTokens: 0, // Ollama 不提供详细的 token 统计
        completionTokens: 0,
        totalTokens: 0,
      },
    }
  }

  async *streamComplete(options: AICompletionOptions): AsyncIterable<string> {
    const systemMessage = options.messages.find(m => m.role === 'system')
    const userMessages = options.messages.filter(m => m.role === 'user')
    const prompt = userMessages.map(m => m.content).join('\n\n')

    for await (const chunk of this.ollamaClient.generateStream({
      model: this.config.model,
      prompt,
      system: systemMessage?.content,
      temperature: options.temperature ?? this.config.temperature,
      maxTokens: options.maxTokens ?? this.config.maxTokens,
    })) {
      yield chunk
    }
  }
}
```

### 4. 核心 AI 服务

```typescript
// packages/services/extensions/src/ai/ai/ai.service.ts

import { Injectable, Inject } from '@nestjs/common'
import { REDIS } from '@juanie/core/tokens'
import type { Redis } from 'ioredis'
import { AIClientFactory } from './ai-client-factory'
import { AICacheService } from '../cache/ai-cache.service'
import { UsageTrackingService } from '../usage/usage-tracking.service'
import { ContentFilterService } from '../security/content-filter.service'
import type { AIClientConfig, AICompletionOptions, AICompletionResult } from './ai-client.interface'

@Injectable()
export class AIService {
  constructor(
    private clientFactory: AIClientFactory,
    private cacheService: AICacheService,
    private usageTracking: UsageTrackingService,
    private contentFilter: ContentFilterService,
    @Inject(REDIS) private redis: Redis,
  ) {}

  async complete(
    config: AIClientConfig,
    options: AICompletionOptions,
    context?: { userId: string; projectId?: string }
  ): Promise<AICompletionResult> {
    // 1. 安全过滤
    await this.contentFilter.filterMessages(options.messages)

    // 2. 检查缓存
    const cacheKey = this.cacheService.generateKey(config, options)
    const cached = await this.cacheService.get(cacheKey)
    if (cached) {
      await this.usageTracking.recordCacheHit(context)
      return cached
    }

    // 3. 调用 AI
    const client = this.clientFactory.createClient(config)
    const result = await client.complete(options)

    // 4. 缓存结果
    await this.cacheService.set(cacheKey, result)

    // 5. 记录使用统计
    await this.usageTracking.record({
      userId: context?.userId,
      projectId: context?.projectId,
      provider: config.provider,
      model: config.model,
      usage: result.usage,
      timestamp: new Date(),
    })

    return result
  }

  async *streamComplete(
    config: AIClientConfig,
    options: AICompletionOptions,
    context?: { userId: string; projectId?: string }
  ): AsyncIterable<string> {
    // 安全过滤
    await this.contentFilter.filterMessages(options.messages)

    const client = this.clientFactory.createClient(config)
    let totalTokens = 0

    for await (const chunk of client.streamComplete(options)) {
      totalTokens += chunk.length // 粗略估算
      yield chunk
    }

    // 记录使用统计
    await this.usageTracking.record({
      userId: context?.userId,
      projectId: context?.projectId,
      provider: config.provider,
      model: config.model,
      usage: {
        promptTokens: 0, // 流式模式下无法准确获取
        completionTokens: totalTokens,
        totalTokens,
      },
      timestamp: new Date(),
    })
  }
}
```

### 5. RAG 服务

```typescript
// packages/services/extensions/src/ai/rag/rag.service.ts

import { Injectable } from '@nestjs/common'
import { QdrantClient } from '@qdrant/js-client-rest'
import { AIService } from '../ai/ai.service'

export interface Document {
  id: string
  content: string
  metadata: {
    projectId: string
    type: 'code' | 'doc' | 'config'
    path: string
    language?: string
  }
}

export interface SearchResult {
  document: Document
  score: number
}

@Injectable()
export class RAGService {
  private qdrant: QdrantClient

  constructor(private aiService: AIService) {
    this.qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    })
  }

  async embedDocument(document: Document): Promise<void> {
    // 使用嵌入模型生成向量
    const embedding = await this.generateEmbedding(document.content)

    await this.qdrant.upsert(document.metadata.projectId, {
      wait: true,
      points: [
        {
          id: document.id,
          vector: embedding,
          payload: {
            content: document.content,
            ...document.metadata,
          },
        },
      ],
    })
  }

  async search(query: string, projectId: string, limit = 5): Promise<SearchResult[]> {
    const queryEmbedding = await this.generateEmbedding(query)

    const results = await this.qdrant.search(projectId, {
      vector: queryEmbedding,
      limit,
      with_payload: true,
    })

    return results.map(result => ({
      document: {
        id: result.id as string,
        content: result.payload?.content as string,
        metadata: {
          projectId: result.payload?.projectId as string,
          type: result.payload?.type as 'code' | 'doc' | 'config',
          path: result.payload?.path as string,
          language: result.payload?.language as string | undefined,
        },
      },
      score: result.score,
    }))
  }

  async enhancePrompt(query: string, projectId: string): Promise<string> {
    const relevantDocs = await this.search(query, projectId, 3)

    if (relevantDocs.length === 0) {
      return query
    }

    const context = relevantDocs
      .map(doc => `[${doc.document.metadata.path}]\n${doc.document.content}`)
      .join('\n\n---\n\n')

    return `基于以下项目上下文回答问题:\n\n${context}\n\n问题: ${query}`
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // 使用 OpenAI text-embedding-3-small 或其他嵌入模型
    // 这里简化处理,实际应该调用嵌入 API
    return [] // 返回向量
  }
}
```

### 6. 提示词模板管理

```typescript
// packages/services/extensions/src/ai/prompts/prompt.service.ts

import { Injectable, Inject } from '@nestjs/common'
import { eq, and } from 'drizzle-orm'
import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/core/database'
import type { Database } from '@juanie/core/database'

export interface PromptTemplate {
  id: string
  name: string
  category: 'code-review' | 'config-gen' | 'troubleshooting' | 'general'
  template: string
  variables: string[]
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class PromptService {
  constructor(@Inject(DATABASE) private db: Database) {}

  async create(data: Omit<PromptTemplate, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<PromptTemplate> {
    const [template] = await this.db
      .insert(schema.promptTemplates)
      .values({
        ...data,
        usageCount: 0,
      })
      .returning()

    return template as PromptTemplate
  }

  async findById(id: string): Promise<PromptTemplate | null> {
    const [template] = await this.db
      .select()
      .from(schema.promptTemplates)
      .where(eq(schema.promptTemplates.id, id))

    return template as PromptTemplate | null
  }

  async findByCategory(category: PromptTemplate['category']): Promise<PromptTemplate[]> {
    const templates = await this.db
      .select()
      .from(schema.promptTemplates)
      .where(eq(schema.promptTemplates.category, category))

    return templates as PromptTemplate[]
  }

  async render(templateId: string, variables: Record<string, string>): Promise<string> {
    const template = await this.findById(templateId)
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }

    // 增加使用次数
    await this.db
      .update(schema.promptTemplates)
      .set({ usageCount: template.usageCount + 1 })
      .where(eq(schema.promptTemplates.id, templateId))

    // 替换变量
    let rendered = template.template
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }

    return rendered
  }

  async update(id: string, data: Partial<PromptTemplate>): Promise<PromptTemplate> {
    const [updated] = await this.db
      .update(schema.promptTemplates)
      .set(data)
      .where(eq(schema.promptTemplates.id, id))
      .returning()

    return updated as PromptTemplate
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(schema.promptTemplates)
      .where(eq(schema.promptTemplates.id, id))
  }
}
```

## 数据模型

### Database Schema

基于现有的 `packages/core/src/database/schemas/ai-assistants.schema.ts`,新增以下 schema:

```typescript
// packages/core/src/database/schemas/ai-prompt-templates.schema.ts

import { pgTable, text, uuid, integer, timestamp, jsonb, index, boolean } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.schema'

export const promptTemplates = pgTable(
  'prompt_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    name: text('name').notNull(),
    category: text('category').notNull(), // 'code-review', 'config-gen', 'troubleshooting', 'general'
    template: text('template').notNull(),
    variables: jsonb('variables').$type<string[]>().notNull().default([]),
    usageCount: integer('usage_count').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('prompt_templates_org_idx').on(table.organizationId),
    index('prompt_templates_category_idx').on(table.category),
    index('prompt_templates_usage_idx').on(table.usageCount),
  ]
)

export type PromptTemplate = typeof promptTemplates.$inferSelect
export type NewPromptTemplate = typeof promptTemplates.$inferInsert

// packages/core/src/database/schemas/ai-conversations.schema.ts

import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './users.schema'
import { projects } from './projects.schema'
import type { AIMessage } from '@juanie/types'

export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    projectId: uuid('project_id').references(() => projects.id),
    title: text('title'),
    messages: jsonb('messages').$type<AIMessage[]>().notNull().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('ai_conversations_user_idx').on(table.userId),
    index('ai_conversations_project_idx').on(table.projectId),
    index('ai_conversations_created_idx').on(table.createdAt),
  ]
)

export type AIConversation = typeof aiConversations.$inferSelect
export type NewAIConversation = typeof aiConversations.$inferInsert

// packages/core/src/database/schemas/ai-usage.schema.ts

import { pgTable, uuid, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.schema'
import { projects } from './projects.schema'

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    projectId: uuid('project_id').references(() => projects.id),
    provider: text('provider').notNull(), // 'anthropic', 'openai', 'zhipu', 'qwen', 'ollama'
    model: text('model').notNull(),
    promptTokens: integer('prompt_tokens').notNull(),
    completionTokens: integer('completion_tokens').notNull(),
    totalTokens: integer('total_tokens').notNull(),
    cost: integer('cost').notNull(), // 以分为单位
    cached: boolean('cached').notNull().default(false),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
  },
  (table) => [
    index('ai_usage_user_idx').on(table.userId),
    index('ai_usage_project_idx').on(table.projectId),
    index('ai_usage_timestamp_idx').on(table.timestamp),
    index('ai_usage_provider_model_idx').on(table.provider, table.model),
  ]
)

export type AIUsage = typeof aiUsage.$inferSelect
export type NewAIUsage = typeof aiUsage.$inferInsert
```



### Schema 导出

需要在 `packages/core/src/database/schemas/index.ts` 中添加:

```typescript
export * from './ai-prompt-templates.schema'
export * from './ai-conversations.schema'
export * from './ai-usage.schema'
```

### 数据库迁移

创建迁移文件 `packages/core/drizzle/0004_add_ai_features.sql`:

```sql
-- 提示词模板表
CREATE TABLE IF NOT EXISTS "prompt_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "category" text NOT NULL,
  "template" text NOT NULL,
  "variables" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "usage_count" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "prompt_templates_org_idx" ON "prompt_templates"("organization_id");
CREATE INDEX "prompt_templates_category_idx" ON "prompt_templates"("category");
CREATE INDEX "prompt_templates_usage_idx" ON "prompt_templates"("usage_count");

-- AI 对话表
CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "title" text,
  "messages" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "ai_conversations_user_idx" ON "ai_conversations"("user_id");
CREATE INDEX "ai_conversations_project_idx" ON "ai_conversations"("project_id");
CREATE INDEX "ai_conversations_created_idx" ON "ai_conversations"("created_at");

-- AI 使用统计表
CREATE TABLE IF NOT EXISTS "ai_usage" (
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

## 正确性属性


*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

基于需求文档的验收标准,我们定义以下可测试的正确性属性:

### 核心 AI 客户端属性

Property 1: 适配器接口一致性
*For any* AI 客户端适配器,它应该实现 `IAIClient` 接口的所有方法(`complete`, `streamComplete`, `getModel`)
**Validates: Requirements 1.1, 1.8**

Property 2: 提供商适配器创建
*For any* 支持的提供商类型(anthropic, openai, zhipu, qwen, ollama),工厂应该能够创建对应的适配器实例
**Validates: Requirements 1.2**

### 提示词模板属性

Property 3: 模板 CRUD 一致性
*For any* 提示词模板,创建后应该能够查询到,更新后内容应该改变,删除后应该查询不到
**Validates: Requirements 2.1**

Property 4: 模板变量替换正确性
*For any* 模板和变量映射,渲染后的文本应该将所有 `{{variable}}` 占位符替换为对应的值
**Validates: Requirements 2.2**

Property 5: 模板分类查询正确性
*For any* 模板分类,按该分类查询应该只返回属于该分类的模板
**Validates: Requirements 2.3**

Property 6: 模板使用计数递增
*For any* 提示词模板,每次使用后 `usageCount` 应该增加 1
**Validates: Requirements 2.5**

### RAG 属性

Property 7: 文档嵌入和检索一致性
*For any* 文档,嵌入到向量数据库后应该能够通过语义搜索检索到
**Validates: Requirements 3.2, 3.3**

Property 8: RAG 提示词增强
*For any* 用户查询和项目 ID,如果存在相关文档,增强后的提示词应该包含检索到的文档内容
**Validates: Requirements 3.4**

Property 9: 项目向量数据隔离
*For any* 两个不同的项目 A 和 B,在项目 A 中搜索不应该返回项目 B 的文档
**Validates: Requirements 3.5**

### 对话历史属性

Property 10: 对话持久化和查询
*For any* 对话,保存后应该能够通过 ID 查询到,删除后应该查询不到
**Validates: Requirements 4.1, 4.4**

Property 11: 对话项目筛选正确性
*For any* 项目 ID,按该项目筛选对话应该只返回属于该项目的对话
**Validates: Requirements 4.2**

Property 12: 对话内容搜索正确性
*For any* 搜索关键词,搜索结果中的对话消息应该包含该关键词
**Validates: Requirements 4.3**

Property 13: 对话上下文长度限制
*For any* 对话,当消息数量超过 10 条时,系统应该只保留最近的 10 条消息作为上下文
**Validates: Requirements 4.5**

### 使用统计和成本属性

Property 14: AI 调用使用记录
*For any* AI 调用,完成后数据库中应该有对应的使用记录,包含 token 数量和成本
**Validates: Requirements 5.1, 5.2**

Property 15: 使用统计聚合正确性
*For any* 用户/项目/模型维度,统计数据应该等于该维度下所有使用记录的总和
**Validates: Requirements 5.3**

Property 16: 配额告警触发
*For any* 用户或项目,当使用量达到配额的 90% 时,应该触发告警
**Validates: Requirements 5.5**

### 流式响应属性

Property 17: 流式响应数据块传输
*For any* 流式 AI 调用,应该返回多个数据块,而不是一次性返回完整响应
**Validates: Requirements 6.1**

### 代码审查属性

Property 18: 审查结果包含严重级别
*For any* 代码审查结果,每个问题应该包含严重级别(critical, warning, info)
**Validates: Requirements 7.2**

Property 19: 审查结果包含修复建议
*For any* 代码审查结果,每个问题应该包含修复建议
**Validates: Requirements 7.3**

Property 20: 批量审查文件数量一致性
*For any* N 个文件的批量审查请求,应该返回 N 个审查结果
**Validates: Requirements 7.4**

Property 21: 审查摘要包含统计信息
*For any* 代码审查结果,摘要应该包含总分、问题数量和优点列表
**Validates: Requirements 7.5**

### 配置生成属性

Property 22: 配置生成包含优化建议
*For any* 配置生成请求,生成的配置应该包含优化建议部分
**Validates: Requirements 8.5**

### 故障诊断属性

Property 23: 诊断结果包含根因分析
*For any* 故障诊断请求,结果应该包含根因分析部分
**Validates: Requirements 9.3**

Property 24: 修复指南是分步的
*For any* 故障诊断结果,修复指南应该包含多个有序的步骤
**Validates: Requirements 9.4**

Property 25: 诊断结果包含时间估算
*For any* 故障诊断结果,应该包含修复时间估算
**Validates: Requirements 9.5**

### Function Calling 属性

Property 26: 函数注册和查询
*For any* 注册的函数,应该能够通过名称查询到其定义
**Validates: Requirements 10.1**

Property 27: 函数参数验证
*For any* 函数调用,如果参数不符合 schema 定义,应该被拒绝
**Validates: Requirements 10.4**

Property 28: 函数执行结果返回
*For any* 有效的函数调用,函数应该被执行,且结果应该返回给 AI
**Validates: Requirements 10.5**

### 多模态属性

Property 29: 图文混合输入处理
*For any* 包含图片和文本的输入,系统应该能够正确处理并传递给多模态模型
**Validates: Requirements 11.4**

### 缓存属性

Property 30: 缓存键一致性
*For any* 两次相同的 AI 请求(相同的配置和选项),应该生成相同的缓存键
**Validates: Requirements 12.2**

Property 31: 缓存清除有效性
*For any* 缓存项,手动清除后应该不再存在于缓存中
**Validates: Requirements 12.4**

Property 32: 缓存命中统计
*For any* 缓存命中,统计数据中的缓存命中次数应该增加
**Validates: Requirements 12.5**

### 安全属性

Property 33: 敏感信息过滤
*For any* 包含敏感信息(API 密钥、密码、邮箱)的输入,应该被过滤或拒绝
**Validates: Requirements 13.1**

Property 34: AI 交互审计日志
*For any* AI 交互,审计日志中应该有对应的记录
**Validates: Requirements 13.2**

Property 35: 模型禁用生效
*For any* 被禁用的模型或提供商,尝试使用时应该被拒绝
**Validates: Requirements 13.3**

Property 36: 内容过滤规则生效
*For any* 设置的内容过滤规则,匹配该规则的内容应该被过滤
**Validates: Requirements 13.4**

Property 37: 敏感信息检测告警
*For any* 检测到敏感信息的请求,应该被阻止并触发告警
**Validates: Requirements 13.5**

### 代码补全属性

Property 38: 补全响应时间限制
*For any* 代码补全请求,响应时间应该不超过 500ms
**Validates: Requirements 14.3**

Property 39: 补全选项数量范围
*For any* 代码补全请求,返回的补全选项数量应该在 3-5 个之间
**Validates: Requirements 14.4**

### Git 提交消息属性

Property 40: 提交消息符合 Conventional Commits
*For any* 生成的提交消息,应该符合 Conventional Commits 规范(格式: `<type>: <description>`)
**Validates: Requirements 15.2**

Property 41: 变更类型识别正确性
*For any* Git diff,生成的提交消息应该包含正确的变更类型(feat, fix, refactor, docs, style, test, chore)
**Validates: Requirements 15.3**

Property 42: 提交描述长度限制
*For any* 生成的提交消息,描述部分应该不超过 72 个字符
**Validates: Requirements 15.4**

Property 43: 提交正文包含详细信息
*For any* 生成的提交消息,如果有正文,应该包含变更的详细信息
**Validates: Requirements 15.5**

## 错误处理

### 错误类型

```typescript
// packages/services/extensions/src/ai/errors/ai-errors.ts

import { BusinessError } from '@juanie/core/errors'

export class AIProviderError extends BusinessError {
  constructor(provider: string, message: string, cause?: Error) {
    super(`AI Provider Error [${provider}]: ${message}`, 'AI_PROVIDER_ERROR', cause)
  }
}

export class AIQuotaExceededError extends BusinessError {
  constructor(userId: string, quota: number) {
    super(
      `User ${userId} has exceeded AI usage quota of ${quota} tokens`,
      'AI_QUOTA_EXCEEDED'
    )
  }
}

export class AIContentFilterError extends BusinessError {
  constructor(reason: string) {
    super(`Content filtered: ${reason}`, 'AI_CONTENT_FILTERED')
  }
}

export class AIModelNotFoundError extends BusinessError {
  constructor(provider: string, model: string) {
    super(
      `Model ${model} not found for provider ${provider}`,
      'AI_MODEL_NOT_FOUND'
    )
  }
}

export class AIRateLimitError extends BusinessError {
  constructor(provider: string, retryAfter?: number) {
    super(
      `Rate limit exceeded for provider ${provider}${retryAfter ? `, retry after ${retryAfter}s` : ''}`,
      'AI_RATE_LIMIT'
    )
  }
}
```

### 错误处理策略

1. **Provider 错误**: 捕获并转换为统一的 `AIProviderError`,记录详细日志
2. **配额超限**: 抛出 `AIQuotaExceededError`,阻止请求
3. **内容过滤**: 抛出 `AIContentFilterError`,记录审计日志
4. **速率限制**: 抛出 `AIRateLimitError`,实现指数退避重试
5. **网络错误**: 自动重试 3 次,记录失败日志

### 重试策略

```typescript
// packages/services/extensions/src/ai/utils/retry.ts

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // 不重试的错误类型
      if (
        error instanceof AIQuotaExceededError ||
        error instanceof AIContentFilterError
      ) {
        throw error
      }

      // 指数退避
      const delay = baseDelay * Math.pow(2, i)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}
```

## 测试策略

### 单元测试

使用 Vitest 进行单元测试:

- 测试每个适配器的 `complete` 和 `streamComplete` 方法
- 测试提示词模板的 CRUD 操作和变量替换
- 测试 RAG 服务的文档嵌入和搜索
- 测试缓存服务的键生成和过期
- 测试内容过滤服务的敏感信息检测
- 测试使用统计服务的记录和聚合

### 属性测试 (Property-Based Testing)

使用 **fast-check** 库进行属性测试:

```typescript
// packages/services/extensions/src/ai/prompts/prompt.service.spec.ts

import { describe, it, expect } from 'vitest'
import { fc } from 'fast-check'
import { PromptService } from './prompt.service'

describe('PromptService Properties', () => {
  it('Property 4: 模板变量替换正确性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // template
        fc.dictionary(fc.string(), fc.string()), // variables
        async (template, variables) => {
          // 构造带占位符的模板
          const templateWithPlaceholders = Object.keys(variables)
            .reduce((t, key) => t + `{{${key}}}`, template)

          const service = new PromptService(mockDb)
          const rendered = await service.render(templateId, variables)

          // 验证所有占位符都被替换
          for (const [key, value] of Object.entries(variables)) {
            expect(rendered).toContain(value)
            expect(rendered).not.toContain(`{{${key}}}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6: 模板使用计数递增', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100 }), // initial usage count
        fc.integer({ min: 1, max: 10 }), // number of uses
        async (initialCount, numUses) => {
          const service = new PromptService(mockDb)
          const template = await service.create({
            name: 'test',
            category: 'general',
            template: 'test {{var}}',
            variables: ['var'],
          })

          // 使用模板 numUses 次
          for (let i = 0; i < numUses; i++) {
            await service.render(template.id, { var: 'value' })
          }

          const updated = await service.findById(template.id)
          expect(updated?.usageCount).toBe(numUses)
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### 集成测试

测试完整的 AI 调用流程:

- 测试从 API 路由到 AI 服务的完整调用链
- 测试 RAG 增强的端到端流程
- 测试流式响应的 SSE 传输
- 测试缓存命中和未命中的场景
- 测试配额限制和告警触发

### 性能测试

- 测试代码补全的响应时间(< 500ms)
- 测试并发 AI 调用的吞吐量
- 测试向量搜索的查询性能
- 测试缓存的命中率和延迟降低

### 测试配置

```typescript
// vitest.config.ts

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.spec.ts',
        '**/*.test.ts',
      ],
    },
  },
})
```

## 可观测性

### 日志记录

使用项目的统一日志系统:

```typescript
import { Logger } from '@juanie/core/logger'

@Injectable()
export class AIService {
  private logger = new Logger(AIService.name)

  async complete(config: AIClientConfig, options: AICompletionOptions) {
    this.logger.log('AI completion request', {
      provider: config.provider,
      model: config.model,
      messageCount: options.messages.length,
    })

    try {
      const result = await this.doComplete(config, options)
      
      this.logger.log('AI completion success', {
        provider: config.provider,
        model: config.model,
        tokens: result.usage.totalTokens,
      })

      return result
    } catch (error) {
      this.logger.error('AI completion failed', error, {
        provider: config.provider,
        model: config.model,
      })
      throw error
    }
  }
}
```

### 指标收集

使用 OpenTelemetry 收集指标:

```typescript
import { Trace } from '@juanie/core/observability'

@Injectable()
export class AIService {
  @Trace('ai.complete')
  async complete(config: AIClientConfig, options: AICompletionOptions) {
    // 自动记录执行时间、成功/失败状态
    return await this.doComplete(config, options)
  }
}
```

关键指标:
- `ai.requests.total` - AI 请求总数
- `ai.requests.duration` - 请求延迟分布
- `ai.tokens.total` - Token 使用总量
- `ai.cache.hit_rate` - 缓存命中率
- `ai.errors.total` - 错误总数(按类型分组)
- `ai.quota.usage` - 配额使用率

### 追踪

每个 AI 请求创建一个 trace span,包含:
- 请求参数(provider, model, message count)
- 响应信息(tokens, finish reason)
- 缓存状态(hit/miss)
- 错误信息(如果失败)

## 部署考虑

### 环境变量

```bash
# AI Provider API Keys
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
ZHIPU_API_KEY=xxx
QWEN_API_KEY=xxx

# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=xxx

# Redis (缓存)
REDIS_URL=redis://localhost:6379

# 配额设置
AI_DEFAULT_MONTHLY_QUOTA=1000000  # tokens
AI_QUOTA_WARNING_THRESHOLD=0.9   # 90%

# 缓存设置
AI_CACHE_TTL=86400  # 24 hours in seconds

# 性能设置
AI_CODE_COMPLETION_TIMEOUT=500  # ms
AI_MAX_RETRIES=3
AI_RETRY_BASE_DELAY=1000  # ms
```

### 依赖服务

1. **PostgreSQL**: 存储提示词模板、对话历史、使用统计
2. **Redis**: 缓存 AI 响应
3. **Qdrant**: 存储文档向量
4. **AI Provider APIs**: Anthropic, OpenAI, 智谱, 阿里云等
5. **Ollama** (可选): 本地模型推理

### 扩展性

- AI 服务是无状态的,可以水平扩展
- 使用 Redis 作为共享缓存层
- Qdrant 支持集群部署
- 使用队列处理批量任务(如批量文档嵌入)

### 监控告警

设置告警规则:
- AI 请求错误率 > 5%
- AI 请求 P99 延迟 > 10s
- 配额使用率 > 90%
- 缓存命中率 < 50%
- Qdrant 连接失败

## 安全考虑

1. **API 密钥管理**: 使用环境变量或密钥管理服务,不在代码中硬编码
2. **敏感信息过滤**: 在发送给 AI 之前过滤 API 密钥、密码、邮箱等
3. **审计日志**: 记录所有 AI 交互,包括用户、时间、输入输出
4. **配额限制**: 防止滥用和成本失控
5. **内容过滤**: 支持自定义过滤规则,阻止不当内容
6. **模型禁用**: 支持禁用特定模型或提供商
7. **RBAC 集成**: 与项目的 CASL 权限系统集成,控制 AI 功能访问

## 未来扩展

Phase 2 和 Phase 3 的功能将在后续迭代中实现:

- AI Agent 系统(自主规划和执行)
- 实时协作编辑
- 智能代码重构
- 文档自动生成
- 测试用例生成
- 安全漏洞扫描
- 语音交互
- AI 工作流编排

这些功能将基于 Phase 1 的基础设施构建,遵循相同的架构模式和设计原则。
