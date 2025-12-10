# AI 模块使用指南

本指南介绍如何使用 Juanie 平台的 AI 模块功能。

## 目录

- [快速开始](#快速开始)
- [配置](#配置)
- [核心功能](#核心功能)
- [高级功能](#高级功能)
- [最佳实践](#最佳实践)
- [故障排查](#故障排查)

## 快速开始

### 1. 配置环境变量

在 `.env` 文件中添加 AI 提供商的 API 密钥:

```bash
# AI 提供商 API 密钥（至少配置一个）
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
ZHIPU_API_KEY=...
QWEN_API_KEY=...

# Ollama 配置（可选，用于本地模型）
OLLAMA_HOST=http://localhost:11434
OLLAMA_DEFAULT_MODEL=qwen2.5-coder:7b

# Qdrant 配置（用于 RAG 功能）
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# AI 配额和缓存
AI_DEFAULT_MONTHLY_QUOTA=1000000
AI_QUOTA_WARNING_THRESHOLD=0.9
AI_CACHE_TTL=86400
```

### 2. 启动依赖服务

```bash
# 启动 Qdrant（用于 RAG）
docker-compose up -d qdrant

# 启动 Ollama（可选，用于本地模型）
docker-compose up -d ollama
```

### 3. 基本使用

```typescript
import { trpc } from '@/lib/trpc'

// 简单的 AI 调用
const result = await trpc.ai.complete.mutate({
  provider: 'zhipu',
  model: 'glm-4-flash',
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Explain TypeScript generics' }
  ],
  temperature: 0.7,
  maxTokens: 500,
})

console.log(result.content)
```

## 配置

### 支持的 AI 提供商

| 提供商 | 模型 | 用途 | 成本 |
|--------|------|------|------|
| **智谱 GLM** | glm-4-flash | 实时交互、代码补全、快速问答 | 低 |
| **智谱 GLM** | glm-4.6 | 深度分析、教学、需要推理过程 | 中 |
| **Anthropic** | claude-3-5-sonnet | 代码审查、复杂推理 | 高 |
| **OpenAI** | gpt-4-turbo | 通用对话、代码生成 | 高 |
| **阿里 Qwen** | qwen2.5-coder | 代码补全、中文对话 | 中 |
| **Ollama** | qwen2.5-coder:7b | 本地部署、离线使用 | 零 |

### 推荐配置

**默认配置（推荐）**:
- **实时交互**: 智谱 GLM-4-Flash（快速、低成本）
- **代码审查**: 智谱 GLM-4-Flash 或 Claude 3.5 Sonnet
- **深度分析**: 智谱 GLM-4.6 或 Claude 3 Opus
- **本地开发**: Ollama qwen2.5-coder:7b

## 核心功能

### 1. AI 对话

#### 同步调用

```typescript
const result = await trpc.ai.complete.mutate({
  provider: 'zhipu',
  model: 'glm-4-flash',
  messages: [
    { role: 'system', content: 'You are a code expert' },
    { role: 'user', content: 'Write a TypeScript function to sort an array' }
  ],
  temperature: 0.7,
  maxTokens: 500,
})

console.log('Response:', result.content)
console.log('Tokens used:', result.usage.totalTokens)
```

#### 流式调用

```typescript
const stream = await trpc.ai.streamComplete.mutate({
  provider: 'zhipu',
  model: 'glm-4-flash',
  messages: [
    { role: 'user', content: 'Explain async/await in JavaScript' }
  ],
})

for await (const chunk of stream) {
  process.stdout.write(chunk)
}
```

#### 带上下文的聊天

```typescript
// 创建对话
const conversation = await trpc.ai.conversations.create.mutate({
  projectId: 'project-123',
  title: 'Code Review Discussion',
})

// 发送消息（自动管理上下文）
const response = await trpc.ai.chat.mutate({
  provider: 'zhipu',
  model: 'glm-4-flash',
  message: 'Review this code: function add(a, b) { return a + b }',
  conversationId: conversation.id,
})

console.log(response.response)
```

### 2. 提示词模板管理

#### 创建模板

```typescript
const template = await trpc.ai.prompts.create.mutate({
  name: 'Code Review Template',
  category: 'code-review',
  template: `Review the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

Focus on:
- Code quality
- Best practices
- Potential bugs
- Performance issues`,
  variables: ['language', 'code'],
})
```

#### 使用模板

```typescript
const rendered = await trpc.ai.prompts.render.mutate({
  id: template.id,
  variables: {
    language: 'typescript',
    code: 'function add(a, b) { return a + b }',
  },
})

const result = await trpc.ai.complete.mutate({
  provider: 'zhipu',
  model: 'glm-4-flash',
  messages: [
    { role: 'user', content: rendered.rendered }
  ],
})
```

#### 查询模板

```typescript
// 按分类查询
const templates = await trpc.ai.prompts.findByCategory.useQuery({
  category: 'code-review',
})

// 按 ID 查询
const template = await trpc.ai.prompts.findById.useQuery({
  id: 'template-123',
})
```

### 3. 对话历史管理

#### 创建和管理对话

```typescript
// 创建对话
const conversation = await trpc.ai.conversations.create.mutate({
  projectId: 'project-123',
  title: 'Architecture Discussion',
})

// 添加消息
await trpc.ai.conversations.addMessage.mutate({
  conversationId: conversation.id,
  message: {
    role: 'user',
    content: 'What is the best architecture for a microservices app?',
  },
})

await trpc.ai.conversations.addMessage.mutate({
  conversationId: conversation.id,
  message: {
    role: 'assistant',
    content: 'For microservices, consider using...',
  },
})
```

#### 查询对话

```typescript
// 按项目查询
const conversations = await trpc.ai.conversations.findByProject.useQuery({
  projectId: 'project-123',
})

// 搜索对话
const results = await trpc.ai.conversations.search.useQuery({
  query: 'architecture',
  projectId: 'project-123',
})

// 查询单个对话
const conversation = await trpc.ai.conversations.findById.useQuery({
  id: 'conversation-123',
})
```

### 4. 使用统计和成本追踪

#### 查看使用统计

```typescript
const stats = await trpc.ai.usage.getStatistics.useQuery({
  projectId: 'project-123',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
})

console.log('Total tokens:', stats.totalTokens)
console.log('Total cost:', stats.totalCost)
console.log('Request count:', stats.requestCount)

// 按提供商和模型分组
stats.breakdown.forEach(item => {
  console.log(`${item.provider}/${item.model}:`, {
    tokens: item.tokens,
    cost: item.cost,
    requests: item.requests,
  })
})
```

#### 查看缓存命中率

```typescript
const cacheStats = await trpc.ai.usage.getCacheHitRate.useQuery({
  projectId: 'project-123',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
})

console.log('Cache hit rate:', `${(cacheStats.hitRate * 100).toFixed(2)}%`)
console.log('Hits:', cacheStats.hits)
console.log('Misses:', cacheStats.misses)
```

## 高级功能

### 1. 代码审查

#### 单文件审查

```typescript
const review = await trpc.ai.codeReview.review.mutate({
  code: `
function calculateTotal(items) {
  let total = 0
  for (let i = 0; i < items.length; i++) {
    total += items[i].price
  }
  return total
}
  `,
  language: 'javascript',
  mode: 'comprehensive',
})

console.log('Score:', review.score)
console.log('Issues:', review.issues)
console.log('Suggestions:', review.suggestions)
console.log('Strengths:', review.strengths)
```

#### 批量审查

```typescript
const results = await trpc.ai.codeReview.batchReview.mutate({
  files: [
    {
      path: 'src/utils/math.ts',
      code: '...',
      language: 'typescript',
    },
    {
      path: 'src/utils/string.ts',
      code: '...',
      language: 'typescript',
    },
  ],
})

results.forEach(result => {
  console.log(`${result.path}: Score ${result.result.score}`)
})
```

#### 生成审查摘要

```typescript
const summary = await trpc.ai.codeReview.generateSummary.mutate({
  results: [review1, review2, review3],
})

console.log('Overall score:', summary.overallScore)
console.log('Total issues:', summary.totalIssues)
console.log('Critical issues:', summary.criticalIssues)
console.log('Summary:', summary.summary)
```

### 2. 配置生成

#### Kubernetes 配置

```typescript
const k8sConfig = await trpc.ai.config.generateK8sConfig.mutate({
  projectName: 'my-app',
  image: 'my-app:latest',
  port: 3000,
  replicas: 3,
  resources: {
    requests: { cpu: '100m', memory: '128Mi' },
    limits: { cpu: '500m', memory: '512Mi' },
  },
})

console.log(k8sConfig.config)
console.log('Suggestions:', k8sConfig.suggestions)
```

#### Dockerfile

```typescript
const dockerfile = await trpc.ai.config.generateDockerfile.mutate({
  language: 'typescript',
  framework: 'nestjs',
  version: '20',
})

console.log(dockerfile.dockerfile)
```

#### CI/CD 配置

```typescript
// GitHub Actions
const ghActions = await trpc.ai.config.generateGitHubActions.mutate({
  language: 'typescript',
  buildCommand: 'bun run build',
  testCommand: 'bun test',
})

// GitLab CI
const gitlabCI = await trpc.ai.config.generateGitLabCI.mutate({
  language: 'typescript',
  buildCommand: 'bun run build',
  testCommand: 'bun test',
})
```

### 3. 故障诊断

#### 完整诊断

```typescript
const diagnosis = await trpc.ai.troubleshoot.diagnose.mutate({
  logs: `
Error: ECONNREFUSED
    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1144:16)
  `,
  events: `
Pod my-app-123 failed to start
Container exited with code 1
  `,
  context: {
    environment: 'production',
    service: 'api-gateway',
  },
})

console.log('Root cause:', diagnosis.rootCause)
console.log('Analysis:', diagnosis.analysis)
console.log('Fix steps:', diagnosis.fixSteps)
console.log('Estimated time:', diagnosis.estimatedTime)
```

#### 快速诊断

```typescript
const quickDiag = await trpc.ai.troubleshoot.quickDiagnose.mutate({
  error: 'TypeError: Cannot read property "map" of undefined',
})

console.log('Possible causes:', quickDiag.possibleCauses)
console.log('Quick fixes:', quickDiag.quickFixes)
```

### 4. RAG (检索增强生成)

#### 嵌入文档

```typescript
// 嵌入项目文档
await trpc.ai.rag.embedDocument.mutate({
  projectId: 'project-123',
  content: `
# API Documentation

## Authentication
All API endpoints require authentication...
  `,
  metadata: {
    type: 'doc',
    path: 'docs/api.md',
  },
})

// 嵌入代码
await trpc.ai.rag.embedDocument.mutate({
  projectId: 'project-123',
  content: `
export class UserService {
  async createUser(data: CreateUserDto) {
    // ...
  }
}
  `,
  metadata: {
    type: 'code',
    path: 'src/services/user.service.ts',
    language: 'typescript',
  },
})
```

#### 语义搜索

```typescript
const results = await trpc.ai.rag.search.useQuery({
  projectId: 'project-123',
  query: 'How to authenticate users?',
  limit: 5,
})

results.forEach(result => {
  console.log('Score:', result.score)
  console.log('Content:', result.content)
  console.log('Path:', result.metadata.path)
})
```

#### 增强提示词

```typescript
const enhanced = await trpc.ai.rag.enhancePrompt.mutate({
  projectId: 'project-123',
  prompt: 'How do I add a new API endpoint?',
  topK: 3,
})

// 使用增强后的提示词
const result = await trpc.ai.complete.mutate({
  provider: 'zhipu',
  model: 'glm-4-flash',
  messages: [
    { role: 'user', content: enhanced.enhanced }
  ],
})

console.log('Sources:', enhanced.sources)
console.log('Response:', result.content)
```

## 最佳实践

### 1. 模型选择

**实时交互场景**:
```typescript
// ✅ 推荐：使用 GLM-4-Flash（快速、低成本）
const result = await trpc.ai.complete.mutate({
  provider: 'zhipu',
  model: 'glm-4-flash',
  messages: [...],
  maxTokens: 500, // 限制 token 数量
})
```

**深度分析场景**:
```typescript
// ✅ 推荐：使用 GLM-4.6 或 Claude（高质量）
const result = await trpc.ai.complete.mutate({
  provider: 'zhipu',
  model: 'glm-4.6',
  messages: [...],
  maxTokens: 2000, // 允许更多 tokens
})
```

**本地开发场景**:
```typescript
// ✅ 推荐：使用 Ollama（零成本）
const result = await trpc.ai.complete.mutate({
  provider: 'ollama',
  model: 'qwen2.5-coder:7b',
  messages: [...],
})
```

### 2. 成本优化

**使用缓存**:
```typescript
// 相同的请求会自动使用缓存
const result1 = await trpc.ai.complete.mutate({ ... })
const result2 = await trpc.ai.complete.mutate({ ... }) // 缓存命中
```

**限制 Token 数量**:
```typescript
// ✅ 好的做法
const result = await trpc.ai.complete.mutate({
  provider: 'zhipu',
  model: 'glm-4-flash',
  messages: [...],
  maxTokens: 500, // 明确限制
})

// ❌ 避免
const result = await trpc.ai.complete.mutate({
  provider: 'zhipu',
  model: 'glm-4-flash',
  messages: [...],
  // 没有限制，可能消耗大量 tokens
})
```

**使用提示词模板**:
```typescript
// ✅ 好的做法：复用模板
const template = await trpc.ai.prompts.findById.useQuery({ id: 'template-123' })
const rendered = await trpc.ai.prompts.render.mutate({
  id: template.id,
  variables: { code: '...' },
})

// ❌ 避免：每次都写完整提示词
const result = await trpc.ai.complete.mutate({
  messages: [
    { role: 'user', content: 'Review this code...' } // 重复的提示词
  ],
})
```

### 3. 错误处理

```typescript
try {
  const result = await trpc.ai.complete.mutate({
    provider: 'zhipu',
    model: 'glm-4-flash',
    messages: [...],
  })
} catch (error) {
  if (error.code === 'AI_QUOTA_EXCEEDED') {
    // 配额超限
    console.error('AI quota exceeded')
  } else if (error.code === 'AI_CONTENT_FILTERED') {
    // 内容被过滤
    console.error('Content filtered:', error.message)
  } else if (error.code === 'AI_RATE_LIMIT') {
    // 速率限制
    console.error('Rate limit exceeded, retry after:', error.retryAfter)
  } else {
    // 其他错误
    console.error('AI error:', error.message)
  }
}
```

### 4. 性能优化

**使用流式响应**:
```typescript
// ✅ 好的做法：流式响应（更好的用户体验）
const stream = await trpc.ai.streamComplete.mutate({ ... })
for await (const chunk of stream) {
  updateUI(chunk) // 实时更新 UI
}

// ❌ 避免：同步等待（用户体验差）
const result = await trpc.ai.complete.mutate({ ... })
updateUI(result.content) // 等待完整响应
```

**批量处理**:
```typescript
// ✅ 好的做法：批量审查
const results = await trpc.ai.codeReview.batchReview.mutate({
  files: [file1, file2, file3],
})

// ❌ 避免：逐个审查
for (const file of files) {
  await trpc.ai.codeReview.review.mutate({ ... })
}
```

### 5. 安全性

**避免敏感信息**:
```typescript
// ✅ 好的做法：移除敏感信息
const code = removeApiKeys(originalCode)
const result = await trpc.ai.codeReview.review.mutate({
  code,
  language: 'typescript',
})

// ❌ 避免：直接发送包含敏感信息的代码
const result = await trpc.ai.codeReview.review.mutate({
  code: 'const API_KEY = "sk-xxx"', // 敏感信息
  language: 'typescript',
})
```

**使用项目隔离**:
```typescript
// ✅ 好的做法：指定项目 ID
const result = await trpc.ai.chat.mutate({
  provider: 'zhipu',
  model: 'glm-4-flash',
  message: '...',
  projectId: 'project-123', // 数据隔离
})
```

## 故障排查

### 常见问题

#### 1. AI 调用失败

**症状**: API 调用返回错误

**可能原因**:
- API 密钥未配置或无效
- 网络连接问题
- 提供商服务不可用

**解决方案**:
```bash
# 检查环境变量
echo $ZHIPU_API_KEY

# 测试网络连接
curl https://open.bigmodel.cn/api/paas/v4/chat/completions

# 查看日志
docker-compose logs api-gateway
```

#### 2. RAG 搜索无结果

**症状**: 语义搜索返回空结果

**可能原因**:
- Qdrant 未运行
- 文档未嵌入
- 项目 ID 不匹配

**解决方案**:
```bash
# 检查 Qdrant 状态
docker-compose ps qdrant

# 重启 Qdrant
docker-compose restart qdrant

# 检查集合
curl http://localhost:6333/collections
```

#### 3. 缓存未命中

**症状**: 相同请求没有使用缓存

**可能原因**:
- Redis 未运行
- 缓存键生成逻辑问题
- 缓存已过期

**解决方案**:
```bash
# 检查 Redis 状态
docker-compose ps redis

# 查看缓存键
redis-cli keys "ai:cache:*"

# 查看缓存统计
redis-cli info stats
```

#### 4. 配额超限

**症状**: 请求被拒绝，提示配额超限

**可能原因**:
- 月度配额已用完
- 配额设置过低

**解决方案**:
```typescript
// 查看使用统计
const stats = await trpc.ai.usage.getStatistics.useQuery({
  projectId: 'project-123',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
})

// 调整配额（在 .env 中）
AI_DEFAULT_MONTHLY_QUOTA=2000000
```

### 调试技巧

#### 启用详细日志

```bash
# .env
LOG_LEVEL=debug
```

#### 查看 AI 调用日志

```bash
# 查看最近的 AI 调用
docker-compose logs api-gateway | grep "AI completion"

# 查看错误日志
docker-compose logs api-gateway | grep "AI error"
```

#### 监控使用情况

```typescript
// 定期检查使用统计
const stats = await trpc.ai.usage.getStatistics.useQuery({
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近 7 天
  endDate: new Date(),
})

console.log('Weekly usage:', stats)
```

## 相关资源

### 内部文档

- [API 参考](../API_REFERENCE.md#15-ai-模块-ai)
- [架构文档](../ARCHITECTURE.md)
- [AI 模块设计](.kiro/specs/ai-module-enhancement/design.md)

### 外部资源

- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Qdrant 文档](https://qdrant.tech/documentation/)
- [Anthropic API](https://docs.anthropic.com/)
- [OpenAI API](https://platform.openai.com/docs)
- [智谱 API](https://open.bigmodel.cn/dev/api)
- [阿里 Qwen API](https://help.aliyun.com/zh/dashscope/)
- [Ollama](https://ollama.ai/)

## 总结

AI 模块提供了强大的 AI 能力，包括：

- ✅ 多模型支持（5 个提供商）
- ✅ RAG 检索增强生成
- ✅ 提示词模板管理
- ✅ 对话历史管理
- ✅ 使用统计和成本追踪
- ✅ 响应缓存
- ✅ 代码审查、配置生成、故障诊断

**推荐配置**:
- 默认使用智谱 GLM-4-Flash（快速、低成本）
- 深度分析使用 GLM-4.6 或 Claude
- 本地开发使用 Ollama

**下一步**:
1. 配置 API 密钥
2. 启动依赖服务
3. 尝试基本功能
4. 探索高级功能

如有问题，请查看[故障排查](#故障排查)部分或联系团队。
