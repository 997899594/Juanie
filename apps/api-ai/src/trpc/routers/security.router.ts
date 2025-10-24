/**
 * 🚀 Juanie AI - 安全路由器
 * 集成零信任安全、量子加密和认证服务
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc.config';
import { 
  insertZeroTrustPolicySchema,
  insertSecurityPolicySchema,
  insertVulnerabilityScanSchema,
} from '../../database/schemas';

// ============================================================================
// 认证路由
// ============================================================================

const authRouter = router({
  /**
   * 用户注册
   */
  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
      firstName: z.string().min(1).max(50),
      lastName: z.string().min(1).max(50),
      organizationId: z.string().optional(),
      inviteCode: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services } = ctx;
      
      try {
        if (!services.auth) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Authentication service is not available',
          });
        }

        const result = await services.auth.register({
          email: input.email,
          password: input.password,
          firstName: input.firstName,
          lastName: input.lastName,
          organizationId: input.organizationId,
          inviteCode: input.inviteCode,
        });

        return {
          user: result.user,
          tokens: result.tokens,
          mfaRequired: result.mfaRequired,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Registration failed',
          cause: error,
        });
      }
    }),

  /**
   * 用户登录
   */
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
      deviceId: z.string().optional(),
      rememberMe: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services, request } = ctx;
      
      try {
        if (!services.auth) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Authentication service is not available',
          });
        }

        const result = await services.auth.login({
          email: input.email,
          password: input.password,
          deviceId: input.deviceId,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          rememberMe: input.rememberMe,
        });

        return {
          user: result.user,
          tokens: result.tokens,
          mfaRequired: result.mfaRequired,
          sessionId: result.sessionId,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
          cause: error,
        });
      }
    }),

  /**
   * MFA验证
   */
  verifyMFA: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      code: z.string().length(6),
      type: z.enum(['totp', 'sms', 'email']).default('totp'),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services } = ctx;
      
      try {
        if (!services.auth) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Authentication service is not available',
          });
        }

        const result = await services.auth.verifyMFA({
          sessionId: input.sessionId,
          code: input.code,
          type: input.type,
        });

        return {
          user: result.user,
          tokens: result.tokens,
          verified: result.verified,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'MFA verification failed',
          cause: error,
        });
      }
    }),

  /**
   * 刷新令牌
   */
  refresh: publicProcedure
    .input(z.object({
      refreshToken: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services } = ctx;
      
      try {
        if (!services.auth) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Authentication service is not available',
          });
        }

        const result = await services.auth.refreshTokens(input.refreshToken);

        return {
          tokens: result.tokens,
          user: result.user,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Token refresh failed',
          cause: error,
        });
      }
    }),

  /**
   * 登出
   */
  logout: protectedProcedure
    .input(z.object({
      refreshToken: z.string().optional(),
      allDevices: z.boolean().default(false),
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

        await services.auth.logout({
          userId: user?.sub,
          refreshToken: input.refreshToken,
          allDevices: input.allDevices,
        });

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Logout failed',
          cause: error,
        });
      }
    }),

  /**
   * 重置密码请求
   */
  requestPasswordReset: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services } = ctx;
      
      try {
        if (!services.auth) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Authentication service is not available',
          });
        }

        await services.auth.requestPasswordReset(input.email);

        return { success: true };
      } catch (error) {
        // 为了安全，不暴露用户是否存在
        return { success: true };
      }
    }),

  /**
   * 重置密码
   */
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      newPassword: z.string().min(8).max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services } = ctx;
      
      try {
        if (!services.auth) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Authentication service is not available',
          });
        }

        await services.auth.resetPassword(input.token, input.newPassword);

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Password reset failed',
          cause: error,
        });
      }
    }),
});

// ============================================================================
// 零信任路由
// ============================================================================

