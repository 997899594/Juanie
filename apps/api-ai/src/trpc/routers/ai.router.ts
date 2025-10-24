/**
 * 🚀 Juanie AI - AI 路由器
 * 集成智能助手、推荐系统和AI服务
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  insertAiAssistantSchema as AIAssistantCreateSchema,
  selectAiAssistantSchema as AIAssistantSchema,
  updateAiAssistantSchema as AIAssistantUpdateSchema,
  selectAiRecommendationSchema as AIRecommendationSchema,
} from "../../database/schemas";
import {
  createCacheKey,
  protectedProcedure,
  publicProcedure,
  router,
} from "../trpc.config";

// ============================================================================
// AI 助手路由
// ============================================================================

const aiAssistantRouter = router({
  /**
   * 获取所有AI助手
   */
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().optional(),
        type: z
          .enum([
            "code-reviewer",
            "devops-engineer",
            "security-analyst",
            "cost-optimizer",
            "incident-responder",
          ])
          .optional(),
        isActive: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const { services, user } = ctx;

      try {
        const organizationId = input.organizationId || user?.organizationId;

        if (!organizationId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Organization ID is required",
          });
        }

        const assistants = await services.db
          .select()
          .from(services.db.schema.aiAssistants)
          .where(
            services.db.and(
              services.db.eq(
                services.db.schema.aiAssistants.organizationId,
                organizationId
              ),
              input.type
                ? services.db.eq(
                    services.db.schema.aiAssistants.type,
                    input.type
                  )
                : undefined,
              input.isActive !== undefined
                ? services.db.eq(
                    services.db.schema.aiAssistants.isActive,
                    input.isActive
                  )
                : undefined
            )
          )
          .limit(input.limit)
          .offset(input.offset)
          .orderBy(services.db.desc(services.db.schema.aiAssistants.createdAt));

        const total = await services.db
          .select({ count: services.db.count() })
          .from(services.db.schema.aiAssistants)
          .where(
            services.db.and(
              services.db.eq(
                services.db.schema.aiAssistants.organizationId,
                organizationId
              ),
              input.type
                ? services.db.eq(
                    services.db.schema.aiAssistants.type,
                    input.type
                  )
                : undefined,
              input.isActive !== undefined
                ? services.db.eq(
                    services.db.schema.aiAssistants.isActive,
                    input.isActive
                  )
                : undefined
            )
          );

        return {
          assistants,
          pagination: {
            total: total[0].count,
            limit: input.limit,
            offset: input.offset,
            hasMore: input.offset + input.limit < total[0].count,
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch AI assistants",
          cause: error,
        });
      }
    }),

  /**
   * 获取单个AI助手
   */
  get: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { services, user } = ctx;

      try {
        const assistant = await services.db
          .select()
          .from(services.db.schema.aiAssistants)
          .where(
            services.db.and(
              services.db.eq(services.db.schema.aiAssistants.id, input.id),
              services.db.eq(
                services.db.schema.aiAssistants.organizationId,
                user?.organizationId
              )
            )
          )
          .limit(1);

        if (!assistant.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "AI assistant not found",
          });
        }

        return assistant[0];
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch AI assistant",
          cause: error,
        });
      }
    }),

  /**
   * 创建AI助手
   */
  create: protectedProcedure
    .input(AIAssistantCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const { services, user } = ctx;

      try {
        const assistantData = {
          ...input,
          organizationId: user?.organizationId,
          createdBy: user?.sub,
          updatedBy: user?.sub,
        };

        const [assistant] = await services.db
          .insert(services.db.schema.aiAssistants)
          .values(assistantData)
          .returning();

        return assistant;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create AI assistant",
          cause: error,
        });
      }
    }),

  /**
   * 更新AI助手
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: AIAssistantUpdateSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { services, user } = ctx;

      try {
        const updateData = {
          ...input.data,
          updatedBy: user?.sub,
          updatedAt: new Date(),
        };

        const [assistant] = await services.db
          .update(services.db.schema.aiAssistants)
          .set(updateData)
          .where(
            services.db.and(
              services.db.eq(services.db.schema.aiAssistants.id, input.id),
              services.db.eq(
                services.db.schema.aiAssistants.organizationId,
                user?.organizationId
              )
            )
          )
          .returning();

        if (!assistant) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "AI assistant not found",
          });
        }

        return assistant;
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update AI assistant",
          cause: error,
        });
      }
    }),

  /**
   * 删除AI助手
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { services, user } = ctx;

      try {
        const [assistant] = await services.db
          .delete(services.db.schema.aiAssistants)
          .where(
            services.db.and(
              services.db.eq(services.db.schema.aiAssistants.id, input.id),
              services.db.eq(
                services.db.schema.aiAssistants.organizationId,
                user?.organizationId
              )
            )
          )
          .returning();

        if (!assistant) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "AI assistant not found",
          });
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete AI assistant",
          cause: error,
        });
      }
    }),

  /**
   * 与AI助手对话
   */
  chat: protectedProcedure
    .input(
      z.object({
        assistantId: z.string(),
        message: z.string().min(1).max(10000),
        context: z.record(z.any()).optional(),
        stream: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { services, user } = ctx;

      try {
        // 获取AI助手信息
        const assistant = await services.db
          .select()
          .from(services.db.schema.aiAssistants)
          .where(
            services.db.and(
              services.db.eq(
                services.db.schema.aiAssistants.id,
                input.assistantId
              ),
              services.db.eq(
                services.db.schema.aiAssistants.organizationId,
                user?.organizationId
              )
            )
          )
          .limit(1);

        if (!assistant.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "AI assistant not found",
          });
        }

        const assistantData = assistant[0];

        if (!assistantData.isActive) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "AI assistant is not active",
          });
        }

        // 构建对话上下文
        const chatContext = {
          assistant: assistantData,
          user: user,
          context: input.context || {},
          timestamp: new Date(),
        };

        // 调用AI服务
        let response: any;
        if (services.aiAssistant) {
          if (input.stream) {
            response = await services.aiAssistant.streamChat(
              input.message,
              chatContext
            );
          } else {
            response = await services.aiAssistant.chat(
              input.message,
              chatContext
            );
          }
        } else {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "AI assistant service is not available",
          });
        }

        // 更新助手统计信息
        await services.db
          .update(services.db.schema.aiAssistants)
          .set({
            totalInteractions: services.db
              .sql`${services.db.schema.aiAssistants.totalInteractions} + 1`,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            services.db.eq(
              services.db.schema.aiAssistants.id,
              input.assistantId
            )
          );

        return {
          response,
          assistant: assistantData,
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to chat with AI assistant",
          cause: error,
        });
      }
    }),
});

