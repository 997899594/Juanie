import { z } from 'zod'
import { createError, ErrorHandler } from '../../../middleware/error.middleware'
import { logger } from '../../../middleware/logger.middleware'
import { publicProcedure, router } from '../../../trpc/init'

/**
 * 健康检查路由
 * 提供系统状态、性能指标和服务可用性检查
 */
export const healthRouter = router({
  /**
   * 基础健康检查
   */
  check: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/health/check',
        tags: ['Health'],
        summary: '健康检查',
        description: '检查服务基本状态',
      },
    })
    .input(z.void())
    .output(
      z.object({
        status: z.string(),
        uptime: z.number(),
        environment: z.string(),
        version: z.string().optional(),
        memory: z
          .object({
            rss: z.number(),
            heapTotal: z.number(),
            heapUsed: z.number(),
            external: z.number(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx }) => {
      try {
        logger.logSystem('health_check_requested')

        const healthStatus = ctx.healthService
          ? await ctx.healthService.getHealthStatus()
          : {
              status: 'healthy',
              uptime: process.uptime(),
              environment: process.env.NODE_ENV || 'development',
              version: '1.0.0',
              memory: process.memoryUsage(),
            }

        logger.logSystem('health_check_completed', { status: healthStatus.status })

        return healthStatus
      } catch (error) {
        logger.error('Health check failed', { error: (error as Error).message })
        return {
          status: 'degraded',
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
          version: '1.0.0',
          memory: process.memoryUsage(),
        }
      }
    }),

  /**
   * Ping 检查
   */
  ping: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/health/ping',
        tags: ['Health'],
        summary: 'Ping检查',
        description: '简单的存活检查',
      },
    })
    .input(z.void())
    .output(
      z.object({
        status: z.string(),
        timestamp: z.string(),
      }),
    )
    .query(async ({ ctx }) => {
      try {
        logger.logSystem('ping_requested')

        const pingResult = ctx.healthService
          ? await ctx.healthService.ping()
          : {
              status: 'pong',
              timestamp: new Date().toISOString(),
            }

        logger.logSystem('ping_completed')

        return pingResult
      } catch (error) {
        logger.error('Ping failed', { error: (error as Error).message })
        return {
          status: 'pong',
          timestamp: new Date().toISOString(),
        }
      }
    }),

  /**
   * 详细的系统指标
   */
  metrics: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/health/metrics',
        tags: ['Health'],
        summary: '系统指标',
        description: '获取详细的系统性能指标',
      },
    })
    .input(z.void())
    .output(
      z.object({
        memory: z.object({
          rss: z.number(),
          heapTotal: z.number(),
          heapUsed: z.number(),
          external: z.number(),
          heapUsedPercentage: z.number(),
        }),
        uptime: z.number(),
        timestamp: z.string(),
        environment: z.string(),
        nodeVersion: z.string(),
        platform: z.string(),
        arch: z.string(),
      }),
    )
    .query(async () => {
      try {
        logger.logSystem('metrics_requested')

        const mu = process.memoryUsage()
        const heapUsedPercentage =
          mu.heapTotal > 0 ? Number(((mu.heapUsed / mu.heapTotal) * 100).toFixed(2)) : 0

        const result = {
          memory: {
            rss: mu.rss,
            heapTotal: mu.heapTotal,
            heapUsed: mu.heapUsed,
            external: mu.external,
            heapUsedPercentage,
          },
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV ?? 'development',
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        }

        logger.logSystem('metrics_completed', {
          memoryUsage: result.memory.heapUsedPercentage,
          uptime: result.uptime,
        })

        return result
      } catch (error) {
        logger.error('Metrics collection failed', { error: (error as Error).message })
        throw ErrorHandler.toTRPCError(createError.internal('指标收集失败'))
      }
    }),

  /**
   * 数据库连接检查
   */
  database: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/health/database',
        tags: ['Health'],
        summary: '数据库健康检查',
        description: '检查数据库连接状态',
      },
    })
    .input(z.void())
    .output(
      z.object({
        status: z.string(),
        connected: z.boolean(),
        responseTime: z.number(),
        timestamp: z.string(),
      }),
    )
    .query(async ({ ctx }) => {
      try {
        logger.logDatabaseOperation('health_check_requested')

        const dbHealth = await ctx.healthService.checkDatabaseHealth()

        const result = {
          status: dbHealth.status,
          connected: dbHealth.connected,
          responseTime: dbHealth.responseTime,
          timestamp: new Date().toISOString(),
        }

        logger.logDatabaseOperation(
          'health_check_completed',
          undefined,
          result.responseTime,
          result.connected,
        )

        return result
      } catch (error) {
        logger.error('Database health check failed', { error: (error as Error).message })

        return {
          status: 'unhealthy',
          connected: false,
          responseTime: -1,
          timestamp: new Date().toISOString(),
        }
      }
    }),

  /**
   * 服务就绪检查
   */
  ready: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/health/ready',
        tags: ['Health'],
        summary: '服务就绪检查',
        description: '检查所有依赖服务是否就绪',
      },
    })
    .input(z.void())
    .output(
      z.object({
        ready: z.boolean(),
        services: z.object({
          database: z.boolean(),
          health: z.boolean(),
          trpc: z.boolean(),
        }),
        timestamp: z.string(),
      }),
    )
    .query(async ({ ctx }) => {
      try {
        logger.logSystem('readiness_check_requested')

        const readinessResult = await ctx.healthService.checkReadiness()

        const result = {
          ready: readinessResult.ready,
          services: readinessResult.services,
          timestamp: new Date().toISOString(),
        }

        logger.logSystem('readiness_check_completed', {
          ready: result.ready,
          services: result.services,
        })

        return result
      } catch (error) {
        logger.error('Readiness check failed', { error: (error as Error).message })

        return {
          ready: true,
          services: {
            database: false,
            health: true,
            trpc: true,
          },
          timestamp: new Date().toISOString(),
        }
      }
    }),
})
