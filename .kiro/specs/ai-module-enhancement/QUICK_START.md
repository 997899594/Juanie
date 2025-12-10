# AI Module Quick Start Guide

## 快速开始

这是 AI 模块的快速入门指南，帮助你在 5 分钟内开始使用 AI 功能。

## 前置条件

- ✅ PostgreSQL 运行中
- ✅ Redis 运行中
- ⚠️ Qdrant 需要启动（用于 RAG 功能）
- ⚠️ 至少一个 AI 提供商的 API 密钥

## 1. 配置环境变量

### 复制环境变量模板

```bash
cp .env.example .env
```

### 添加 API 密钥

编辑 `.env` 文件，至少配置一个 AI 提供商：

```bash
# 选项 1: 使用 Anthropic Claude (推荐用于代码审查)
ANTHROPIC_API_KEY=sk-ant-your-key-here

# 选项 2: 使用 OpenAI GPT
OPENAI_API_KEY=sk-your-key-here

# 选项 3: 使用智谱 GLM (中文优化)
ZHIPU_API_KEY=your-key-here

# 选项 4: 使用阿里 Qwen
QWEN_API_KEY=your-key-here

# 选项 5: 使用 Ollama (本地免费)
OLLAMA_HOST=http://localhost:11434
OLLAMA_DEFAULT_MODEL=qwen2.5-coder:7b
```

### 配置 Qdrant (用于 RAG)

```bash
# Qdrant 向量数据库
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=  # 可选
```

## 2. 启动依赖服务

### 启动 Qdrant (必需，用于 RAG)

```bash
docker-compose up -d qdrant
```

验证 Qdrant 运行：

```bash
curl http://localhost:6333/health
# 应该返回: {"status":"ok"}
```

### 启动 Ollama (可选，用于本地模型)

```bash
docker-compose up -d ollama
```

验证 Ollama 运行：

```bash
curl http://localhost:11434/api/tags
# 应该返回模型列表
```

下载模型：

```bash
docker exec -it ollama ollama pull qwen2.5-coder:7b
```

## 3. 启动应用

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev
```

## 4. 使用 AI 功能

### 方式 1: 通过 tRPC API (推荐)

在前端或 API 客户端中使用：

```typescript
import { trpc } from '@/lib/trpc'

// 基本 AI 调用
const result = await trpc.ai.complete.mutate({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'user', content: 'Explain TypeScript generics' }
  ],
})

console.log(result.content)
```

### 方式 2: 在后端服务中使用

```typescript
import { AIService } from '@juanie/service-extensions'

@Injectable()
export class MyService {
  constructor(private readonly aiService: AIService) {}

  async generateCode() {
    const result = await this.aiService.complete({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        { role: 'system', content: 'You are a code generator' },
        { role: 'user', content: 'Generate a TypeScript function' }
      ],
    })
    
    return result.content
  }
}
```

## 5. 常用功能示例

### 代码审查

```typescript
const review = await trpc.ai.codeReview.review.mutate({
  code: `
    function add(a, b) {
      return a + b
    }
  `,
  language: 'javascript',
  mode: 'comprehensive',
})

console.log('Score:', review.score)
console.log('Issues:', review.issues)
```

### 配置生成

```typescript
const k8sConfig = await trpc.ai.config.generateK8sConfig.mutate({
  projectName: 'my-app',
  image: 'my-app:latest',
  port: 3000,
  replicas: 3,
})

console.log(k8sConfig.config)
```

### 故障诊断

```typescript
const diagnosis = await trpc.ai.troubleshoot.diagnose.mutate({
  logs: 'Error: Connection refused...',
  events: [],
  context: { service: 'api-gateway' },
})

console.log('Root Cause:', diagnosis.rootCause)
console.log('Fix Steps:', diagnosis.fixSteps)
```

### RAG (文档检索)

```typescript
// 1. 嵌入文档
await trpc.ai.rag.embedDocument.mutate({
  projectId: 'project-123',
  content: 'This is a documentation page...',
  metadata: { type: 'docs', title: 'Getting Started' },
})

// 2. 搜索文档
const results = await trpc.ai.rag.search.mutate({
  projectId: 'project-123',
  query: 'How to deploy?',
  limit: 5,
})

console.log('Found documents:', results)

// 3. 增强提示词
const enhanced = await trpc.ai.rag.enhancePrompt.mutate({
  projectId: 'project-123',
  prompt: 'How do I deploy my app?',
  topK: 3,
})

console.log('Enhanced prompt:', enhanced)
```

### 对话管理

```typescript
// 1. 创建对话
const conversation = await trpc.ai.conversations.create.mutate({
  projectId: 'project-123',
  title: 'Code Review Discussion',
})