// ============================================================================
// AI 推荐路由
// ============================================================================

const aiRecommendationRouter = router({
  /**
   * 获取推荐列表
   */
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().optional(),
        projectId: z.string().optional(),
        type: z
          .enum(["performance", "security", "cost", "architecture"])
          .optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        status: z
          .enum(["pending", "accepted", "rejected", "implemented"])
          .optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const { services, user } = ctx;

      try {
        const organizationId = input.organizationId || user?.organizationId;

        if (!organizationId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Organization ID is required",
          });
        }

        const recommendations = await services.db
          .select()
          .from(services.db.schema.aiRecommendations)
          .where(
            services.db.and(
              services.db.eq(
                services.db.schema.aiRecommendations.organizationId,
                organizationId
              ),
              input.projectId
                ? services.db.eq(
                    services.db.schema.aiRecommendations.projectId,
                    input.projectId
                  )
                : undefined,
              input.type
                ? services.db.eq(
                    services.db.schema.aiRecommendations.type,
                    input.type
                  )
                : undefined,
              input.priority
                ? services.db.eq(
                    services.db.schema.aiRecommendations.priority,
                    input.priority
                  )
                : undefined,
              input.status
                ? services.db.eq(
                    services.db.schema.aiRecommendations.status,
                    input.status
                  )
                : undefined
            )
          )
          .limit(input.limit)
          .offset(input.offset)
          .orderBy(
            services.db.desc(services.db.schema.aiRecommendations.priority),
            services.db.desc(services.db.schema.aiRecommendations.createdAt)
          );

        const total = await services.db
          .select({ count: services.db.count() })
          .from(services.db.schema.aiRecommendations)
          .where(
            services.db.and(
              services.db.eq(
                services.db.schema.aiRecommendations.organizationId,
                organizationId
              ),
              input.projectId
                ? services.db.eq(
                    services.db.schema.aiRecommendations.projectId,
                    input.projectId
                  )
                : undefined,
              input.type
                ? services.db.eq(
                    services.db.schema.aiRecommendations.type,
                    input.type
                  )
                : undefined,
              input.priority
                ? services.db.eq(
                    services.db.schema.aiRecommendations.priority,
                    input.priority
                  )
                : undefined,
              input.status
                ? services.db.eq(
                    services.db.schema.aiRecommendations.status,
                    input.status
                  )
                : undefined
            )
          );

        return {
          recommendations,
          pagination: {
            total: total[0].count,
            limit: input.limit,
            offset: input.offset,
            hasMore: input.offset + input.limit < total[0].count,
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch recommendations",
          cause: error,
        });
      }
    }),

  /**
   * 生成个性化推荐
   */
  generate: protectedProcedure
    .input(
      z.object({
        context: z.object({
          type: z.enum(["code", "security", "performance", "cost"]),
          id: z.number(),
          metadata: z.record(z.any()).optional(),
        }),
        types: z
          .array(z.enum(["performance", "security", "cost", "architecture"]))
          .optional(),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { services, user } = ctx;

      try {
        if (!services.aiAssistant) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "AI recommendation service is not available",
          });
        }

        // 生成推荐
        const recommendations =
          await services.aiAssistant.generateRecommendations(
            {
              ...input.context,
              userId: user?.sub,
              organizationId: user?.organizationId,
            },
            input.types,
            input.limit
          );

        // 保存推荐到数据库
        const savedRecommendations = [];
        for (const recommendation of recommendations) {
          const [saved] = await services.db
            .insert(services.db.schema.aiRecommendations)
            .values({
              ...recommendation,
              organizationId: user?.organizationId,
              createdBy: user?.sub,
              updatedBy: user?.sub,
            })
            .returning();

          savedRecommendations.push(saved);
        }

        return savedRecommendations;
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate recommendations",
          cause: error,
        });
      }
    }),

  /**
   * 更新推荐状态
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["pending", "accepted", "rejected", "implemented"]),
        feedback: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { services, user } = ctx;

      try {
        const [recommendation] = await services.db
          .update(services.db.schema.aiRecommendations)
          .set({
            status: input.status,
            feedback: input.feedback,
            updatedBy: user?.sub,
            updatedAt: new Date(),
          })
          .where(
            services.db.and(
              services.db.eq(services.db.schema.aiRecommendations.id, input.id),
              services.db.eq(
                services.db.schema.aiRecommendations.organizationId,
                user?.organizationId
              )
            )
          )
          .returning();

        if (!recommendation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recommendation not found",
          });
        }

        // 记录用户反馈用于学习
        if (services.aiAssistant && input.feedback) {
          await services.aiAssistant.recordFeedback(input.id, {
            status: input.status,
            feedback: input.feedback,
            userId: user?.sub,
            timestamp: new Date(),
          });
        }

        return recommendation;
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update recommendation status",
          cause: error,
        });
      }
    }),

  /**
   * 获取推荐统计信息
   */
  stats: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().optional(),
        projectId: z.string().optional(),
        timeRange: z
          .enum(["day", "week", "month", "quarter", "year"])
          .default("month"),
      })
    )
    .query(async ({ input, ctx }) => {
      const { services, user } = ctx;

      try {
        const organizationId = input.organizationId || user?.organizationId;

        if (!organizationId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Organization ID is required",
          });
        }

        // 计算时间范围
        const now = new Date();
        const timeRanges = {
          day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          quarter: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          year: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        };

        const startDate = timeRanges[input.timeRange];

        // 获取统计数据
        const stats = await services.db
          .select({
            type: services.db.schema.aiRecommendations.type,
            status: services.db.schema.aiRecommendations.status,
            priority: services.db.schema.aiRecommendations.priority,
            count: services.db.count(),
          })
          .from(services.db.schema.aiRecommendations)
          .where(
            services.db.and(
              services.db.eq(
                services.db.schema.aiRecommendations.organizationId,
                organizationId
              ),
              input.projectId
                ? services.db.eq(
                    services.db.schema.aiRecommendations.projectId,
                    input.projectId
                  )
                : undefined,
              services.db.gte(
                services.db.schema.aiRecommendations.createdAt,
                startDate
              )
            )
          )
          .groupBy(
            services.db.schema.aiRecommendations.type,
            services.db.schema.aiRecommendations.status,
            services.db.schema.aiRecommendations.priority
          );

        // 处理统计数据
        const summary = {
          total: 0,
          byType: {} as Record<string, number>,
          byStatus: {} as Record<string, number>,
          byPriority: {} as Record<string, number>,
          implementationRate: 0,
          acceptanceRate: 0,
        };

        let implementedCount = 0;
        let acceptedCount = 0;

        for (const stat of stats) {
          summary.total += stat.count;
          summary.byType[stat.type] =
            (summary.byType[stat.type] || 0) + stat.count;
          summary.byStatus[stat.status] =
            (summary.byStatus[stat.status] || 0) + stat.count;
          summary.byPriority[stat.priority] =
            (summary.byPriority[stat.priority] || 0) + stat.count;

          if (stat.status === "implemented") {
            implementedCount += stat.count;
          }
          if (stat.status === "accepted" || stat.status === "implemented") {
            acceptedCount += stat.count;
          }
        }

        summary.implementationRate =
          summary.total > 0 ? implementedCount / summary.total : 0;
        summary.acceptanceRate =
          summary.total > 0 ? acceptedCount / summary.total : 0;

        return summary;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch recommendation statistics",
          cause: error,
        });
      }
    }),
});

