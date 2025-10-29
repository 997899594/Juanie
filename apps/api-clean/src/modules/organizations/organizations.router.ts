import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '@/trpc/trpc.service'
import { OrganizationsService } from './organizations.service'

@Injectable()
export class OrganizationsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  get router() {
    return this.trpc.router({
      // 创建组织
      create: this.trpc.protectedProcedure
        .input(
          z.object({
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
            return await this.organizationsService.create(ctx.user.id, input)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '创建组织失败',
            })
          }
        }),

      // 列出用户的组织
      list: this.trpc.protectedProcedure.query(async ({ ctx }) => {
        return await this.organizationsService.list(ctx.user.id)
      }),

      // 获取组织详情
      get: this.trpc.protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
          const org = await this.organizationsService.get(input.orgId, ctx.user.id)

          if (!org) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: '组织不存在或无权访问',
            })
          }

          return org
        }),

      // 更新组织
      update: this.trpc.protectedProcedure
        .input(
          z.object({
            orgId: z.string(),
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
            const { orgId, ...data } = input
            return await this.organizationsService.update(orgId, ctx.user.id, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '更新组织失败',
            })
          }
        }),

      // 删除组织
      delete: this.trpc.protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.organizationsService.delete(input.orgId, ctx.user.id)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '删除组织失败',
            })
          }
        }),

      // 邀请成员
      inviteMember: this.trpc.protectedProcedure
        .input(
          z.object({
            orgId: z.string(),
            invitedUserId: z.string(),
            role: z.enum(['admin', 'member']),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { orgId, ...data } = input
            return await this.organizationsService.inviteMember(orgId, ctx.user.id, data)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '邀请成员失败',
            })
          }
        }),

      // 列出成员
      listMembers: this.trpc.protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
          try {
            return await this.organizationsService.listMembers(input.orgId, ctx.user.id)
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
            orgId: z.string(),
            memberId: z.string(),
            role: z.enum(['admin', 'member']),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { orgId, ...data } = input
            return await this.organizationsService.updateMemberRole(orgId, ctx.user.id, data)
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
            orgId: z.string(),
            memberId: z.string(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { orgId, ...data } = input
            return await this.organizationsService.removeMember(orgId, ctx.user.id, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '移除成员失败',
            })
          }
        }),

      // 获取配额使用情况
      getQuotaUsage: this.trpc.protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
          try {
            return await this.organizationsService.getQuotaUsage(input.orgId, ctx.user.id)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取配额信息失败',
            })
          }
        }),
    })
  }
}