// 2. 添加消息
await trpc.ai.conversations.addMessage.mutate({
  conversationId: conversation.id,
  message: {
    role: 'user',
    content: 'Can you review this code?',
  },
})

// 3. 查询对话
const history = await trpc.ai.conversations.findById.query({
  id: conversation.id,
})

console.log('Messages:', history.messages)
```

### 提示词模板

```typescript
// 1. 创建模板
const template = await trpc.ai.prompts.create.mutate({
  name: 'Code Review Template',
  template: 'Review this {{language}} code:\n\n{{code}}',
  category: 'code-review',
})

// 2. 渲染模板
const rendered = await trpc.ai.prompts.render.mutate({
  id: template.id,
  variables: {
    language: 'TypeScript',
    code: 'function add(a, b) { return a + b }',
  },
})

console.log('Rendered:', rendered)
```

### 使用统计

```typescript
const stats = await trpc.ai.usage.getStatistics.query({
  projectId: 'project-123',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
})

console.log('Total tokens:', stats.totalTokens)
console.log('Total cost:', stats.totalCost)
console.log('Requests:', stats.requestCount)
```

## 6. 测试 AI 功能

### 使用 curl 测试

```bash
# 测试 AI 调用
curl -X POST http://localhost:3000/trpc/ai.complete \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### 使用前端 UI

访问 `http://localhost:1997` 并使用 AI 助手功能。

## 7. 监控和调试

### 查看日志

```bash
# API Gateway 日志
bun run dev:api

# 查看 AI 调用日志
grep "AI Service" logs/app.log
```

### 查看使用统计

```bash
# 连接数据库
psql -U findbiao -d juanie_devops

# 查询使用记录
SELECT * FROM ai_usage ORDER BY created_at DESC LIMIT 10;

# 查询缓存命中率
SELECT 
  COUNT(*) FILTER (WHERE cache_hit = true) * 100.0 / COUNT(*) as hit_rate
FROM ai_usage;
```

### 查看缓存

```bash
# 连接 Redis
redis-cli

# 查看 AI 缓存键
KEYS ai:cache:*

# 查看缓存内容
GET ai:cache:anthropic:claude-3-5-sonnet:...
```

## 8. 常见问题

### Q: AI 调用失败，返回 401 错误

**A**: 检查 API 密钥是否正确配置：

```bash
# 查看环境变量
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY

# 重启应用以加载新的环境变量
bun run dev
```

### Q: RAG 搜索无结果

**A**: 确认 Qdrant 正在运行并且文档已嵌入：

```bash
# 检查 Qdrant
curl http://localhost:6333/health

# 查看集合
curl http://localhost:6333/collections

# 重新嵌入文档
# 使用 trpc.ai.rag.embedDocument
```

### Q: 响应很慢

**A**: 检查缓存是否启用：

```bash
# 查看缓存配置
grep AI_CACHE_TTL .env

# 查看缓存命中率
# 使用 trpc.ai.usage.getCacheHitRate
```

### Q: 超过配额限制

**A**: 调整配额或清理缓存：

```bash
# 增加配额
AI_DEFAULT_MONTHLY_QUOTA=2000000

# 清理缓存
redis-cli FLUSHDB
```

## 9. 性能优化

### 启用缓存

```bash
# .env
AI_CACHE_TTL=86400  # 24 小时
```

### 使用本地模型

```bash
# 使用 Ollama 避免 API 成本
OLLAMA_HOST=http://localhost:11434
OLLAMA_DEFAULT_MODEL=qwen2.5-coder:7b
```

### 选择合适的模型

- **代码审查**: Claude 3.5 Sonnet (最佳质量)
- **代码生成**: GPT-4 Turbo (快速)
- **中文对话**: GLM-4 或 Qwen2.5 (中文优化)
- **代码补全**: Qwen2.5-Coder (专门优化)
- **本地开发**: Ollama (免费)

## 10. 下一步

- 📖 阅读 [完整文档](./PHASE_1_MVP_COMPLETE.md)
- 🔧 配置更多 AI 提供商
- 📊 查看使用统计和成本
- 🚀 集成到你的工作流
- 🎯 探索高级功能（RAG, Function Calling）

## 相关资源

- [需求文档](./requirements.md)
- [设计文档](./design.md)
- [任务列表](./tasks.md)
- [Phase 1 完成报告](./PHASE_1_MVP_COMPLETE.md)
- [API 参考](../../../docs/API_REFERENCE.md)

## 支持

如有问题，请查看：

1. [故障排查文档](../../../docs/troubleshooting/README.md)
2. [架构文档](../../../docs/ARCHITECTURE.md)
3. 项目 Issues

---

**祝你使用愉快！** 🎉