const zeroTrustRouter = router({
  /**
   * 获取零信任策略
   */
  policies: protectedProcedure
    .input(z.object({
      organizationId: z.string().optional(),
      resourceType: z.string().optional(),
      isActive: z.boolean().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const { services, user } = ctx;
      
      try {
        const organizationId = input.organizationId || user?.organizationId;
        
        if (!organizationId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Organization ID is required',
          });
        }

        const policies = await services.db
          .select()
          .from(services.db.schema.zeroTrustPolicies)
          .where(
            services.db.and(
              services.db.eq(services.db.schema.zeroTrustPolicies.organizationId, organizationId),
              input.resourceType ? services.db.eq(services.db.schema.zeroTrustPolicies.resourceType, input.resourceType) : undefined,
              input.isActive !== undefined ? services.db.eq(services.db.schema.zeroTrustPolicies.isActive, input.isActive) : undefined,
            )
          )
          .limit(input.limit)
          .offset(input.offset)
          .orderBy(services.db.desc(services.db.schema.zeroTrustPolicies.createdAt));

        const total = await services.db
          .select({ count: services.db.count() })
          .from(services.db.schema.zeroTrustPolicies)
          .where(
            services.db.and(
              services.db.eq(services.db.schema.zeroTrustPolicies.organizationId, organizationId),
              input.resourceType ? services.db.eq(services.db.schema.zeroTrustPolicies.resourceType, input.resourceType) : undefined,
              input.isActive !== undefined ? services.db.eq(services.db.schema.zeroTrustPolicies.isActive, input.isActive) : undefined,
            )
          );

        return {
          policies,
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
          message: 'Failed to fetch zero trust policies',
          cause: error,
        });
      }
    }),

  /**
   * 评估访问请求
   */
  evaluateAccess: protectedProcedure
    .input(z.object({
      userId: z.string(),
      resourceId: z.string(),
      resourceType: z.string(),
      action: z.string(),
      context: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services, user, request } = ctx;
      
      try {
        if (!services.zeroTrust) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Zero trust service is not available',
          });
        }

        const accessRequest = {
          ...input,
          userId: user?.sub,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          timestamp: new Date(),
        };

        const decision = await services.zeroTrust.evaluateAccess(accessRequest);

        return decision;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Access evaluation failed',
          cause: error,
        });
      }
    }),

  /**
   * 获取访问决策历史
   */
  accessHistory: protectedProcedure
    .input(z.object({
      userId: z.string().optional(),
      resourceId: z.string().optional(),
      decision: z.enum(['allow', 'deny', 'challenge']).optional(),
      timeRange: z.enum(['hour', 'day', 'week', 'month']).default('day'),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const { services, user } = ctx;
      
      try {
        if (!services.zeroTrust) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Zero trust service is not available',
          });
        }

        const userId = input.userId || user?.sub;
        const history = await services.zeroTrust.getAccessHistory({
          userId,
          resourceId: input.resourceId,
          decision: input.decision,
          timeRange: input.timeRange,
          limit: input.limit,
          offset: input.offset,
        });

        return history;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch access history',
          cause: error,
        });
      }
    }),

  /**
   * 获取风险评分
   */
  riskScore: protectedProcedure
    .input(z.object({
      userId: z.string().optional(),
      resourceId: z.string(),
      context: z.record(z.any()).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { services, user, request } = ctx;
      
      try {
        if (!services.zeroTrust) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Zero trust service is not available',
          });
        }

        const riskContext = {
          userId: input.userId || user?.sub,
          resourceId: input.resourceId,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          timestamp: new Date(),
          ...input.context,
        };

        const riskScore = await services.zeroTrust.calculateRiskScore(riskContext);

        return riskScore;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Risk score calculation failed',
          cause: error,
        });
      }
    }),
});

// ============================================================================
// 量子加密路由
// ============================================================================

const quantumCryptoRouter = router({
  /**
   * 生成量子安全密钥对
   */
  generateKeyPair: protectedProcedure
    .input(z.object({
      algorithm: z.enum(['kyber', 'dilithium', 'falcon']).default('kyber'),
      keySize: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services } = ctx;
      
      try {
        if (!services.quantumCrypto) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Quantum crypto service is not available',
          });
        }

        const keyPair = await services.quantumCrypto.generateKeyPair(
          input.algorithm,
          input.keySize
        );

        return {
          publicKey: keyPair.publicKey,
          keyId: keyPair.keyId,
          algorithm: keyPair.algorithm,
          createdAt: keyPair.createdAt,
          // 不返回私钥
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Key pair generation failed',
          cause: error,
        });
      }
    }),

  /**
   * 量子安全签名
   */
  sign: protectedProcedure
    .input(z.object({
      data: z.string(),
      keyId: z.string(),
      algorithm: z.enum(['dilithium', 'falcon']).default('dilithium'),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services } = ctx;
      
      try {
        if (!services.quantumCrypto) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Quantum crypto service is not available',
          });
        }

        const signature = await services.quantumCrypto.sign(
          input.data,
          input.keyId,
          input.algorithm
        );

        return signature;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Quantum signature failed',
          cause: error,
        });
      }
    }),

  /**
   * 验证量子签名
   */
  verify: protectedProcedure
    .input(z.object({
      data: z.string(),
      signature: z.string(),
      publicKey: z.string(),
      algorithm: z.enum(['dilithium', 'falcon']).default('dilithium'),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services } = ctx;
      
      try {
        if (!services.quantumCrypto) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Quantum crypto service is not available',
          });
        }

        const isValid = await services.quantumCrypto.verify(
          input.data,
          input.signature,
          input.publicKey,
          input.algorithm
        );

        return { valid: isValid };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Signature verification failed',
          cause: error,
        });
      }
    }),

  /**
   * 量子安全加密
   */
  encrypt: protectedProcedure
    .input(z.object({
      data: z.string(),
      publicKey: z.string(),
      algorithm: z.enum(['kyber']).default('kyber'),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services } = ctx;
      
      try {
        if (!services.quantumCrypto) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Quantum crypto service is not available',
          });
        }

        const encrypted = await services.quantumCrypto.encrypt(
          input.data,
          input.publicKey,
          input.algorithm
        );

        return encrypted;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Quantum encryption failed',
          cause: error,
        });
      }
    }),

  /**
   * 量子安全解密
   */
  decrypt: protectedProcedure
    .input(z.object({
      encryptedData: z.string(),
      keyId: z.string(),
      algorithm: z.enum(['kyber']).default('kyber'),
    }))
    .mutation(async ({ input, ctx }) => {
      const { services } = ctx;
      
      try {
        if (!services.quantumCrypto) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Quantum crypto service is not available',
          });
        }

        const decrypted = await services.quantumCrypto.decrypt(
          input.encryptedData,
          input.keyId,
          input.algorithm
        );

        return { data: decrypted };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Quantum decryption failed',
          cause: error,
        });
      }
    }),

  /**
   * 获取量子加密统计
   */
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const { services } = ctx;
      
      try {
        if (!services.quantumCrypto) {
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Quantum crypto service is not available',
          });
        }

        const stats = await services.quantumCrypto.getStats();

        return stats;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get quantum crypto statistics',
          cause: error,
        });
      }
    }),
});

