import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import { eq, and, desc, asc, count, sql, ilike, inArray, gte, lte } from 'drizzle-orm';
import { 
  aiRecommendations,
  AiRecommendation,
  NewAiRecommendation,
  UpdateAiRecommendation,
  ContextType,
  RecommendationPriority,
  UserFeedback
} from '../../database/schemas/ai-recommendations.schema';
import { aiAssistants } from '../../database/schemas/ai-assistants.schema';

export interface AiRecommendationStats {
  total: number;
  byPriority: Record<RecommendationPriority, number>;
  byContextType: Record<ContextType, number>;
  byFeedback: Record<UserFeedback, number>;
  averageConfidenceScore: number;
  acceptanceRate: number;
}

export interface AiRecommendationSearchFilters {
  assistantId?: string;
  contextType?: ContextType;
  contextId?: number;
  recommendationType?: string;
  priority?: RecommendationPriority;
  userFeedback?: UserFeedback;
  minConfidenceScore?: number;
  maxConfidenceScore?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class AiRecommendationsService {
  private readonly logger = new Logger(AiRecommendationsService.name);

  constructor(
    @InjectDatabase() private readonly db: Database,
  ) {}

  // 创建AI推荐
  async createAiRecommendation(data: NewAiRecommendation): Promise<AiRecommendation> {
    try {
      const [recommendation] = await this.db
        .insert(aiRecommendations)
        .values({
          ...data,
        })
        .returning();
      
      this.logger.log(`Created AI recommendation: ${recommendation.id}`);
      return recommendation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create AI recommendation: ${errorMessage}`);
      throw new BadRequestException('Failed to create AI recommendation');
    }
  }

  // 根据ID获取AI推荐
  async getAiRecommendationById(id: string): Promise<AiRecommendation | null> {
    try {
      const [recommendation] = await this.db
        .select()
        .from(aiRecommendations)
        .where(eq(aiRecommendations.id, id))
        .limit(1);
      return recommendation || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get AI recommendation by ID: ${errorMessage}`);
      throw new BadRequestException('Failed to get AI recommendation');
    }
  }

