/**
 * 🚀 Juanie AI - 主tRPC路由器
 * 整合所有API路由和中间件
 */

import { router, mergeRouters } from '../trpc.config';
import { aiRouter } from './ai.router';
import { securityRouter } from './security.router';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, protectedProcedure } from '../trpc.config';

// ============================================================================
// 健康检查路由
// ============================================================================

const healthRouter = router({
  /**
   * 基础健康检查
   */
  ping: publicProcedure
    .query(() => {
      return {
        status: 'ok',
        timestamp: new Date(),
        version: process.env.APP_VERSION || '1.0.0',
      };
    }),

  /**
   * 详细健康检查
   */
  check: publicProcedure
    .query(async ({ ctx }) => {
      const { services } = ctx;
      
      try {
        const health = {
          status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
          timestamp: new Date(),
          version: process.env.APP_VERSION || '1.0.0',
          services: {
            database: 'unknown' as 'healthy' | 'unhealthy' | 'unknown',
            ai: 'unknown' as 'healthy' | 'unhealthy' | 'unknown',
            security: 'unknown' as 'healthy' | 'unhealthy' | 'unknown',
            cache: 'unknown' as 'healthy' | 'unhealthy' | 'unknown',
          },
          metrics: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
          },
        };

        // 检查数据库连接
        try {
          if (services.db) {
            await services.db.select().from(services.db.schema.organizations).limit(1);
            health.services.database = 'healthy';
          }
        } catch (error) {
          health.services.database = 'unhealthy';
          health.status = 'degraded';
        }

        // 检查AI服务
        try {
          if (services.aiAssistant) {
            const aiStatus = await services.aiAssistant.getStatus();
            health.services.ai = aiStatus === 'healthy' ? 'healthy' : 'unhealthy';
          }
        } catch (error) {
          health.services.ai = 'unhealthy';
          health.status = 'degraded';
        }

        // 检查安全服务
        try {
          if (services.zeroTrust) {
            health.services.security = 'healthy';
          }
        } catch (error) {
          health.services.security = 'unhealthy';
          health.status = 'degraded';
        }

        // 检查缓存服务
        try {
          if (services.cache) {
            health.services.cache = 'healthy';
          }
        } catch (error) {
          health.services.cache = 'unhealthy';
          health.status = 'degraded';
        }

        // 如果所有服务都不健康，标记为不健康
        const unhealthyServices = Object.values(health.services).filter(s => s === 'unhealthy').length;
        if (unhealthyServices >= 2) {
          health.status = 'unhealthy';
        }

        return health;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Health check failed',
          cause: error,
        });
      }
    }),

  /**
   * 就绪检查
   */
  ready: publicProcedure
    .query(async ({ ctx }) => {
      const { services } = ctx;
      
      try {
        // 检查关键服务是否就绪
        const checks = {
          database: false,
          auth: false,
        };

        // 数据库就绪检查
        try {
          if (services.db) {
            await services.db.select().from(services.db.schema.organizations).limit(1);
            checks.database = true;
          }
        } catch (error) {
          // 数据库未就绪
        }

        // 认证服务就绪检查
        try {
          if (services.auth) {
            checks.auth = true;
          }
        } catch (error) {
          // 认证服务未就绪
        }

        const isReady = checks.database && checks.auth;

        if (!isReady) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Service not ready',
          });
        }

        return {
          ready: true,
          timestamp: new Date(),
          checks,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Readiness check failed',
          cause: error,
        });
      }
    }),
});

// ============================================================================
// 用户管理路由
// ============================================================================

const userRouter = router({
  /**
   * 获取当前用户信息
   */
  me: protectedProcedure
    .query(async ({ ctx }) => {
      const { services, user } = ctx;
      
      try {
        if (!user?.sub) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          });
        }

        const userData = await services.db
          .select()
          .from(services.db.schema.users)
          .where(services.db.eq(services.db.schema.users.id, user.sub))
          .limit(1);

        if (!userData.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        const userInfo = userData[0];
        
        // 移除敏感信息
        const { passwordHash, ...safeUserInfo } = userInfo;

        return {
          ...safeUserInfo,
          permissions: user.permissions || [],
          roles: user.roles || [],
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user information',
          cause: error,
        });
      }
    }),

  /**
   * 更新用户资料
   */
  updateProfile: protectedProcedure
    .input(z.object({
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
      avatar: z.string().url().optional(),
      timezone: z.string().optional(),
      language: z.string().optional(),
      preferences: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services, user } = ctx;
      
      try {
        if (!user?.sub) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          });
        }

        const updateData = {
          ...input,
          updatedAt: new Date(),
        };

        const [updatedUser] = await services.db
          .update(services.db.schema.users)
          .set(updateData)
          .where(services.db.eq(services.db.schema.users.id, user.sub))
          .returning();

        if (!updatedUser) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // 移除敏感信息
        const { passwordHash, ...safeUserInfo } = updatedUser;

        return safeUserInfo;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user profile',
          cause: error,
        });
      }
    }),

  /**
   * 更改密码
   */
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services, user } = ctx;
      
      try {
        if (!services.auth) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Authentication service is not available',
          });
        }

        if (!user?.sub) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          });
        }

        await services.auth.changePassword(
          user.sub,
          input.currentPassword,
          input.newPassword
        );

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Password change failed',
          cause: error,
        });
      }
    }),

  /**
   * 获取用户会话
   */
  sessions: protectedProcedure
    .query(async ({ ctx }) => {
      const { services, user } = ctx;
      
      try {
        if (!user?.sub) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          });
        }

        // 这里可以实现获取用户活跃会话的逻辑
        // 暂时返回当前会话信息
        return {
          current: {
            sessionId: user.sessionId,
            deviceId: user.deviceId,
            ipAddress: user.ipAddress,
            userAgent: user.userAgent,
            lastActivity: user.lastActivity,
          },
          sessions: [], // 其他会话
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user sessions',
          cause: error,
        });
      }
    }),

  /**
   * 撤销会话
   */
  revokeSession: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services, user } = ctx;
      
      try {
        if (!services.auth) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Authentication service is not available',
          });
        }

        if (!user?.sub) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          });
        }

        await services.auth.revokeSession(user.sub, input.sessionId);

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to revoke session',
          cause: error,
        });
      }
    }),
});

