import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import { eq, and, or, desc, asc, count, inArray, isNull, like, sql } from 'drizzle-orm';
import {
  aiAssistants,
  AiAssistant,
  NewAiAssistant,
  UpdateAiAssistant,
  AiAssistantPublic,
  insertAiAssistantSchema,
  selectAiAssistantSchema,
  updateAiAssistantSchema,
  aiAssistantPublicSchema
} from '../../database/schemas/ai-assistants.schema';
import { z } from 'zod';

// AI 相关类型定义
export enum AIProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  AZURE_OPENAI = 'azure_openai',
}

export interface AIModelConfig {
  name: string;
  provider: AIProvider;
  maxTokens: number;
  supportsFunctions: boolean;
  costPer1kTokens: {
    input: number;
    output: number;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: AIProvider;
}

export interface CreateChatCompletionInput {
  messages: ChatMessage[];
  provider: AIProvider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}

export const createChatCompletionSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  provider: z.nativeEnum(AIProvider),
  model: z.string().optional(),
  maxTokens: z.number().min(1).max(32000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional(),
});

// 业务逻辑类型
export interface AiAssistantStats {
  totalAssistants: number;
  activeAssistants: number;
  publicAssistants: number;
  assistantsByType: Record<string, number>;
  assistantsByProvider: Record<string, number>;
  averageRating: number;
  totalUsage: number;
}

export interface AiAssistantSearchFilters {
  type?: string;
  specialization?: string;
  provider?: string;
  isPublic?: boolean;
  isActive?: boolean;
  organizationId?: string;
  createdBy?: string;
  minRating?: number;
  capabilities?: string[];
}

@Injectable()
export class AiAssistantsService {
  private readonly logger = new Logger(AiAssistantsService.name);

  constructor(
    @InjectDatabase() private readonly db: Database,
  ) {}