// ============================================================================
// AI 服务路由
// ============================================================================

const aiServiceRouter = router({
  /**
   * 获取AI服务状态
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    const { services } = ctx;

    try {
      const status = {
        aiAssistant: {
          available: !!services.aiAssistant,
          status: services.aiAssistant
            ? await services.aiAssistant.getStatus()
            : "unavailable",
        },
        embedding: {
          available: !!services.embedding,
          status: services.embedding
            ? await services.embedding.getStatus()
            : "unavailable",
        },
        ollama: {
          available: !!services.ollama,
          status: services.ollama
            ? await services.ollama.getStatus()
            : "unavailable",
        },
      };

      return status;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get AI service status",
        cause: error,
      });
    }
  }),

  /**
   * 获取AI服务统计信息
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const { services } = ctx;

    try {
      const stats = {
        aiAssistant: services.aiAssistant
          ? await services.aiAssistant.getStats()
          : null,
        embedding: services.embedding
          ? await services.embedding.getStats()
          : null,
        ollama: services.ollama ? await services.ollama.getStats() : null,
      };

      return stats;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get AI service statistics",
        cause: error,
      });
    }
  }),

  /**
   * 生成文本嵌入
   */
  embed: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1).max(10000),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { services } = ctx;

      try {
        if (!services.embedding) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "Embedding service is not available",
          });
        }

        const embedding = await services.embedding.generateEmbedding({
          text: input.text,
          model: input.model,
        });

        return embedding;
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate embedding",
          cause: error,
        });
      }
    }),

  /**
   * 相似度搜索
   */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(1000),
        limit: z.number().min(1).max(50).default(10),
        threshold: z.number().min(0).max(1).default(0.7),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { services } = ctx;

      try {
        if (!services.embedding) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "Embedding service is not available",
          });
        }

        const results = await services.embedding.similaritySearch({
          query: input.query,
          limit: input.limit,
          threshold: input.threshold,
          model: input.model,
        });

        return results;
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to perform similarity search",
          cause: error,
        });
      }
    }),
});

// ============================================================================
// 主AI路由器
// ============================================================================

export const aiRouter = router({
  assistants: aiAssistantRouter,
  recommendations: aiRecommendationRouter,
  services: aiServiceRouter,
});

export type AIRouter = typeof aiRouter;
