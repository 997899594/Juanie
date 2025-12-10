import { ErrorFactory } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { QdrantClient } from '@qdrant/js-client-rest'

/**
 * 文档接口
 */
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

/**
 * 搜索结果接口
 */
export interface SearchResult {
  document: Document
  score: number
}

/**
 * RAG (Retrieval-Augmented Generation) 服务
 * 提供文档嵌入、语义搜索和提示词增强功能
 */
@Injectable()
export class RAGService {
  private qdrant: QdrantClient

  constructor(private readonly configService: ConfigService) {
    const qdrantUrl = this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333'
    const qdrantApiKey = this.configService.get<string>('QDRANT_API_KEY')

    this.qdrant = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    })
  }

  /**
   * 嵌入文档到向量数据库
   * @param document - 要嵌入的文档
   */
  async embedDocument(document: Document): Promise<void> {
    try {
      // 生成文档的向量嵌入
      const embedding = await this.generateEmbedding(document.content)

      // 确保集合存在
      await this.ensureCollection(document.metadata.projectId)

      // 将文档向量存储到 Qdrant
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
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to embed document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 语义搜索文档
   * @param query - 搜索查询
   * @param projectId - 项目 ID (用于数据隔离)
   * @param limit - 返回结果数量限制
   * @returns 搜索结果列表
   */
  async search(query: string, projectId: string, limit = 5): Promise<SearchResult[]> {
    try {
      // 生成查询的向量嵌入
      const queryEmbedding = await this.generateEmbedding(query)

      // 在指定项目的集合中搜索
      const results = await this.qdrant.search(projectId, {
        vector: queryEmbedding,
        limit,
        with_payload: true,
      })

      // 转换搜索结果
      return results.map((result) => ({
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
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 增强提示词
   * 通过检索相关文档来增强用户查询
   * @param query - 用户查询
   * @param projectId - 项目 ID
   * @returns 增强后的提示词
   */
  async enhancePrompt(query: string, projectId: string): Promise<string> {
    try {
      // 搜索相关文档
      const relevantDocs = await this.search(query, projectId, 3)

      // 如果没有找到相关文档,返回原始查询
      if (relevantDocs.length === 0) {
        return query
      }

      // 构建上下文
      const context = relevantDocs
        .map((doc) => `[${doc.document.metadata.path}]\n${doc.document.content}`)
        .join('\n\n---\n\n')

      // 返回增强后的提示词
      return `基于以下项目上下文回答问题:\n\n${context}\n\n问题: ${query}`
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to enhance prompt: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 生成文本的向量嵌入
   * 使用 OpenAI text-embedding-3-small 模型
   * @param text - 要嵌入的文本
   * @returns 向量数组
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // 使用 OpenAI 的嵌入模型
      // 注意: 这里需要使用 OpenAI SDK 的嵌入 API
      // 由于 Vercel AI SDK 主要用于文本生成,我们需要直接使用 OpenAI SDK
      const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY')
      if (!openaiApiKey) {
        throw ErrorFactory.ai.inferenceFailed('OpenAI API key not configured for embeddings')
      }

      // 调用 OpenAI 嵌入 API
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const data = (await response.json()) as { data: Array<{ embedding: number[] }> }
      if (!data.data?.[0]?.embedding) {
        throw new Error('Invalid embedding response from OpenAI')
      }
      return data.data[0].embedding
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 确保集合存在
   * 如果集合不存在,则创建它
   * @param collectionName - 集合名称 (通常是项目 ID)
   */
  private async ensureCollection(collectionName: string): Promise<void> {
    try {
      // 检查集合是否存在
      const collections = await this.qdrant.getCollections()
      const exists = collections.collections.some((c) => c.name === collectionName)

      if (!exists) {
        // 创建集合
        // text-embedding-3-small 的向量维度是 1536
        await this.qdrant.createCollection(collectionName, {
          vectors: {
            size: 1536,
            distance: 'Cosine',
          },
        })
      }
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to ensure collection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 删除文档
   * @param documentId - 文档 ID
   * @param projectId - 项目 ID
   */
  async deleteDocument(documentId: string, projectId: string): Promise<void> {
    try {
      await this.qdrant.delete(projectId, {
        wait: true,
        points: [documentId],
      })
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 删除项目的所有文档
   * @param projectId - 项目 ID
   */
  async deleteProjectDocuments(projectId: string): Promise<void> {
    try {
      // 删除整个集合
      await this.qdrant.deleteCollection(projectId)
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to delete project documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}