  // 根据助手ID获取推荐列表
  async getRecommendationsByAssistant(
    assistantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AiRecommendation[]> {
    try {
      return await this.db
        .select()
        .from(aiRecommendations)
        .where(eq(aiRecommendations.assistantId, assistantId))
        .orderBy(desc(aiRecommendations.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get recommendations by assistant: ${errorMessage}`);
      throw new BadRequestException('Failed to get recommendations by assistant');
    }
  }

  // 根据上下文获取推荐列表
  async getRecommendationsByContext(
    contextType: ContextType,
    contextId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<AiRecommendation[]> {
    try {
      return await this.db
        .select()
        .from(aiRecommendations)
        .where(and(
          eq(aiRecommendations.contextType, contextType),
          eq(aiRecommendations.contextId, contextId)
        ))
        .orderBy(desc(aiRecommendations.priority), desc(aiRecommendations.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get recommendations by context: ${errorMessage}`);
      throw new BadRequestException('Failed to get recommendations by context');
    }
  }

  // 根据优先级获取推荐列表
  async getRecommendationsByPriority(
    priority: RecommendationPriority,
    limit: number = 50,
    offset: number = 0
  ): Promise<AiRecommendation[]> {
    try {
      return await this.db
        .select()
        .from(aiRecommendations)
        .where(eq(aiRecommendations.priority, priority))
        .orderBy(desc(aiRecommendations.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get recommendations by priority: ${errorMessage}`);
      throw new BadRequestException('Failed to get recommendations by priority');
    }
  }

  // 搜索推荐
  async searchRecommendations(
    query: string,
    filters?: AiRecommendationSearchFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<AiRecommendation[]> {
    try {
      let whereConditions = [
        ilike(aiRecommendations.title, `%${query}%`)
      ];

      if (filters) {
        if (filters.assistantId) {
          whereConditions.push(eq(aiRecommendations.assistantId, filters.assistantId));
        }
        if (filters.contextType) {
          whereConditions.push(eq(aiRecommendations.contextType, filters.contextType));
        }
        if (filters.contextId !== undefined) {
          whereConditions.push(eq(aiRecommendations.contextId, filters.contextId));
        }
        if (filters.recommendationType) {
          whereConditions.push(eq(aiRecommendations.recommendationType, filters.recommendationType));
        }
        if (filters.priority) {
          whereConditions.push(eq(aiRecommendations.priority, filters.priority));
        }
        if (filters.userFeedback) {
          whereConditions.push(eq(aiRecommendations.userFeedback, filters.userFeedback));
        }
        if (filters.minConfidenceScore !== undefined) {
          whereConditions.push(gte(aiRecommendations.confidenceScore, filters.minConfidenceScore.toString()));
        }
        if (filters.maxConfidenceScore !== undefined) {
          whereConditions.push(lte(aiRecommendations.confidenceScore, filters.maxConfidenceScore.toString()));
        }
        if (filters.dateFrom) {
          whereConditions.push(gte(aiRecommendations.createdAt, filters.dateFrom));
        }
        if (filters.dateTo) {
          whereConditions.push(lte(aiRecommendations.createdAt, filters.dateTo));
        }
      }

      return await this.db
        .select()
        .from(aiRecommendations)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(aiRecommendations.priority), desc(aiRecommendations.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to search recommendations: ${errorMessage}`);
      throw new BadRequestException('Failed to search recommendations');
    }
  }

  // 更新AI推荐
  async updateAiRecommendation(
    id: string,
    data: UpdateAiRecommendation
  ): Promise<AiRecommendation | null> {
    try {
      const [updatedRecommendation] = await this.db
        .update(aiRecommendations)
        .set(data)
        .where(eq(aiRecommendations.id, id))
        .returning();

      if (!updatedRecommendation) {
        throw new NotFoundException('AI recommendation not found');
      }

      this.logger.log(`Updated AI recommendation: ${id}`);
      return updatedRecommendation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update AI recommendation: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update AI recommendation');
    }
  }

  // 删除AI推荐
  async deleteAiRecommendation(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(aiRecommendations)
        .where(eq(aiRecommendations.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundException('AI recommendation not found');
      }

      this.logger.log(`Deleted AI recommendation: ${id}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete AI recommendation: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete AI recommendation');
    }
  }

  // 批量删除推荐
  async batchDeleteRecommendations(ids: string[]): Promise<number> {
    try {
      const result = await this.db
        .delete(aiRecommendations)
        .where(inArray(aiRecommendations.id, ids))
        .returning();

      this.logger.log(`Batch deleted ${result.length} AI recommendations`);
      return result.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to batch delete recommendations: ${errorMessage}`);
      throw new BadRequestException('Failed to batch delete recommendations');
    }
  }

  // 提交用户反馈
  async submitUserFeedback(
    id: string,
    feedback: UserFeedback,
    rating?: number,
    comment?: string
  ): Promise<boolean> {
    try {
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        throw new BadRequestException('Rating must be between 1 and 5');
      }

      const [updatedRecommendation] = await this.db
        .update(aiRecommendations)
        .set({
          userFeedback: feedback,
          feedbackNotes: comment,
        })
        .where(eq(aiRecommendations.id, id))
        .returning();

      if (!updatedRecommendation) {
        throw new NotFoundException('AI recommendation not found');
      }

      this.logger.log(`Submitted feedback for AI recommendation: ${id}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to submit user feedback: ${errorMessage}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to submit user feedback');
    }
  }

  // 获取推荐统计信息
  async getRecommendationStats(assistantId?: string): Promise<AiRecommendationStats> {
    try {
      const whereCondition = assistantId 
        ? eq(aiRecommendations.assistantId, assistantId)
        : undefined;

      // 总数统计
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(aiRecommendations)
        .where(whereCondition);

      // 按优先级统计
      const priorityStats = await this.db
        .select({
          priority: aiRecommendations.priority,
          count: count()
        })
        .from(aiRecommendations)
        .where(whereCondition)
        .groupBy(aiRecommendations.priority);

      // 按上下文类型统计
      const contextTypeStats = await this.db
        .select({
          contextType: aiRecommendations.contextType,
          count: count()
        })
        .from(aiRecommendations)
        .where(whereCondition)
        .groupBy(aiRecommendations.contextType);

      // 按反馈统计
      const feedbackStats = await this.db
        .select({
          feedback: aiRecommendations.userFeedback,
          count: count()
        })
        .from(aiRecommendations)
        .where(whereCondition)
        .groupBy(aiRecommendations.userFeedback);

      // 平均置信度分数
      const [avgConfidenceResult] = await this.db
        .select({
          avgConfidence: sql<number>`AVG(${aiRecommendations.confidenceScore})`
        })
        .from(aiRecommendations)
        .where(whereCondition);

      // 接受率计算
      const [acceptedResult] = await this.db
        .select({ count: count() })
        .from(aiRecommendations)
        .where(whereCondition ? and(whereCondition, eq(aiRecommendations.userFeedback, 'accepted')) : eq(aiRecommendations.userFeedback, 'accepted'));

      const acceptanceRate = totalResult.count > 0 ? (acceptedResult.count / totalResult.count) * 100 : 0;

      return {
        total: totalResult.count,
        byPriority: priorityStats.reduce((acc, stat) => {
          if (stat.priority) {
            acc[stat.priority] = stat.count;
          }
          return acc;
        }, {} as Record<RecommendationPriority, number>),
        byContextType: contextTypeStats.reduce((acc, stat) => {
          if (stat.contextType) {
            acc[stat.contextType] = stat.count;
          }
          return acc;
        }, {} as Record<ContextType, number>),
        byFeedback: feedbackStats.reduce((acc, stat) => {
          if (stat.feedback) {
            acc[stat.feedback] = stat.count;
          }
          return acc;
        }, {} as Record<UserFeedback, number>),
        averageConfidenceScore: avgConfidenceResult.avgConfidence || 0,
        acceptanceRate,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get recommendation stats: ${errorMessage}`);
      throw new BadRequestException('Failed to get recommendation stats');
    }
  }

  // 获取推荐数量
  async getRecommendationCount(
    assistantId?: string,
    contextType?: ContextType,
    priority?: RecommendationPriority
  ): Promise<number> {
    try {
      let whereConditions = [];

      if (assistantId) {
        whereConditions.push(eq(aiRecommendations.assistantId, assistantId));
      }
      if (contextType) {
        whereConditions.push(eq(aiRecommendations.contextType, contextType));
      }
      if (priority) {
        whereConditions.push(eq(aiRecommendations.priority, priority));
      }

      const [result] = await this.db
        .select({ count: count() })
        .from(aiRecommendations)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

      return result.count;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get recommendation count: ${errorMessage}`);
      throw new BadRequestException('Failed to get recommendation count');
    }
  }

  // 获取高优先级推荐
  async getHighPriorityRecommendations(
    limit: number = 20,
    offset: number = 0
  ): Promise<AiRecommendation[]> {
    try {
      return await this.db
        .select()
        .from(aiRecommendations)
        .where(eq(aiRecommendations.priority, 'high'))
        .orderBy(desc(aiRecommendations.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get high priority recommendations: ${errorMessage}`);
      throw new BadRequestException('Failed to get high priority recommendations');
    }
  }

  // 获取待反馈的推荐
  async getPendingFeedbackRecommendations(
    limit: number = 50,
    offset: number = 0
  ): Promise<AiRecommendation[]> {
    try {
      return await this.db
        .select()
        .from(aiRecommendations)
        .where(sql`${aiRecommendations.userFeedback} IS NULL`)
        .orderBy(desc(aiRecommendations.priority), desc(aiRecommendations.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get pending feedback recommendations: ${errorMessage}`);
      throw new BadRequestException('Failed to get pending feedback recommendations');
    }
  }

  // 获取推荐及其关联的助手信息
  async getRecommendationWithAssistant(id: string): Promise<any> {
    try {
      const result = await this.db
        .select({
          recommendation: aiRecommendations,
          assistant: aiAssistants,
        })
        .from(aiRecommendations)
        .leftJoin(aiAssistants, eq(aiRecommendations.assistantId, aiAssistants.id))
        .where(eq(aiRecommendations.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get recommendation with assistant: ${errorMessage}`);
      throw new BadRequestException('Failed to get recommendation with assistant');
    }
  }

  // 验证推荐数据
  async validateRecommendation(data: Partial<AiRecommendation>): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    try {
      const errors: string[] = [];

      // 基本验证
      if (!data.assistantId) {
        errors.push('Assistant ID is required');
      }
      if (!data.contextType) {
        errors.push('Context type is required');
      }
      if (data.contextId === undefined || data.contextId === null) {
        errors.push('Context ID is required');
      }
      if (!data.recommendationType) {
        errors.push('Recommendation type is required');
      }
      if (!data.title || data.title.trim().length === 0) {
        errors.push('Title is required');
      }

      // 置信度分数验证
      if (data.confidenceScore !== undefined && data.confidenceScore !== null) {
        if (Number(data.confidenceScore) < 0 || Number(data.confidenceScore) > 1) {
          errors.push('Confidence score must be between 0 and 1');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to validate recommendation: ${errorMessage}`);
      return {
        isValid: false,
        errors: ['Validation failed'],
      };
    }
  }

  hello(): string {
    return 'Hello from AiRecommendationsService!';
  }
}