  /**
   * 创建AI助手
   */
  async createAiAssistant(data: NewAiAssistant): Promise<AiAssistant> {
    try {
      // 验证输入数据
      const validatedData = insertAiAssistantSchema.parse(data);

      const [assistant] = await this.db
        .insert(aiAssistants)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      this.logger.log(`Created AI assistant: ${assistant.id}`);
      return assistant;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create AI assistant: ${errorMessage}`);
      throw new BadRequestException('Failed to create AI assistant');
    }
  }

  /**
   * 根据ID获取AI助手
   */
  async getAiAssistantById(id: string): Promise<AiAssistant | null> {
    try {
      const [assistant] = await this.db
        .select()
        .from(aiAssistants)
        .where(eq(aiAssistants.id, id))
        .limit(1);

      return assistant || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get AI assistant by ID: ${errorMessage}`);
      throw new BadRequestException('Failed to get AI assistant');
    }
  }

  /**
   * 获取公开的AI助手信息
   */
  async getPublicAiAssistant(id: string): Promise<AiAssistantPublic | null> {
    try {
      const [assistant] = await this.db
        .select()
        .from(aiAssistants)
        .where(and(
          eq(aiAssistants.id, id),
          eq(aiAssistants.isPublic, true),
          eq(aiAssistants.isActive, true)
        ))
        .limit(1);

      if (!assistant) return null;

      return aiAssistantPublicSchema.parse(assistant);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get public AI assistant: ${errorMessage}`);
      throw new BadRequestException('Failed to get public AI assistant');
    }
  }

  /**
   * 根据创建者获取AI助手列表
   */
  async getAiAssistantsByCreator(
    createdBy: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AiAssistant[]> {
    try {
      return await this.db
        .select()
        .from(aiAssistants)
        .where(eq(aiAssistants.createdBy, createdBy))
        .orderBy(desc(aiAssistants.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get AI assistants by creator: ${errorMessage}`);
      throw new BadRequestException('Failed to get AI assistants by creator');
    }
  }

  /**
   * 根据组织获取AI助手列表
   */
  async getAiAssistantsByOrganization(
    organizationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AiAssistant[]> {
    try {
      return await this.db
        .select()
        .from(aiAssistants)
        .where(eq(aiAssistants.organizationId, organizationId))
        .orderBy(desc(aiAssistants.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get AI assistants by organization: ${errorMessage}`);
      throw new BadRequestException('Failed to get AI assistants by organization');
    }
  }

  /**
   * 根据类型获取AI助手列表
   */
  async getAiAssistantsByType(
    type: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AiAssistant[]> {
    try {
      return await this.db
        .select()
        .from(aiAssistants)
        .where(and(
          eq(aiAssistants.type, type),
          eq(aiAssistants.isActive, true)
        ))
        .orderBy(desc(aiAssistants.usageCount))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get AI assistants by type: ${errorMessage}`);
      throw new BadRequestException('Failed to get AI assistants by type');
    }
  }

  /**
   * 获取公开的AI助手列表
   */
  async getPublicAiAssistants(
    limit: number = 50,
    offset: number = 0
  ): Promise<AiAssistantPublic[]> {
    try {
      const assistants = await this.db
        .select()
        .from(aiAssistants)
        .where(and(
          eq(aiAssistants.isPublic, true),
          eq(aiAssistants.isActive, true)
        ))
        .orderBy(desc(aiAssistants.averageRating), desc(aiAssistants.usageCount))
        .limit(limit)
        .offset(offset);

      return assistants.map(assistant => aiAssistantPublicSchema.parse(assistant));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get public AI assistants: ${errorMessage}`);
      throw new BadRequestException('Failed to get public AI assistants');
    }
  }

  /**
   * 搜索AI助手
   */
  async searchAiAssistants(
    query: string,
    filters: AiAssistantSearchFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<AiAssistant[]> {
    try {
      let whereConditions = [];

      // 文本搜索
      if (query) {
        whereConditions.push(
          or(
            like(aiAssistants.name, `%${query}%`),
            like(aiAssistants.description, `%${query}%`)
          )
        );
      }

      // 过滤条件
      if (filters.type) {
        whereConditions.push(eq(aiAssistants.type, filters.type));
      }
      if (filters.specialization) {
        whereConditions.push(eq(aiAssistants.specialization, filters.specialization));
      }
      if (filters.isPublic !== undefined) {
        whereConditions.push(eq(aiAssistants.isPublic, filters.isPublic));
      }
      if (filters.isActive !== undefined) {
        whereConditions.push(eq(aiAssistants.isActive, filters.isActive));
      }
      if (filters.organizationId) {
        whereConditions.push(eq(aiAssistants.organizationId, filters.organizationId));
      }
      if (filters.createdBy) {
        whereConditions.push(eq(aiAssistants.createdBy, filters.createdBy));
      }
      if (filters.minRating) {
        whereConditions.push(sql`${aiAssistants.averageRating} >= ${filters.minRating}`);
      }

      return await this.db
        .select()
        .from(aiAssistants)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(aiAssistants.averageRating), desc(aiAssistants.usageCount))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to search AI assistants: ${errorMessage}`);
      throw new BadRequestException('Failed to search AI assistants');
    }
  }

  /**
   * 更新AI助手
   */
  async updateAiAssistant(
    id: string,
    data: UpdateAiAssistant
  ): Promise<AiAssistant | null> {
    try {
      // 验证输入数据
      const validatedData = updateAiAssistantSchema.parse(data);

      const [updatedAssistant] = await this.db
        .update(aiAssistants)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(aiAssistants.id, id))
        .returning();

      if (!updatedAssistant) {
        throw new NotFoundException('AI assistant not found');
      }

      this.logger.log(`Updated AI assistant: ${id}`);
      return updatedAssistant;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update AI assistant: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update AI assistant');
    }
  }

  /**
   * 切换AI助手状态
   */
  async toggleAiAssistant(id: string, isActive: boolean): Promise<boolean> {
    try {
      const [updatedAssistant] = await this.db
        .update(aiAssistants)
        .set({
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(aiAssistants.id, id))
        .returning();

      if (!updatedAssistant) {
        throw new NotFoundException('AI assistant not found');
      }

      this.logger.log(`Toggled AI assistant ${id} to ${isActive ? 'active' : 'inactive'}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to toggle AI assistant: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to toggle AI assistant');
    }
  }

  /**
   * 删除AI助手
   */
  async deleteAiAssistant(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(aiAssistants)
        .where(eq(aiAssistants.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundException('AI assistant not found');
      }

      this.logger.log(`Deleted AI assistant: ${id}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete AI assistant: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete AI assistant');
    }
  }

  /**
   * 批量删除AI助手
   */
  async batchDeleteAiAssistants(ids: string[]): Promise<number> {
    try {
      const result = await this.db
        .delete(aiAssistants)
        .where(inArray(aiAssistants.id, ids))
        .returning();

      this.logger.log(`Batch deleted ${result.length} AI assistants`);
      return result.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to batch delete AI assistants: ${errorMessage}`);
      throw new BadRequestException('Failed to batch delete AI assistants');
    }
  }

  /**
   * 记录使用次数
   */
  async recordUsage(id: string): Promise<boolean> {
    try {
      const [updatedAssistant] = await this.db
        .update(aiAssistants)
        .set({
          usageCount: sql`${aiAssistants.usageCount} + 1`,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiAssistants.id, id))
        .returning();

      if (!updatedAssistant) {
        throw new NotFoundException('AI assistant not found');
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to record usage: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to record usage');
    }
  }

  /**
   * 更新评分
   */
  async updateRating(id: string, rating: number): Promise<boolean> {
    try {
      if (rating < 1 || rating > 5) {
        throw new BadRequestException('Rating must be between 1 and 5');
      }

      const [updatedAssistant] = await this.db
        .update(aiAssistants)
        .set({
          averageRating: rating,
          updatedAt: new Date(),
        })
        .where(eq(aiAssistants.id, id))
        .returning();

      if (!updatedAssistant) {
        throw new NotFoundException('AI assistant not found');
      }

      this.logger.log(`Updated rating for AI assistant ${id} to ${rating}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update rating: ${errorMessage}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update rating');
    }
  }

  /**
   * 获取AI助手统计信息
   */
  async getAiAssistantStats(organizationId?: string): Promise<AiAssistantStats> {
    try {
      const whereCondition = organizationId 
        ? eq(aiAssistants.organizationId, organizationId)
        : undefined;

      // 总数统计
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(aiAssistants)
        .where(whereCondition);

      const [activeResult] = await this.db
        .select({ count: count() })
        .from(aiAssistants)
        .where(whereCondition ? and(whereCondition, eq(aiAssistants.isActive, true)) : eq(aiAssistants.isActive, true));

      const [publicResult] = await this.db
        .select({ count: count() })
        .from(aiAssistants)
        .where(whereCondition ? and(whereCondition, eq(aiAssistants.isPublic, true)) : eq(aiAssistants.isPublic, true));

      // 按类型统计
      const typeStats = await this.db
        .select({
          type: aiAssistants.type,
          count: count()
        })
        .from(aiAssistants)
        .where(whereCondition)
        .groupBy(aiAssistants.type);

      // 按提供商统计
      const providerStats = await this.db
        .select({
          provider: sql<string>`${aiAssistants.modelConfig}->>'provider'`,
          count: count()
        })
        .from(aiAssistants)
        .where(whereCondition)
        .groupBy(sql`${aiAssistants.modelConfig}->>'provider'`);

      // 平均评分和总使用量
      const [avgRatingResult] = await this.db
        .select({
          avgRating: sql<number>`AVG(${aiAssistants.averageRating})`,
          totalUsage: sql<number>`SUM(${aiAssistants.usageCount})`
        })
        .from(aiAssistants)
        .where(whereCondition);

      return {
        totalAssistants: totalResult.count,
        activeAssistants: activeResult.count,
        publicAssistants: publicResult.count,
        assistantsByType: typeStats.reduce((acc, stat) => {
          acc[stat.type] = stat.count;
          return acc;
        }, {} as Record<string, number>),
        assistantsByProvider: providerStats.reduce((acc, stat) => {
          acc[stat.provider] = stat.count;
          return acc;
        }, {} as Record<string, number>),
        averageRating: avgRatingResult.avgRating || 0,
        totalUsage: avgRatingResult.totalUsage || 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get AI assistant stats: ${errorMessage}`);
      throw new BadRequestException('Failed to get AI assistant stats');
    }
  }

  /**
   * 复制AI助手
   */
  async duplicateAiAssistant(
    id: string,
    newName: string,
    createdBy: string
  ): Promise<AiAssistant | null> {
    try {
      const originalAssistant = await this.getAiAssistantById(id);
      if (!originalAssistant) {
        throw new NotFoundException('Original AI assistant not found');
      }

      const duplicateData: NewAiAssistant = {
        name: newName,
        description: originalAssistant.description,
        avatar: originalAssistant.avatar,
        type: originalAssistant.type,
        specialization: originalAssistant.specialization,
        modelType: originalAssistant.modelType,
        modelConfig: originalAssistant.modelConfig,
        capabilities: originalAssistant.capabilities,
        isPublic: false, // 复制的助手默认为私有
        isActive: true,
        createdBy,
        organizationId: originalAssistant.organizationId,
      };

      return await this.createAiAssistant(duplicateData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to duplicate AI assistant: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to duplicate AI assistant');
    }
  }

  /**
   * 获取AI助手数量
   */
  async getAiAssistantCount(
    organizationId?: string,
    isActive?: boolean
  ): Promise<number> {
    try {
      let whereConditions = [];

      if (organizationId) {
        whereConditions.push(eq(aiAssistants.organizationId, organizationId));
      }
      if (isActive !== undefined) {
        whereConditions.push(eq(aiAssistants.isActive, isActive));
      }

      const [result] = await this.db
        .select({ count: count() })
        .from(aiAssistants)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

      return result.count;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get AI assistant count: ${errorMessage}`);
      throw new BadRequestException('Failed to get AI assistant count');
    }
  }

  /**
   * 验证AI助手数据
   */
  async validateAiAssistant(assistant: Partial<AiAssistant>): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    try {
      const errors: string[] = [];

      // 基本验证
      if (!assistant.name || assistant.name.trim().length === 0) {
        errors.push('Name is required');
      }
      if (!assistant.type) {
        errors.push('Type is required');
      }
      if (!assistant.modelType) {
        errors.push('Model type is required');
      }
      if (!assistant.modelConfig) {
        errors.push('Model config is required');
      }

      // 评分验证
      if (assistant.averageRating !== null && assistant.averageRating !== undefined) {
        if (assistant.averageRating < 1 || assistant.averageRating > 5) {
          errors.push('Average rating must be between 1 and 5');
        }
      }

      // 使用次数验证
      if (assistant.usageCount !== null && assistant.usageCount !== undefined) {
        if (assistant.usageCount < 0) {
          errors.push('Usage count cannot be negative');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to validate AI assistant: ${errorMessage}`);
      return {
        isValid: false,
        errors: ['Validation failed'],
      };
    }
  }

  /**
   * OpenAI聊天完成
   */
  private async createOpenAIChatCompletion(input: CreateChatCompletionInput, model: string): Promise<AIResponse> {
    // 这里应该实现实际的OpenAI API调用
    // 暂时返回模拟响应
    this.logger.debug('Creating OpenAI chat completion (mock)');
    
    return {
      content: 'This is a mock response from OpenAI. Please implement the actual OpenAI API integration.',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      model,
      provider: AIProvider.OPENAI,
    };
  }

  /**
   * Anthropic聊天完成
   */
  private async createAnthropicChatCompletion(input: CreateChatCompletionInput, model: string): Promise<AIResponse> {
    // 这里应该实现实际的Anthropic API调用
    this.logger.debug('Creating Anthropic chat completion (mock)');
    
    return {
      content: 'This is a mock response from Anthropic. Please implement the actual Anthropic API integration.',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      model,
      provider: AIProvider.ANTHROPIC,
    };
  }

  /**
   * Google聊天完成
   */
  private async createGoogleChatCompletion(input: CreateChatCompletionInput, model: string): Promise<AIResponse> {
    // 这里应该实现实际的Google AI API调用
    this.logger.debug('Creating Google chat completion (mock)');
    
    return {
      content: 'This is a mock response from Google AI. Please implement the actual Google AI API integration.',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      model,
      provider: AIProvider.GOOGLE,
    };
  }

  /**
   * Azure OpenAI聊天完成
   */
  private async createAzureOpenAIChatCompletion(input: CreateChatCompletionInput, model: string): Promise<AIResponse> {
    // 这里应该实现实际的Azure OpenAI API调用
    this.logger.debug('Creating Azure OpenAI chat completion (mock)');
    
    return {
      content: 'This is a mock response from Azure OpenAI. Please implement the actual Azure OpenAI API integration.',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      model,
      provider: AIProvider.AZURE_OPENAI,
    };
  }

  /**
   * 获取默认模型
   */
  private getDefaultModel(provider: AIProvider): string {
    switch (provider) {
      case AIProvider.OPENAI:
        return 'gpt-4o-mini';
      case AIProvider.ANTHROPIC:
        return 'claude-3-5-sonnet-20241022';
      case AIProvider.GOOGLE:
        return 'gemini-1.5-flash';
      case AIProvider.AZURE_OPENAI:
        return 'gpt-4o-mini';
      default:
        return 'gpt-4o-mini';
    }
  }
}