/**
 * Agent tRPC Router
 *
 * 提供 AI Agent 相关的 API 端点:
 * - execute: 执行 Agent 任务
 * - resume: 从检查点恢复执行
 * - cancel: 取消执行
 * - approve: 提交人工审批
 * - history: 获取执行历史
 * - chat: 流式对话（SSE）
 */

import { handleServiceError } from '@juanie/core/errors'
import { AgentService } from '@juanie/service-extensions'
import { RbacService } from '@juanie/service-foundation'
import { Injectable } from '@nestjs/common'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import { checkPermission } from '../trpc/rbac.middleware'
import { TrpcService } from '../trpc/trpc.service'

// ==================== 输入验证 Schema ====================

/** Agent 执行输入 */
const executeInputSchema = z.object({
  /** 用户消息 */
  message: z.string().min(1, '消息不能为空'),
  /** 项目 ID（可选） */
  projectId: z.string().uuid({ version: 'v4' }).optional(),
  /** Agent 类型 */
  agentType: z.enum(['devops', 'sre', 'orchestrator']).default('devops'),
  /** 系统提示词（可选） */
  systemPrompt: z.string().optional(),
  /** 附加上下文（可选） */
  context: z.record(z.string(), z.unknown()).optional(),
})

/** 恢复执行输入 */
const resumeInputSchema = z.object({
  /** 检查点 ID */
  checkpointId: z.string().uuid({ version: 'v4' }),
})

/** 取消执行输入 */
const cancelInputSchema = z.object({
  /** 执行 ID */
  executionId: z.string().uuid({ version: 'v4' }),
})

/** 审批输入 */
const approveInputSchema = z.object({
  /** 执行 ID */
  executionId: z.string().uuid({ version: 'v4' }),
  /** 是否批准 */
  approved: z.boolean(),
  /** 拒绝原因/审批备注（可选） */
  reason: z.string().optional(),
})

/** 历史查询输入 */
const historyInputSchema = z.object({
  /** 项目 ID（可选） */
  projectId: z.string().uuid({ version: 'v4' }).optional(),
  /** 限制数量 */
  limit: z.number().min(1).max(100).default(20),
  /** 偏移量 */
  offset: z.number().min(0).default(0),
  /** 状态过滤 */
  status: z.enum(['running', 'completed', 'failed', 'cancelled', 'waiting_approval']).optional(),
})

/** 流式对话输入 */
const chatInputSchema = z.object({
  /** 用户消息 */
  message: z.string().min(1, '消息不能为空'),
  /** 项目 ID（可选） */
  projectId: z.string().uuid({ version: 'v4' }).optional(),
  /** Agent 类型 */
  agentType: z.enum(['devops', 'sre', 'orchestrator']).default('devops'),
})

