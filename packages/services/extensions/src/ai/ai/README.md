# AI 客户端接口和适配器

本模块实现了统一的 AI 客户端接口,支持多个 AI 提供商。

## 架构

使用**适配器模式**实现多模型支持:

```
IAIClient (接口)
    ↑
    ├── ClaudeAdapter (Anthropic Claude)
    ├── OpenAIAdapter (OpenAI GPT)
    ├── ZhipuAdapter (智谱 GLM)
    ├── QwenAdapter (阿里 Qwen)
    └── OllamaAdapter (本地 Ollama)
```

## 使用方式

### 1. 创建客户端

```typescript
import { AIClientFactory } from '@juanie/service-extensions'

// 注入工厂
constructor(private readonly aiClientFactory: AIClientFactory) {}

// 创建 Claude 客户端
const client = this.aiClientFactory.createClient({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 4096,
})
```

### 2. 同步调用

```typescript
const result = await client.complete({
  messages: [
    { role: 'system', content: '你是一个代码审查助手' },
    { role: 'user', content: '请审查这段代码...' },
  ],
  temperature: 0.7,
  maxTokens: 2000,
})

console.log(result.content)
console.log(result.usage) // token 使用统计
```

### 3. 流式调用

```typescript
for await (const chunk of client.streamComplete({
  messages: [
    { role: 'user', content: '写一个 TypeScript 函数...' },
  ],
})) {
  process.stdout.write(chunk)
}
```

### 4. Function Calling

```typescript
const result = await client.complete({
  messages: [
    { role: 'user', content: '帮我创建一个项目' },
  ],
  functions: [
    {
      name: 'createProject',
      description: '创建新项目',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          template: { type: 'string' },
        },
        required: ['name'],
      },
    },
  ],
})

if (result.functionCall) {
  console.log('调用函数:', result.functionCall.name)
  console.log('参数:', result.functionCall.arguments)
}
```

## 支持的提供商

### Anthropic Claude

```typescript
{
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022' | 'claude-3-opus-20240229' | ...,
  apiKey: process.env.ANTHROPIC_API_KEY,
}
```

### OpenAI

```typescript
{
  provider: 'openai',
  model: 'gpt-4-turbo' | 'gpt-4' | 'gpt-3.5-turbo',
  apiKey: process.env.OPENAI_API_KEY,
}
```

### 智谱 GLM

```typescript
{
  provider: 'zhipu',
  model: 'glm-4' | 'glm-4-flash' | 'glm-4v',
  apiKey: process.env.ZHIPU_API_KEY,
}
```

### 阿里 Qwen

```typescript
{
  provider: 'qwen',
  model: 'qwen2.5' | 'qwen2.5-coder' | 'qwenvl',
  apiKey: process.env.QWEN_API_KEY,
}
```

### Ollama (本地)

```typescript
{
  provider: 'ollama',
  model: 'qwen2.5-coder:7b' | 'deepseek-coder:6.7b' | ...,
  // 不需要 apiKey
}
```

## 环境变量

在 `.env` 文件中配置:

```bash
# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-xxx

# OpenAI
OPENAI_API_KEY=sk-xxx

# 智谱 GLM
ZHIPU_API_KEY=xxx

# 阿里 Qwen
QWEN_API_KEY=xxx

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=qwen2.5-coder:7b
```

## 技术栈

- **Vercel AI SDK**: 统一的 AI 接口
- **@ai-sdk/anthropic**: Claude 支持
- **@ai-sdk/openai**: OpenAI 和兼容 API 支持
- **Ollama**: 本地模型支持

## 错误处理

所有适配器都会将错误转换为统一的 `AppError`:

```typescript
try {
  const result = await client.complete(options)
} catch (error) {
  if (error.code === 'AI_INFERENCE_FAILED') {
    // 处理 AI 推理失败
  }
}
```

## 下一步

- [ ] 实现 AI 服务层 (缓存、统计、过滤)
- [ ] 实现 RAG 服务
- [ ] 实现提示词模板管理
- [ ] 实现对话历史管理
- [ ] 实现使用统计和成本追踪
