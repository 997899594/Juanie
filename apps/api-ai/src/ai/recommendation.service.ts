/**
 * 🚀 Juanie AI - 智能推荐引擎
 * AI原生的个性化推荐系统，支持多维度智能推荐
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { 
  withTimeout, 
  retry, 
  CONSTANTS,
  cosineSimilarity,
} from '../core';
import type { DeepPartial } from '../core/types';

// ============================================================================
// 推荐系统Schema
// ============================================================================

export const RecommendationContextSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
  projectId: z.string().optional(),
  environmentId: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
  
  // 用户行为上下文
  userBehavior: z.object({
    recentActions: z.array(z.object({
      action: z.string(),
      resource: z.string(),
      timestamp: z.date(),
      metadata: z.record(z.any()).optional(),
    })),
    preferences: z.record(z.any()).optional(),
    expertise: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
    role: z.string().optional(),
  }),
  
  // 系统状态上下文
  systemState: z.object({
    performance: z.object({
      cpu: z.number().optional(),
      memory: z.number().optional(),
      disk: z.number().optional(),
      network: z.number().optional(),
    }).optional(),
    security: z.object({
      riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      vulnerabilities: z.array(z.string()).optional(),
      compliance: z.record(z.boolean()).optional(),
    }).optional(),
    cost: z.object({
      current: z.number().optional(),
      trend: z.enum(['increasing', 'stable', 'decreasing']).optional(),
      budget: z.number().optional(),
    }).optional(),
  }).optional(),
  
  // 项目上下文
  projectContext: z.object({
    technology: z.array(z.string()).optional(),
    stage: z.enum(['planning', 'development', 'testing', 'deployment', 'maintenance']).optional(),
    team: z.object({
      size: z.number().optional(),
      skills: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),
});

export const RecommendationSchema = z.object({
  id: z.string(),
  type: z.enum([
    'performance',
    'security', 
    'cost',
    'architecture',
    'code-quality',
    'deployment',
    'monitoring',
    'compliance',
    'learning',
    'automation',
  ]),
  category: z.enum(['optimization', 'fix', 'enhancement', 'prevention', 'education']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  
  title: z.string(),
  description: z.string(),
  reasoning: z.string(), // AI推理过程
  
  // 推荐内容
  content: z.object({
    summary: z.string(),
    details: z.string(),
    steps: z.array(z.object({
      order: z.number(),
      title: z.string(),
      description: z.string(),
      estimated_time: z.string().optional(),
      difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    })),
    resources: z.array(z.object({
      type: z.enum(['documentation', 'tutorial', 'tool', 'example']),
      title: z.string(),
      url: z.string().optional(),
      description: z.string().optional(),
    })),
  }),
  
  // 影响评估
  impact: z.object({
    performance: z.number().min(-1).max(1).optional(), // -1到1的影响分数
    security: z.number().min(-1).max(1).optional(),
    cost: z.number().min(-1).max(1).optional(),
    maintainability: z.number().min(-1).max(1).optional(),
    user_experience: z.number().min(-1).max(1).optional(),
  }),
  
  // 推荐元数据
  metadata: z.object({
    confidence: z.number().min(0).max(1),
    relevance: z.number().min(0).max(1),
    urgency: z.number().min(0).max(1),
    effort: z.enum(['low', 'medium', 'high']),
    tags: z.array(z.string()),
    model: z.string(),
    generated_at: z.date(),
    expires_at: z.date().optional(),
  }),
  
  // 用户交互
  interaction: z.object({
    viewed: z.boolean().default(false),
    dismissed: z.boolean().default(false),
    implemented: z.boolean().default(false),
    feedback: z.enum(['helpful', 'not_helpful', 'irrelevant']).optional(),
    rating: z.number().min(1).max(5).optional(),
    notes: z.string().optional(),
  }).optional(),
});

export const RecommendationBatchSchema = z.object({
  context: RecommendationContextSchema,
  recommendations: z.array(RecommendationSchema),
  metadata: z.object({
    total_generated: z.number(),
    processing_time: z.number(),
    model_version: z.string(),
    confidence_threshold: z.number(),
    personalization_score: z.number(),
  }),
});

export type RecommendationContext = z.infer<typeof RecommendationContextSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type RecommendationBatch = z.infer<typeof RecommendationBatchSchema>;

// ============================================================================
// 推荐引擎
// ============================================================================

@Injectable()
export class RecommendationEngine implements OnModuleInit {
  private readonly logger = new Logger(RecommendationEngine.name);
  
  // 推荐模板库
  private recommendationTemplates: Map<string, any> = new Map();
  
  // 用户画像缓存
  private userProfiles: Map<string, any> = new Map();
  
  // 推荐历史
  private recommendationHistory: Map<string, Recommendation[]> = new Map();
  
  // 反馈学习数据
  private feedbackData: Array<{
    recommendationId: string;
    userId: string;
    feedback: string;
    context: any;
    timestamp: Date;
  }> = [];
  
  // 统计信息
  private stats = {
    totalRecommendations: 0,
    acceptedRecommendations: 0,
    dismissedRecommendations: 0,
    implementedRecommendations: 0,
    averageConfidence: 0,
    averageRelevance: 0,
    categoryStats: new Map<string, { generated: number; accepted: number }>(),
  };

  constructor(
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.initializeTemplates();
    this.startPeriodicTasks();
  }

  /**
   * 初始化推荐模板
   */
  private async initializeTemplates(): Promise<void> {
    this.logger.log('Initializing recommendation templates...');
    
    // 性能优化模板
    this.recommendationTemplates.set('performance-cpu-high', {
      type: 'performance',
      category: 'optimization',
      template: {
        title: 'CPU使用率过高优化建议',
        description: '检测到CPU使用率持续偏高，建议进行性能优化',
        steps: [
          { order: 1, title: '分析CPU热点', description: '使用性能分析工具定位CPU密集型代码' },
          { order: 2, title: '优化算法复杂度', description: '检查并优化时间复杂度较高的算法' },
          { order: 3, title: '启用缓存机制', description: '对频繁计算的结果进行缓存' },
        ],
      },
    });
    
    // 安全加固模板
    this.recommendationTemplates.set('security-vulnerability-detected', {
      type: 'security',
      category: 'fix',
      template: {
        title: '安全漏洞修复建议',
        description: '检测到潜在安全漏洞，建议立即修复',
        steps: [
          { order: 1, title: '评估漏洞影响', description: '分析漏洞的严重程度和影响范围' },
          { order: 2, title: '应用安全补丁', description: '更新相关依赖和组件到安全版本' },
          { order: 3, title: '加强访问控制', description: '实施更严格的访问控制策略' },
        ],
      },
    });
    
    // 成本优化模板
    this.recommendationTemplates.set('cost-optimization-opportunity', {
      type: 'cost',
      category: 'optimization',
      template: {
        title: '成本优化机会',
        description: '发现潜在的成本节约机会',
        steps: [
          { order: 1, title: '分析资源使用', description: '识别未充分利用的资源' },
          { order: 2, title: '调整资源配置', description: '根据实际需求调整资源分配' },
          { order: 3, title: '启用自动扩缩容', description: '配置基于负载的自动扩缩容' },
        ],
      },
    });
    
    this.logger.log(`Loaded ${this.recommendationTemplates.size} recommendation templates`);
  }

  /**
   * 启动周期性任务
   */
  private startPeriodicTasks(): void {
    // 每5分钟更新用户画像
    setInterval(() => {
      this.updateUserProfiles();
    }, 5 * 60 * 1000);
    
    // 每小时学习用户反馈
    setInterval(() => {
      this.learnFromFeedback();
    }, 60 * 60 * 1000);
    
    // 每天清理过期推荐
    setInterval(() => {
      this.cleanupExpiredRecommendations();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * 生成个性化推荐
   */
  async generateRecommendations(context: RecommendationContext): Promise<RecommendationBatch> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Generating recommendations for user: ${context.userId}`);
      
      // 获取用户画像
      const userProfile = await this.getUserProfile(context.userId);
      
      // 分析当前上下文
      const contextAnalysis = await this.analyzeContext(context);
      
      // 生成候选推荐
      const candidates = await this.generateCandidateRecommendations(context, contextAnalysis);
      
      // 个性化排序和过滤
      const personalizedRecommendations = await this.personalizeRecommendations(
        candidates,
        userProfile,
        context
      );
      
      // 应用置信度阈值
      const filteredRecommendations = personalizedRecommendations.filter(
        rec => rec.metadata.confidence >= 0.7 // 默认阈值
      );
      
      const processingTime = Date.now() - startTime;
      
      const batch: RecommendationBatch = {
        context,
        recommendations: filteredRecommendations.slice(0, 10), // 最多返回10个推荐
        metadata: {
          total_generated: candidates.length,
          processing_time: processingTime,
          model_version: 'recommendation-engine-v1.0',
          confidence_threshold: 0.7,
          personalization_score: this.calculatePersonalizationScore(userProfile, context),
        },
      };
      
      // 更新统计信息
      this.updateStats(batch);
      
      // 缓存推荐历史
      this.cacheRecommendations(context.userId, batch.recommendations);
      
      // 发送事件
      this.eventEmitter.emit('recommendations.generated', {
        userId: context.userId,
        count: batch.recommendations.length,
        processingTime,
      });
      
      this.logger.debug(`Generated ${batch.recommendations.length} recommendations in ${processingTime}ms`);
      
      return batch;
    } catch (error) {
      this.logger.error('Failed to generate recommendations', error);
      throw error;
    }
  }

  /**
   * 获取用户画像
   */
  private async getUserProfile(userId: string): Promise<any> {
    let profile = this.userProfiles.get(userId);
    
    if (!profile) {
      // 构建新的用户画像
      profile = {
        userId,
        preferences: {},
        behavior: {
          actionFrequency: new Map(),
          preferredCategories: [],
          averageImplementationRate: 0,
        },
        expertise: 'intermediate',
        lastUpdated: new Date(),
      };
      
      this.userProfiles.set(userId, profile);
    }
    
    return profile;
  }

  /**
   * 分析上下文
   */
  private async analyzeContext(context: RecommendationContext): Promise<any> {
    const analysis = {
      urgency: 0,
      complexity: 0,
      riskLevel: 'low',
      opportunities: [],
      constraints: [],
    };
    
    // 分析系统状态
    if (context.systemState) {
      const { performance, security, cost } = context.systemState;
      
      // 性能分析
      if (performance) {
        if (performance.cpu && performance.cpu > 80) {
          analysis.urgency += 0.3;
          analysis.opportunities.push('cpu-optimization');
        }
        if (performance.memory && performance.memory > 85) {
          analysis.urgency += 0.3;
          analysis.opportunities.push('memory-optimization');
        }
      }
      
      // 安全分析
      if (security) {
        if (security.riskLevel === 'high' || security.riskLevel === 'critical') {
          analysis.urgency += 0.5;
          analysis.riskLevel = security.riskLevel;
          analysis.opportunities.push('security-hardening');
        }
      }
      
      // 成本分析
      if (cost) {
        if (cost.trend === 'increasing') {
          analysis.opportunities.push('cost-optimization');
        }
      }
    }
    
    // 分析用户行为
    if (context.userBehavior) {
      const recentActions = context.userBehavior.recentActions || [];
      
      // 检测重复性任务
      const actionCounts = new Map();
      recentActions.forEach(action => {
        actionCounts.set(action.action, (actionCounts.get(action.action) || 0) + 1);
      });
      
      for (const [action, count] of actionCounts) {
        if (count > 5) { // 重复超过5次
          analysis.opportunities.push('automation-' + action);
        }
      }
    }
    
    return analysis;
  }

  /**
   * 生成候选推荐
   */
  private async generateCandidateRecommendations(
    context: RecommendationContext,
    analysis: any
  ): Promise<Recommendation[]> {
    const candidates: Recommendation[] = [];
    
    // 基于机会生成推荐
    for (const opportunity of analysis.opportunities) {
      const template = this.recommendationTemplates.get(opportunity);
      if (template) {
        const recommendation = await this.createRecommendationFromTemplate(
          template,
          context,
          analysis
        );
        candidates.push(recommendation);
      }
    }
    
    // 基于规则生成推荐
    const ruleBasedRecommendations = await this.generateRuleBasedRecommendations(context, analysis);
    candidates.push(...ruleBasedRecommendations);
    
    // 基于ML模型生成推荐（模拟）
    const mlRecommendations = await this.generateMLRecommendations(context, analysis);
    candidates.push(...mlRecommendations);
    
    return candidates;
  }

  /**
   * 从模板创建推荐
   */
  private async createRecommendationFromTemplate(
    template: any,
    context: RecommendationContext,
    analysis: any
  ): Promise<Recommendation> {
    const id = crypto.randomUUID();
    
    return {
      id,
      type: template.type,
      category: template.category,
      priority: this.calculatePriority(analysis),
      title: template.template.title,
      description: template.template.description,
      reasoning: `基于当前系统状态和用户行为模式，AI分析认为此优化具有较高价值。`,
      content: {
        summary: template.template.description,
        details: `详细的实施指南和最佳实践建议。`,
        steps: template.template.steps,
        resources: [
          {
            type: 'documentation',
            title: '官方文档',
            url: 'https://docs.example.com',
            description: '相关的官方文档和指南',
          },
        ],
      },
      impact: {
        performance: template.type === 'performance' ? 0.8 : 0.2,
        security: template.type === 'security' ? 0.9 : 0.1,
        cost: template.type === 'cost' ? 0.7 : 0.0,
        maintainability: 0.5,
        user_experience: 0.3,
      },
      metadata: {
        confidence: 0.85,
        relevance: 0.9,
        urgency: analysis.urgency,
        effort: 'medium',
        tags: [template.type, 'ai-generated'],
        model: 'template-based-v1',
        generated_at: new Date(),
      },
    };
  }

  /**
   * 生成基于规则的推荐
   */
  private async generateRuleBasedRecommendations(
    context: RecommendationContext,
    analysis: any
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // 规则1: 如果是新用户，推荐学习资源
    if (context.userBehavior.expertise === 'beginner') {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'learning',
        category: 'education',
        priority: 'medium',
        title: '新手入门指南',
        description: '为新用户推荐的学习路径和资源',
        reasoning: '检测到您是新用户，推荐一些入门资源帮助您快速上手。',
        content: {
          summary: '精选的新手学习资源',
          details: '包含基础概念、最佳实践和实战案例的完整学习路径。',
          steps: [
            { order: 1, title: '基础概念学习', description: '了解核心概念和术语' },
            { order: 2, title: '实践练习', description: '通过实际项目加深理解' },
            { order: 3, title: '进阶学习', description: '学习高级特性和最佳实践' },
          ],
          resources: [
            {
              type: 'tutorial',
              title: '快速入门教程',
              description: '15分钟快速上手指南',
            },
          ],
        },
        impact: {
          user_experience: 0.9,
          maintainability: 0.6,
        },
        metadata: {
          confidence: 0.9,
          relevance: 0.95,
          urgency: 0.3,
          effort: 'low',
          tags: ['learning', 'beginner', 'tutorial'],
          model: 'rule-based-v1',
          generated_at: new Date(),
        },
      });
    }
    
    return recommendations;
  }

  /**
   * 生成基于ML的推荐（模拟）
   */
  private async generateMLRecommendations(
    context: RecommendationContext,
    analysis: any
  ): Promise<Recommendation[]> {
    // 这里可以集成真实的ML模型
    // 目前返回模拟的推荐
    
    return [
      {
        id: crypto.randomUUID(),
        type: 'architecture',
        category: 'enhancement',
        priority: 'medium',
        title: 'AI推荐的架构优化',
        description: '基于机器学习模型分析的架构改进建议',
        reasoning: 'ML模型分析了类似项目的成功模式，发现当前架构存在优化空间。',
        content: {
          summary: 'AI分析推荐的架构优化方案',
          details: '基于大量成功案例的数据分析，提供个性化的架构改进建议。',
          steps: [
            { order: 1, title: '架构评估', description: '评估当前架构的优缺点' },
            { order: 2, title: '设计改进方案', description: '制定具体的改进计划' },
            { order: 3, title: '渐进式迁移', description: '安全地实施架构变更' },
          ],
          resources: [
            {
              type: 'example',
              title: '成功案例分析',
              description: '类似项目的成功实施案例',
            },
          ],
        },
        impact: {
          performance: 0.6,
          maintainability: 0.8,
          user_experience: 0.4,
        },
        metadata: {
          confidence: 0.75,
          relevance: 0.8,
          urgency: 0.4,
          effort: 'high',
          tags: ['architecture', 'ml-generated', 'optimization'],
          model: 'ml-recommendation-v1',
          generated_at: new Date(),
        },
      },
    ];
  }

  /**
   * 个性化推荐排序
   */
  private async personalizeRecommendations(
    candidates: Recommendation[],
    userProfile: any,
    context: RecommendationContext
  ): Promise<Recommendation[]> {
    // 计算个性化分数
    const scoredRecommendations = candidates.map(rec => {
      let personalizedScore = rec.metadata.confidence * 0.4 + rec.metadata.relevance * 0.6;
      
      // 基于用户偏好调整分数
      if (userProfile.behavior.preferredCategories.includes(rec.type)) {
        personalizedScore += 0.2;
      }
      
      // 基于用户专业水平调整
      if (context.userBehavior.expertise === 'beginner' && rec.metadata.effort === 'high') {
        personalizedScore -= 0.3;
      }
      
      // 基于历史实施率调整
      if (userProfile.behavior.averageImplementationRate > 0.7) {
        personalizedScore += 0.1;
      }
      
      return {
        ...rec,
        metadata: {
          ...rec.metadata,
          relevance: Math.min(1, personalizedScore),
        },
      };
    });
    
    // 按个性化分数排序
    return scoredRecommendations.sort((a, b) => b.metadata.relevance - a.metadata.relevance);
  }

  /**
   * 计算优先级
   */
  private calculatePriority(analysis: any): 'low' | 'medium' | 'high' | 'critical' {
    if (analysis.urgency > 0.8) return 'critical';
    if (analysis.urgency > 0.6) return 'high';
    if (analysis.urgency > 0.3) return 'medium';
    return 'low';
  }

  /**
   * 计算个性化分数
   */
  private calculatePersonalizationScore(userProfile: any, context: RecommendationContext): number {
    let score = 0.5; // 基础分数
    
    // 用户画像完整度
    if (userProfile.preferences && Object.keys(userProfile.preferences).length > 0) {
      score += 0.2;
    }
    
    // 行为数据丰富度
    if (userProfile.behavior.actionFrequency.size > 10) {
      score += 0.2;
    }
    
    // 上下文信息完整度
    if (context.systemState) {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }

  /**
   * 记录用户反馈
   */
  async recordFeedback(
    recommendationId: string,
    userId: string,
    feedback: 'helpful' | 'not_helpful' | 'irrelevant',
    rating?: number,
    notes?: string
  ): Promise<void> {
    try {
      // 更新推荐记录
      const userRecommendations = this.recommendationHistory.get(userId) || [];
      const recommendation = userRecommendations.find(rec => rec.id === recommendationId);
      
      if (recommendation && recommendation.interaction) {
        recommendation.interaction.feedback = feedback;
        recommendation.interaction.rating = rating;
        recommendation.interaction.notes = notes;
      }
      
      // 记录反馈数据用于学习
      this.feedbackData.push({
        recommendationId,
        userId,
        feedback,
        context: { rating, notes },
        timestamp: new Date(),
      });
      
      // 更新统计信息
      if (feedback === 'helpful') {
        this.stats.acceptedRecommendations++;
      } else {
        this.stats.dismissedRecommendations++;
      }
      
      this.logger.debug(`Recorded feedback for recommendation ${recommendationId}: ${feedback}`);
      
      // 发送反馈事件
      this.eventEmitter.emit('recommendations.feedback', {
        recommendationId,
        userId,
        feedback,
        rating,
      });
    } catch (error) {
      this.logger.error('Failed to record feedback', error);
      throw error;
    }
  }

  /**
   * 标记推荐为已实施
   */
  async markAsImplemented(recommendationId: string, userId: string): Promise<void> {
    try {
      const userRecommendations = this.recommendationHistory.get(userId) || [];
      const recommendation = userRecommendations.find(rec => rec.id === recommendationId);
      
      if (recommendation && recommendation.interaction) {
        recommendation.interaction.implemented = true;
        this.stats.implementedRecommendations++;
        
        this.logger.debug(`Marked recommendation ${recommendationId} as implemented`);
        
        this.eventEmitter.emit('recommendations.implemented', {
          recommendationId,
          userId,
          type: recommendation.type,
        });
      }
    } catch (error) {
      this.logger.error('Failed to mark recommendation as implemented', error);
      throw error;
    }
  }

  /**
   * 获取用户推荐历史
   */
  getRecommendationHistory(userId: string, limit: number = 50): Recommendation[] {
    const history = this.recommendationHistory.get(userId) || [];
    return history.slice(0, limit);
  }

  /**
   * 更新用户画像
   */
  private updateUserProfiles(): void {
    this.logger.debug('Updating user profiles...');
    
    for (const [userId, profile] of this.userProfiles) {
      // 基于反馈数据更新偏好
      const userFeedback = this.feedbackData.filter(f => f.userId === userId);
      
      if (userFeedback.length > 0) {
        // 更新偏好类别
        const helpfulRecommendations = userFeedback.filter(f => f.feedback === 'helpful');
        // 这里可以实现更复杂的偏好学习逻辑
        
        profile.lastUpdated = new Date();
      }
    }
  }

  /**
   * 从反馈中学习
   */
  private learnFromFeedback(): void {
    this.logger.debug('Learning from user feedback...');
    
    // 分析反馈模式
    const feedbackAnalysis = this.analyzeFeedbackPatterns();
    
    // 调整推荐策略
    this.adjustRecommendationStrategy(feedbackAnalysis);
  }

  /**
   * 分析反馈模式
   */
  private analyzeFeedbackPatterns(): any {
    const patterns = {
      categoryPreferences: new Map(),
      effortPreferences: new Map(),
      confidenceThreshold: 0.7,
    };
    
    // 分析类别偏好
    for (const feedback of this.feedbackData) {
      // 这里可以实现更复杂的模式分析
    }
    
    return patterns;
  }

  /**
   * 调整推荐策略
   */
  private adjustRecommendationStrategy(analysis: any): void {
    // 基于分析结果调整推荐参数
    this.logger.debug('Adjusting recommendation strategy based on feedback analysis');
  }

  /**
   * 清理过期推荐
   */
  private cleanupExpiredRecommendations(): void {
    const now = new Date();
    
    for (const [userId, recommendations] of this.recommendationHistory) {
      const validRecommendations = recommendations.filter(rec => {
        if (rec.metadata.expires_at) {
          return rec.metadata.expires_at > now;
        }
        return true; // 没有过期时间的推荐保留
      });
      
      this.recommendationHistory.set(userId, validRecommendations);
    }
    
    this.logger.debug('Cleaned up expired recommendations');
  }

  /**
   * 缓存推荐
   */
  private cacheRecommendations(userId: string, recommendations: Recommendation[]): void {
    const existing = this.recommendationHistory.get(userId) || [];
    const updated = [...recommendations, ...existing].slice(0, 100); // 保留最近100个
    this.recommendationHistory.set(userId, updated);
  }

  /**
   * 更新统计信息
   */
  private updateStats(batch: RecommendationBatch): void {
    this.stats.totalRecommendations += batch.recommendations.length;
    
    // 更新平均置信度
    const totalConfidence = batch.recommendations.reduce(
      (sum, rec) => sum + rec.metadata.confidence, 0
    );
    this.stats.averageConfidence = totalConfidence / batch.recommendations.length;
    
    // 更新平均相关性
    const totalRelevance = batch.recommendations.reduce(
      (sum, rec) => sum + rec.metadata.relevance, 0
    );
    this.stats.averageRelevance = totalRelevance / batch.recommendations.length;
    
    // 更新类别统计
    for (const rec of batch.recommendations) {
      const categoryStats = this.stats.categoryStats.get(rec.type) || { generated: 0, accepted: 0 };
      categoryStats.generated++;
      this.stats.categoryStats.set(rec.type, categoryStats);
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      categoryStats: Object.fromEntries(this.stats.categoryStats),
      acceptanceRate: this.stats.totalRecommendations > 0 
        ? this.stats.acceptedRecommendations / this.stats.totalRecommendations 
        : 0,
      implementationRate: this.stats.totalRecommendations > 0
        ? this.stats.implementedRecommendations / this.stats.totalRecommendations
        : 0,
    };
  }
}