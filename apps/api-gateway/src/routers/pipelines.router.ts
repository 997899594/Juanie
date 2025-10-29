import { REDIS } from '@juanie/core-database/module'
import { PipelinesService } from '@juanie/service-pipelines'
import { Inject, Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import type Redis from 'ioredis'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class PipelinesRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly pipelinesService: PipelinesService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  get router() {
    return this.trpc.router({
      create: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            name: z.string(),
            description: z.string().optional(),
            config: z.any(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.pipelinesService.create(ctx.user.id, input)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '创建 Pipeline 失败',
            })
          }
        }),

      list: this.trpc.protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }) => {
          try {
            return await this.pipelinesService.list(ctx.user.id, input.projectId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取列表失败',
            })
          }
        }),

      get: this.trpc.protectedProcedure
        .input(z.object({ pipelineId: z.string() }))
        .query(async ({ ctx, input }) => {
          const pipeline = await this.pipelinesService.get(ctx.user.id, input.pipelineId)
          if (!pipeline) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline 不存在' })
          }
          return pipeline
        }),

      update: this.trpc.protectedProcedure
        .input(
          z.object({
            pipelineId: z.string(),
            name: z.string().optional(),
            description: z.string().optional(),
            config: z.any().optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          const { pipelineId, ...data } = input
          return await this.pipelinesService.update(ctx.user.id, pipelineId, data)
        }),

      delete: this.trpc.protectedProcedure
        .input(z.object({ pipelineId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          return await this.pipelinesService.delete(ctx.user.id, input.pipelineId)
        }),

      trigger: this.trpc.protectedProcedure
        .input(
          z.object({
            pipelineId: z.string(),
            branch: z.string().optional(),
            commit: z.string().optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          const { pipelineId, ...data } = input
          return await this.pipelinesService.trigger(ctx.user.id, pipelineId, data)
        }),

      cancel: this.trpc.protectedProcedure
        .input(z.object({ runId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          return await this.pipelinesService.cancel(ctx.user.id, input.runId)
        }),

      listRuns: this.trpc.protectedProcedure
        .input(z.object({ pipelineId: z.string() }))
        .query(async ({ ctx, input }) => {
          return await this.pipelinesService.listRuns(ctx.user.id, input.pipelineId)
        }),

      getRun: this.trpc.protectedProcedure
        .input(z.object({ runId: z.string() }))
        .query(async ({ ctx, input }) => {
          const run = await this.pipelinesService.getRun(ctx.user.id, input.runId)
          if (!run) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Run 不存在' })
          }
          return run
        }),

      getLogs: this.trpc.protectedProcedure
        .input(z.object({ runId: z.string() }))
        .query(async ({ ctx, input }) => {
          return await this.pipelinesService.getLogs(ctx.user.id, input.runId)
        }),

      // SSE 实时日志流
      streamLogs: this.trpc.protectedProcedure
        .input(z.object({ runId: z.string() }))
        .subscription(({ input }) => {
          return observable<{ timestamp: string; message: string }>((emit) => {
            // 从 Dragonfly 订阅日志
            const subscriber = this.redis.duplicate()
            subscriber.subscribe(`logs:${input.runId}`)

            subscriber.on('message', (_channel, message) => {
              try {
                const logEntry = JSON.parse(message)
                emit.next(logEntry)
              } catch (error) {
                console.error('Failed to parse log entry:', error)
              }
            })

            subscriber.on('error', (error) => {
              console.error('Redis subscription error:', error)
              emit.error(error)
            })

            // 清理函数
            return () => {
              subscriber.unsubscribe()
              subscriber.quit()
            }
          })
        }),

      // SSE Pipeline 运行状态
      watchRun: this.trpc.protectedProcedure
        .input(z.object({ runId: z.string() }))
        .subscription(({ input }) => {
          return observable<{ status: string; progress?: number }>((emit) => {
            // 从 Dragonfly 订阅状态更新
            const subscriber = this.redis.duplicate()
            subscriber.subscribe(`run:${input.runId}:status`)

            subscriber.on('message', (_channel, message) => {
              try {
                const statusUpdate = JSON.parse(message)
                emit.next(statusUpdate)
              } catch (error) {
                console.error('Failed to parse status update:', error)
              }
            })

            subscriber.on('error', (error) => {
              console.error('Redis subscription error:', error)
              emit.error(error)
            })

            return () => {
              subscriber.unsubscribe()
              subscriber.quit()
            }
          })
        }),
    })
  }
}