@Injectable()
export class AgentRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly agentService: AgentService,
    private readonly rbacService: RbacService,
  ) {}

  get router() {
    return this.trpc.router({
      /**
       * 执行 Agent 任务
       *
       * 返回执行 ID，客户端可通过 chat subscription 获取实时事件
       */
      execute: this.trpc.protectedProcedure
        .input(executeInputSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            // 如果指定了项目，检查项目权限
            if (input.projectId) {
              await checkPermission(
                this.rbacService,
                ctx.user.id,
                'read',
                'Project',
                undefined,
                input.projectId,
              )
            }

            // 收集所有事件
            const events: Array<{ type: string; data: unknown }> = []
            let executionId = ''

            for await (const event of this.agentService.execute(
              { message: input.message, context: input.context },
              {
                userId: ctx.user.id,
                projectId: input.projectId,
                agentType: input.agentType,
                systemPrompt: input.systemPrompt,
              },
            )) {
              if (event.type === 'execution_started') {
                executionId = event.executionId
              }
              events.push({ type: event.type, data: event })

              // 如果需要审批，提前返回
              if (event.type === 'approval_required') {
                return {
                  executionId,
                  status: 'waiting_approval',
                  events,
                }
              }
            }

            const lastEvent = events[events.length - 1]
            const status =
              lastEvent?.type === 'execution_completed'
                ? 'completed'
                : lastEvent?.type === 'execution_failed'
                  ? 'failed'
                  : 'unknown'

            return {
              executionId,
              status,
              events,
            }
          } catch (error) {
            handleServiceError(error)
          }
        }),

      /**
       * 从检查点恢复执行
       */
      resume: this.trpc.protectedProcedure.input(resumeInputSchema).mutation(async ({ input }) => {
        try {
          const events: Array<{ type: string; data: unknown }> = []
          let executionId = ''

          for await (const event of this.agentService.resume(input.checkpointId)) {
            if (event.type === 'execution_resumed') {
              executionId = event.executionId
            }
            events.push({ type: event.type, data: event })

            if (event.type === 'approval_required') {
              return {
                executionId,
                status: 'waiting_approval',
                events,
              }
            }
          }

          const lastEvent = events[events.length - 1]
          const status =
            lastEvent?.type === 'execution_completed'
              ? 'completed'
              : lastEvent?.type === 'execution_failed'
                ? 'failed'
                : 'unknown'

          return {
            executionId,
            status,
            events,
          }
        } catch (error) {
          handleServiceError(error)
        }
      }),

      /**
       * 取消执行
       */
      cancel: this.trpc.protectedProcedure.input(cancelInputSchema).mutation(async ({ input }) => {
        try {
          await this.agentService.cancel(input.executionId)
          return { success: true }
        } catch (error) {
          handleServiceError(error)
        }
      }),

      /**
       * 提交人工审批
       */
      approve: this.trpc.protectedProcedure
        .input(approveInputSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const events: Array<{ type: string; data: unknown }> = []

            for await (const event of this.agentService.submitApproval(input.executionId, {
              approved: input.approved,
              approvedBy: ctx.user.id,
              approvedAt: new Date(),
              comment: input.reason,
              reason: input.reason,
            })) {
              events.push({ type: event.type, data: event })

              if (event.type === 'approval_required') {
                return {
                  executionId: input.executionId,
                  status: 'waiting_approval',
                  events,
                }
              }
            }

            const lastEvent = events[events.length - 1]
            const status =
              lastEvent?.type === 'execution_completed'
                ? 'completed'
                : lastEvent?.type === 'execution_failed'
                  ? 'failed'
                  : 'unknown'

            return {
              executionId: input.executionId,
              status,
              events,
            }
          } catch (error) {
            handleServiceError(error)
          }
        }),

      /**
       * 获取执行历史
       */
      history: this.trpc.protectedProcedure
        .input(historyInputSchema)
        .query(async ({ ctx, input }) => {
          try {
            // 如果指定了项目，检查项目权限
            if (input.projectId) {
              await checkPermission(
                this.rbacService,
                ctx.user.id,
                'read',
                'Project',
                undefined,
                input.projectId,
              )
            }

            const executions = await this.agentService.getHistory(ctx.user.id, {
              projectId: input.projectId,
              limit: input.limit,
              offset: input.offset,
              // status 需要包装成数组，因为 HistoryQueryOptions.status 是数组类型
              status: input.status ? [input.status] : undefined,
            })

            return {
              executions,
              total: executions.length,
              hasMore: executions.length === input.limit,
            }
          } catch (error) {
            handleServiceError(error)
          }
        }),

      /**
       * 流式对话（SSE）
       *
       * 实时推送 Agent 执行事件
       */
      chat: this.trpc.protectedProcedure.input(chatInputSchema).subscription(({ ctx, input }) => {
        return observable<{ type: string; data: unknown }>((emit) => {
          let cancelled = false

          // 异步执行 Agent
          ;(async () => {
            try {
              for await (const event of this.agentService.execute(
                { message: input.message },
                {
                  userId: ctx.user.id,
                  projectId: input.projectId,
                  agentType: input.agentType,
                },
              )) {
                if (cancelled) break

                emit.next({ type: event.type, data: event })

                // 如果执行完成或失败，关闭连接
                if (
                  event.type === 'execution_completed' ||
                  event.type === 'execution_failed' ||
                  event.type === 'execution_cancelled' ||
                  event.type === 'approval_required'
                ) {
                  emit.complete()
                  break
                }
              }
            } catch (error) {
              emit.error(error instanceof Error ? error : new Error(String(error)))
            }
          })()

          // 清理函数
          return () => {
            cancelled = true
          }
        })
      }),

      /**
       * 获取可用工具列表
       */
      listTools: this.trpc.protectedProcedure.query(async () => {
        try {
          // 这里可以根据用户权限过滤工具
          // 暂时返回空列表，后续实现
          return {
            tools: [] as Array<{
              name: string
              description: string
              category: string
              requiresApproval: boolean
            }>,
          }
        } catch (error) {
          handleServiceError(error)
        }
      }),
    })
  }
}