// ============================================================================
// 安全监控路由
// ============================================================================

const securityMonitoringRouter = router({
  /**
   * 获取安全事件
   */
  events: protectedProcedure
    .input(z.object({
      organizationId: z.string().optional(),
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      type: z.string().optional(),
      timeRange: z.enum(['hour', 'day', 'week', 'month']).default('day'),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const { services, user } = ctx;
      
      try {
        const organizationId = input.organizationId || user?.organizationId;
        
        if (!organizationId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Organization ID is required',
          });
        }

        // 计算时间范围
        const now = new Date();
        const timeRanges = {
          hour: new Date(now.getTime() - 60 * 60 * 1000),
          day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        };
        
        const startDate = timeRanges[input.timeRange];

        const events = await services.db
          .select()
          .from(services.db.schema.incidents)
          .where(
            services.db.and(
              services.db.eq(services.db.schema.incidents.organizationId, organizationId),
              input.severity ? services.db.eq(services.db.schema.incidents.severity, input.severity) : undefined,
              input.type ? services.db.eq(services.db.schema.incidents.type, input.type) : undefined,
              services.db.gte(services.db.schema.incidents.createdAt, startDate),
            )
          )
          .limit(input.limit)
          .offset(input.offset)
          .orderBy(services.db.desc(services.db.schema.incidents.createdAt));

        const total = await services.db
          .select({ count: services.db.count() })
          .from(services.db.schema.incidents)
          .where(
            services.db.and(
              services.db.eq(services.db.schema.incidents.organizationId, organizationId),
              input.severity ? services.db.eq(services.db.schema.incidents.severity, input.severity) : undefined,
              input.type ? services.db.eq(services.db.schema.incidents.type, input.type) : undefined,
              services.db.gte(services.db.schema.incidents.createdAt, startDate),
            )
          );

        return {
          events,
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
          message: 'Failed to fetch security events',
          cause: error,
        });
      }
    }),

  /**
   * 获取安全仪表板数据
   */
  dashboard: protectedProcedure
    .input(z.object({
      organizationId: z.string().optional(),
      timeRange: z.enum(['day', 'week', 'month']).default('day'),
    }))
    .query(async ({ ctx, input }) => {
      const { services, user } = ctx;
      
      try {
        const organizationId = input.organizationId || user?.organizationId;
        
        if (!organizationId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Organization ID is required',
          });
        }

        // 获取安全统计数据
        const dashboard = {
          incidents: {
            total: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            resolved: 0,
          },
          vulnerabilities: {
            total: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            fixed: 0,
          },
          accessAttempts: {
            total: 0,
            allowed: 0,
            denied: 0,
            challenged: 0,
          },
          riskScore: {
            current: 0,
            trend: 'stable' as 'up' | 'down' | 'stable',
            factors: [] as string[],
          },
        };

        // 这里可以添加实际的数据查询逻辑
        // 暂时返回模拟数据结构

        return dashboard;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch security dashboard',
          cause: error,
        });
      }
    }),
});

// ============================================================================
// 主安全路由器
// ============================================================================

export const securityRouter = router({
  auth: authRouter,
  zeroTrust: zeroTrustRouter,
  quantumCrypto: quantumCryptoRouter,
  monitoring: securityMonitoringRouter,
});

export type SecurityRouter = typeof securityRouter;