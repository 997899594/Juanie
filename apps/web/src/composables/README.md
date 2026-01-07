# AI Chat Composable

## 概述

`useAiChat` 是一个 Vue 3 组合式函数，用于连接到 NestJS AI Platform 后端，提供流式 AI 对话功能。

## 功能特性

- ✅ **流式响应** - 基于 Server-Sent Events 的实时流式响应
- ✅ **工具调用支持** - 支持 AI 调用后端工具（Tool Calling）
- ✅ **多租户隔离** - 通过 `x-tenant-id` header 实现租户隔离
- ✅ **自动错误处理** - 内置错误处理和用户友好的错误提示
- ✅ **消息历史管理** - 完整的对话历史管理
- ✅ **响应式状态** - 基于 Vue 3 Composition API 的响应式状态管理
- ✅ **TypeScript 支持** - 完整的类型定义和类型安全

## 使用方法

### 基础用法

```vue
<script setup lang="ts">
import { useAiChat } from '@/composables/useAiChat'

const {
  messages,
  input,
  isLoading,
  error,
  sendMessage,
  clearMessages,
} = useAiChat({
  systemPrompt: '你是一个专业的 DevOps 助手',
})

const handleSend = async () => {
  await sendMessage(input.value)
  input.value = ''
}
</script>

<template>
  <div>
    <div v-for="message in messages" :key="message.id">
      <div :class="message.role">
        {{ message.content }}
      </div>
    </div>
    
    <input v-model="input" @keyup.enter="handleSend" />
    <button @click="handleSend" :disabled="isLoading">
      发送
    </button>
  </div>
</template>
```

### 高级用法

```typescript
const {
  messages,
  sendMessage,
  regenerate,
  stopGeneration,
} = useAiChat({
  // 初始消息
  initialMessages: [
    {
      id: '1',
      role: 'user',
      content: 'Hello',
      createdAt: new Date(),
    },
  ],
  
  // 自定义租户 ID
  tenantId: 'my-tenant-id',
  
  // 系统提示词
  systemPrompt: '你是一个专业的助手',
  
  // 完成回调
  onFinish: (message) => {
    console.log('AI 回复完成:', message)
  },
  
  // 错误回调
  onError: (error) => {
    console.error('AI 对话失败:', error)
  },
})

// 重新生成最后一条消息
await regenerate()

// 停止当前生成
stopGeneration()
```

## API 参考

### 参数

```typescript
interface UseAiChatOptions {
  /** 初始消息列表 */
  initialMessages?: Message[]
  
  /** 租户 ID（用于多租户隔离） */
  tenantId?: string
  
  /** 系统提示词 */
  systemPrompt?: string
  
  /** 错误回调 */
  onError?: (error: Error) => void
  
  /** 完成回调 */
  onFinish?: (message: Message) => void
}
```

### 返回值

```typescript
interface UseAiChatReturn {
  // 状态
  messages: Readonly<Ref<Message[]>>
  input: Ref<string>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<Error | null>>
  tenantId: Readonly<Ref<string>>
  
  // 操作
  sendMessage: (content: string, role?: 'user' | 'assistant') => Promise<void>
  clearMessages: () => void
  regenerate: () => Promise<void>
  stopGeneration: () => void
  setSystemPrompt: (prompt: string) => void
  setInput: (value: string) => void
  setMessages: (messages: Message[]) => void
}
```

### 消息类型

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: Date
}
```

## 环境变量

```bash
# AI Platform 后端 URL（默认: http://localhost:3003）
VITE_AI_PLATFORM_URL=http://localhost:3003
```

## 测试

运行单元测试：

```bash
bun test:run
```

运行测试并查看覆盖率：

```bash
bun test:coverage
```

运行测试 UI：

```bash
bun test:ui
```

## 架构说明

### 后端 API 契约

- **端点**: `POST /api/ai/chat`
- **请求头**: 
  - `Content-Type: application/json`
  - `x-tenant-id: <tenant-id>`
- **请求体**:
  ```json
  {
    "messages": [
      { "id": "1", "role": "user", "content": "Hello", "createdAt": "2024-01-01T00:00:00Z" }
    ],
    "tenantId": "tenant-123",
    "systemPrompt": "You are a helpful assistant"
  }
  ```
- **响应**: 流式文本响应 (`text/plain; charset=utf-8`)

### 多租户隔离

租户 ID 的优先级：
1. 传入的 `tenantId` 参数
2. Auth Store 中的 `currentOrganization.id`
3. 默认值 `'default'`

租户 ID 会通过以下方式传递到后端：
- HTTP Header: `x-tenant-id`
- Request Body: `tenantId` 字段

### 错误处理

所有错误都会：
1. 设置 `error` 状态
2. 显示 Toast 错误提示
3. 调用 `onError` 回调（如果提供）
4. 记录到控制台

### 流式响应处理

使用 `ReadableStream` API 处理流式响应：
1. 创建助手消息占位符
2. 逐块读取响应数据
3. 实时更新消息内容
4. 触发 Vue 响应式更新

## 相关文件

- 实现: `apps/web/src/composables/useAiChat.ts`
- 测试: `apps/web/src/composables/useAiChat.test.ts`
- 示例组件: `apps/web/src/views/ai/AiChat.vue`
- 后端控制器: `apps/ai-platform/src/ai/controllers/ai-chat.controller.ts`
- 后端服务: `apps/ai-platform/src/ai/services/ai-chat.service.ts`

## 下一步

- [ ] 实现 AbortController 支持真正的停止生成
- [ ] 添加消息编辑功能
- [ ] 添加消息删除功能
- [ ] 实现消息持久化（LocalStorage）
- [ ] 添加工具调用结果的可视化组件
- [ ] 实现多模态输入支持（图片、文件）
