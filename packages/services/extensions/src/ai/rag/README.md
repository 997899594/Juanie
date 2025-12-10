# RAG (Retrieval-Augmented Generation) 服务

提供文档嵌入、语义搜索和提示词增强功能,用于实现基于检索的 AI 增强。

## 功能

- **文档嵌入**: 将文档转换为向量并存储到 Qdrant 向量数据库
- **语义搜索**: 基于语义相似度搜索相关文档
- **提示词增强**: 通过检索相关文档来增强用户查询
- **项目隔离**: 每个项目的文档存储在独立的集合中,确保数据隔离

## 使用示例

### 嵌入文档

```typescript
import { RAGService } from '@juanie/service-extensions'

const ragService = new RAGService(configService)

await ragService.embedDocument({
  id: 'doc-123',
  content: 'export function hello() { return "Hello World"; }',
  metadata: {
    projectId: 'project-456',
    type: 'code',
    path: 'src/utils/hello.ts',
    language: 'typescript',
  },
})
```

### 语义搜索

```typescript
const results = await ragService.search(
  'How to implement hello function?',
  'project-456',
  5, // 返回前 5 个结果
)

results.forEach((result) => {
  console.log(`Score: ${result.score}`)
  console.log(`Path: ${result.document.metadata.path}`)
  console.log(`Content: ${result.document.content}`)
})
```

### 提示词增强

```typescript
const enhancedPrompt = await ragService.enhancePrompt(
  'How to implement authentication?',
  'project-456',
)

// enhancedPrompt 将包含相关文档的上下文
// 格式:
// 基于以下项目上下文回答问题:
//
// [src/auth/auth.service.ts]
// export class AuthService { ... }
//
// ---
//
// [src/auth/jwt.strategy.ts]
// export class JwtStrategy { ... }
//
// 问题: How to implement authentication?
```

### 删除文档

```typescript
// 删除单个文档
await ragService.deleteDocument('doc-123', 'project-456')

// 删除项目的所有文档
await ragService.deleteProjectDocuments('project-456')
```

## 数据模型

### Document 接口

```typescript
interface Document {
  id: string // 文档唯一标识
  content: string // 文档内容
  metadata: {
    projectId: string // 项目 ID
    type: 'code' | 'doc' | 'config' // 文档类型
    path: string // 文件路径
    language?: string // 编程语言 (可选)
  }
}
```

### SearchResult 接口

```typescript
interface SearchResult {
  document: Document // 文档信息
  score: number // 相似度分数 (0-1)
}
```

## 向量嵌入

RAG 服务使用 OpenAI 的 `text-embedding-3-small` 模型生成文档向量:

- **模型**: text-embedding-3-small
- **向量维度**: 1536
- **距离度量**: Cosine (余弦相似度)

## 项目隔离

每个项目的文档存储在独立的 Qdrant 集合中:

- 集合名称 = 项目 ID
- 搜索时只在指定项目的集合中查询
- 确保项目 A 的搜索不会返回项目 B 的文档

## 环境变量

```bash
# Qdrant 向量数据库
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# OpenAI (用于生成嵌入)
OPENAI_API_KEY=your_openai_api_key
```

## 错误处理

所有方法在失败时都会抛出 `AppError`:

```typescript
try {
  await ragService.embedDocument(document)
} catch (error) {
  // error.code: 'AI_INFERENCE_FAILED'
  // error.message: 详细错误信息
}
```

## 性能考虑

### 嵌入性能

- 每次嵌入调用 OpenAI API,有网络延迟
- 建议批量处理文档嵌入
- 考虑使用队列异步处理大量文档

### 搜索性能

- Qdrant 提供高性能向量搜索
- 搜索时间与集合大小和 `limit` 参数相关
- 建议 `limit` 设置为 3-10 个结果

### 缓存策略

- 考虑缓存常见查询的搜索结果
- 文档内容变更时需要重新嵌入

## 集成

`RAGService` 已在 `AIModule` 中注册,可以通过依赖注入使用:

```typescript
import { Injectable } from '@nestjs/common'
import { RAGService } from '@juanie/service-extensions'

@Injectable()
export class MyService {
  constructor(private ragService: RAGService) {}

  async searchDocs(query: string, projectId: string) {
    return await this.ragService.search(query, projectId)
  }
}
```

## 最佳实践

1. **文档分块**: 将大文件分成小块(如 500-1000 字符)以提高检索精度
2. **元数据丰富**: 在 metadata 中包含尽可能多的上下文信息
3. **定期清理**: 删除过时或无用的文档以保持集合质量
4. **监控使用**: 跟踪嵌入 API 调用次数和成本
5. **错误重试**: 网络错误时实现重试机制

## 未来扩展

- 支持更多嵌入模型 (如本地模型)
- 实现文档分块策略
- 添加文档更新检测
- 支持混合搜索 (向量 + 关键词)
- 实现文档版本管理
