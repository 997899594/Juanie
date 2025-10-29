import { TeamsService } from '@juanie/service-teams'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

/**
 * Teams 路由
 * 处理团队管理相关的所有端点
 */
@Injectable()
export class TeamsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly teamsService: TeamsService,
  ) {}

  get router() {
    return this.trpc.router({
      // 创建团队
      create: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.string(),
            name: z.string().min(1).max(100),
            slug: z
              .string()
              .min(3)
              .max(50)
              .regex(/^[a-z0-9-]+$/),
            description: z.string().max(500).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.teamsService.create(ctx.user.id, input)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '创建团队失败',
            })
          }
        }),

      // 列出组织的团队
      list: this.trpc.protectedProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
          try {
            return await this.teamsService.list(ctx.user.id, input.organizationId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取团队列表失败',
            })
          }
        }),

      // 获取团队详情
      get: this.trpc.protectedProcedure
        .input(z.object({ teamId: z.string() }))
        .query(async ({ ctx, input }) => {
          try {
            const team = await this.teamsService.get(ctx.user.id, input.teamId)

            if (!team) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: '团队不存在',
              })
            }

            return team
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取团队详情失败',
            })
          }
        }),

      // 更新团队
      update: this.trpc.protectedProcedure
        .input(
          z.object({
            teamId: z.string(),
            name: z.string().min(1).max(100).optional(),
            slug: z
              .string()
              .min(3)
              .max(50)
              .regex(/^[a-z0-9-]+$/)
              .optional(),
            description: z.string().max(500).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { teamId, ...data } = input
            return await this.teamsService.update(ctx.user.id, teamId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '更新团队失败',
            })
          }
        }),

      // 删除团队
      delete: this.trpc.protectedProcedure
        .input(z.object({ teamId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.teamsService.delete(ctx.user.id, input.teamId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '删除团队失败',
            })
          }
        }),

      // 添加成员
      addMember: this.trpc.protectedProcedure
        .input(
          z.object({
            teamId: z.string(),
            memberId: z.string(),
            role: z.enum(['lead', 'member']),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { teamId, ...data } = input
            return await this.teamsService.addMember(ctx.user.id, teamId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '添加成员失败',
            })
          }
        }),

      // 列出团队成员
      listMembers: this.trpc.protectedProcedure
        .input(z.object({ teamId: z.string() }))
        .query(async ({ ctx, input }) => {
          try {
            return await this.teamsService.listMembers(ctx.user.id, input.teamId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取成员列表失败',
            })
          }
        }),

      // 更新成员角色
      updateMemberRole: this.trpc.protectedProcedure
        .input(
          z.object({
            teamId: z.string(),
            memberId: z.string(),
            role: z.enum(['lead', 'member']),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { teamId, ...data } = input
            return await this.teamsService.updateMemberRole(ctx.user.id, teamId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '更新成员角色失败',
            })
          }
        }),

      // 移除成员
      removeMember: this.trpc.protectedProcedure
        .input(
          z.object({
            teamId: z.string(),
            memberId: z.string(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { teamId, ...data } = input
            return await this.teamsService.removeMember(ctx.user.id, teamId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '移除成员失败',
            })
          }
        }),
    })
  }
}
