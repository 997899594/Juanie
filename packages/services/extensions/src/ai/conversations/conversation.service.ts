import { DATABASE } from '@juanie/core/tokens'
import type { AIConversation, NewAIConversation } from '@juanie/database'
import * as schema from '@juanie/database'
import type { AIMessage } from '@juanie/types'
import { ErrorFactory } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, ilike, or } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * 对话历史管理服务
 * 提供对话的 CRUD 操作、搜索和上下文管理功能
 */
@Injectable()
export class ConversationService {
  constructor(@Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * 创建新对话
   * @param data - 对话数据
   * @returns 创建的对话
   */
  async create(
    data: Omit<NewAIConversation, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AIConversation> {
    try {
      const [conversation] = await this.db.insert(schema.aiConversations).values(data).returning()

      if (!conversation) {
        throw ErrorFactory.ai.inferenceFailed('Failed to create conversation: No data returned')
      }

      return conversation
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 根据 ID 查询对话
   * @param id - 对话 ID
   * @returns 对话或 null
   */
  async findById(id: string): Promise<AIConversation | null> {
    try {
      const [conversation] = await this.db
        .select()
        .from(schema.aiConversations)
        .where(eq(schema.aiConversations.id, id))

      return conversation || null
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to find conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 根据用户 ID 查询对话列表
   * @param userId - 用户 ID
   * @returns 对话列表
   */
  async findByUser(userId: string): Promise<AIConversation[]> {
    try {
      const conversations = await this.db
        .select()
        .from(schema.aiConversations)
        .where(eq(schema.aiConversations.userId, userId))
        .orderBy(desc(schema.aiConversations.updatedAt))

      return conversations
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to find conversations by user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 根据项目 ID 查询对话列表
   * @param projectId - 项目 ID
   * @returns 对话列表
   */
  async findByProject(projectId: string): Promise<AIConversation[]> {
    try {
      const conversations = await this.db
        .select()
        .from(schema.aiConversations)
        .where(eq(schema.aiConversations.projectId, projectId))
        .orderBy(desc(schema.aiConversations.updatedAt))

      return conversations
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to find conversations by project: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 搜索对话
   * 在标题和消息内容中搜索关键词
   * @param userId - 用户 ID
   * @param keyword - 搜索关键词
   * @returns 匹配的对话列表
   */
  async search(userId: string, keyword: string): Promise<AIConversation[]> {
    try {
      const conversations = await this.db
        .select()
        .from(schema.aiConversations)
        .where(
          and(
            eq(schema.aiConversations.userId, userId),
            or(
              ilike(schema.aiConversations.title, `%${keyword}%`),
              // 注意: 在 PostgreSQL 中搜索 JSONB 字段需要使用特殊的操作符
              // 这里简化处理,实际应该使用 @> 或 jsonb_path_query
            ),
          ),
        )
        .orderBy(desc(schema.aiConversations.updatedAt))

      // 在内存中过滤消息内容
      return conversations.filter((conv: AIConversation) => {
        const messages = conv.messages as AIMessage[]
        return messages.some((msg) => msg.content.toLowerCase().includes(keyword.toLowerCase()))
      })
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to search conversations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 添加消息到对话
   * @param conversationId - 对话 ID
   * @param message - 新消息
   * @returns 更新后的对话
   */
  async addMessage(conversationId: string, message: AIMessage): Promise<AIConversation> {
    const conversation = await this.findById(conversationId)
    if (!conversation) {
      throw ErrorFactory.ai.inferenceFailed(`Conversation ${conversationId} not found`)
    }

    const messages = conversation.messages as AIMessage[]
    const updatedMessages = [...messages, message]

    return this.update(conversationId, { messages: updatedMessages })
  }

  /**
   * 获取对话上下文
   * 返回最近的 N 条消息作为上下文
   * @param conversationId - 对话 ID
   * @param limit - 消息数量限制 (默认 10)
   * @returns 最近的消息列表
   */
  async getContext(conversationId: string, limit = 10): Promise<AIMessage[]> {
    const conversation = await this.findById(conversationId)
    if (!conversation) {
      throw ErrorFactory.ai.inferenceFailed(`Conversation ${conversationId} not found`)
    }

    const messages = conversation.messages as AIMessage[]

    // 返回最近的 N 条消息
    return messages.slice(-limit)
  }

  /**
   * 更新对话
   * @param id - 对话 ID
   * @param data - 更新数据
   * @returns 更新后的对话
   */
  async update(
    id: string,
    data: Partial<Omit<AIConversation, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<AIConversation> {
    try {
      const [updated] = await this.db
        .update(schema.aiConversations)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(schema.aiConversations.id, id))
        .returning()

      if (!updated) {
        throw ErrorFactory.ai.inferenceFailed(`Conversation ${id} not found`)
      }

      return updated
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to update conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 删除对话
   * @param id - 对话 ID
   */
  async delete(id: string): Promise<void> {
    try {
      await this.db.delete(schema.aiConversations).where(eq(schema.aiConversations.id, id))
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to delete conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 删除用户的所有对话
   * @param userId - 用户 ID
   */
  async deleteByUser(userId: string): Promise<void> {
    try {
      await this.db.delete(schema.aiConversations).where(eq(schema.aiConversations.userId, userId))
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to delete user conversations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 删除项目的所有对话
   * @param projectId - 项目 ID
   */
  async deleteByProject(projectId: string): Promise<void> {
    try {
      await this.db
        .delete(schema.aiConversations)
        .where(eq(schema.aiConversations.projectId, projectId))
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to delete project conversations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}