// ============================================================================
// 组织管理路由
// ============================================================================

const organizationRouter = router({
  /**
   * 获取当前组织信息
   */
  current: protectedProcedure
    .query(async ({ ctx }) => {
      const { services, user } = ctx;
      
      try {
        if (!user?.organizationId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User not associated with an organization',
          });
        }

        const organization = await services.db
          .select()
          .from(services.db.schema.organizations)
          .where(services.db.eq(services.db.schema.organizations.id, user.organizationId))
          .limit(1);

        if (!organization.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Organization not found',
          });
        }

        return organization[0];
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch organization information',
          cause: error,
        });
      }
    }),

  /**
   * 获取组织成员
   */
  members: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      role: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { services, user } = ctx;
      
      try {
        if (!user?.organizationId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User not associated with an organization',
          });
        }

        const members = await services.db
          .select({
            id: services.db.schema.users.id,
            email: services.db.schema.users.email,
            firstName: services.db.schema.users.firstName,
            lastName: services.db.schema.users.lastName,
            avatar: services.db.schema.users.avatar,
            role: services.db.schema.users.role,
            isActive: services.db.schema.users.isActive,
            lastLoginAt: services.db.schema.users.lastLoginAt,
            createdAt: services.db.schema.users.createdAt,
          })
          .from(services.db.schema.users)
          .where(
            services.db.and(
              services.db.eq(services.db.schema.users.organizationId, user.organizationId),
              input.role ? services.db.eq(services.db.schema.users.role, input.role) : undefined,
            )
          )
          .limit(input.limit)
          .offset(input.offset)
          .orderBy(services.db.asc(services.db.schema.users.firstName));

        const total = await services.db
          .select({ count: services.db.count() })
          .from(services.db.schema.users)
          .where(
            services.db.and(
              services.db.eq(services.db.schema.users.organizationId, user.organizationId),
              input.role ? services.db.eq(services.db.schema.users.role, input.role) : undefined,
            )
          );

        return {
          members,
          pagination: {
            total: total[0].count,
            limit: input.limit,
            offset: input.offset,
            hasMore: input.offset + input.limit < total[0].count,
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch organization members',
          cause: error,
        });
      }
    }),
});

// ============================================================================
// 主应用路由器
// ============================================================================

export const appRouter = mergeRouters(
  router({
    health: healthRouter,
    user: userRouter,
    organization: organizationRouter,
  }),
  router({
    ai: aiRouter,
    security: securityRouter,
  })
);

export type AppRouter = typeof appRouter;

// ============================================================================
// 路由器元数据
// ============================================================================

export const routerMetadata = {
  version: '1.0.0',
  routes: {
    health: ['ping', 'check', 'ready'],
    user: ['me', 'updateProfile', 'changePassword', 'sessions', 'revokeSession'],
    organization: ['current', 'members'],
    ai: {
      assistants: ['list', 'get', 'create', 'update', 'delete', 'chat'],
      recommendations: ['list', 'generate', 'updateStatus', 'stats'],
      services: ['status', 'stats', 'embed', 'search'],
    },
    security: {
      auth: ['register', 'login', 'verifyMFA', 'refresh', 'logout', 'requestPasswordReset', 'resetPassword'],
      zeroTrust: ['policies', 'evaluateAccess', 'accessHistory', 'riskScore'],
      quantumCrypto: ['generateKeyPair', 'sign', 'verify', 'encrypt', 'decrypt', 'stats'],
      monitoring: ['events', 'dashboard'],
    },
  },
  middleware: ['logger', 'cache', 'rateLimit', 'auth'],
  features: [
    'Type-safe API with tRPC',
    'Intelligent caching with LRU/LFU strategies',
    'Rate limiting and security',
    'Zero-trust security architecture',
    'Quantum-safe cryptography',
    'AI-powered recommendations',
    'Real-time monitoring',
    'Edge computing optimization',
  ],
};