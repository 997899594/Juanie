# 对话历史管理服务

提供 AI 对话历史的持久化存储、查询和上下文管理功能。

## 功能

- **对话 CRUD**: 创建、查询、更新、删除对话
- **消息管理**: 添加消息到对话
- **上下文管理**: 自动保留最近 10 条消息作为上下文
- **搜索功能**: 在标题和消息内容中搜索关键词
- **项目筛选**: 按项目 ID 筛选对话
- **用户筛选**: 按用户 ID 筛选对话

## 使用示例

### 创建对话

```typescript
import { ConversationService } from '@juanie/service-extensions'

const conversation = await conversationService.create({
  userId: 'user-123',
  projectId: 'project-456',
  title: '代码审查讨论',
  messages: [
    {
      role: 'user',
      content: '请帮我审查这段代码',
    },
  ],
})
```

### 添加消息

```typescript
const updated = await conversationService.addMessage(conversation.id, {
  role: 'assistant',
  content: '我发现了以下问题...',
})
```

### 获取上下文

```typescript
// 获取最近 10 条消息
const context = await conversationService.getContext(conversation.id)

// 自定义消息数量
const context = await conversationService.getContext(conversation.id, 5)
```

### 按项目查询

```typescript
const conversations = await conversationService.findByProject('project-456')
```

### 搜索对话

```typescript
const results = await conversationService.search('user-123', '代码审查')
```

### 删除对话

```typescript
await conversationService.delete(conversation.id)
```

## 数据模型

```typescript
interface AIConversation {
  id: string
  userId: string
  projectId?: string
  title?: string
  messages: AIMessage[]
  createdAt: Date
  updatedAt: Date
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string
  name?: string
  functionCall?: {
    name: string
    arguments: string
  }
}
```

## 上下文管理

对话服务自动管理上下文长度:

- 默认保留最近 10 条消息
- 可通过 `getContext(id, limit)` 自定义数量
- 超过限制的旧消息仍然保存在数据库中,但不会作为上下文传递给 AI

## 搜索功能

搜索功能支持:

- 在对话标题中搜索
- 在消息内容中搜索
- 不区分大小写
- 返回按更新时间倒序排列的结果

## 数据隔离

- 每个对话属于一个用户
- 对话可以关联到项目 (可选)
- 支持按用户或项目筛选对话
- 支持批量删除用户或项目的所有对话

## 错误处理

所有方法在失败时抛出 `ErrorFactory.ai.inferenceFailed()` 错误,包含详细的错误信息。

## 依赖

- `@juanie/core/database` - 数据库访问
- `@juanie/types` - 类型定义和错误工厂
- `drizzle-orm` - ORM 查询构建器

## 相关服务

- `AIService` - 核心 AI 服务
- `PromptService` - 提示词模板管理
- `RAGService` - 检索增强生成
